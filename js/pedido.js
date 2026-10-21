// Entrada de pedido.html: conecta el formulario de pedidos con la lógica (pedido-logic.js) y con el servidor
// (pedido-upload.js). Sin JavaScript el formulario no se ve y queda el aviso con enlace a WhatsApp.
import {
  API_BASE,
  LIMITS,
  MESSAGES,
  TURNSTILE_SITE_KEY,
  buildDraftPayload,
  checkFile,
  formatBytes,
  validateOrder,
} from './pedido-logic.js';
import { ApiError, createDraft, finalizeOrder, uploadFile } from './pedido-upload.js';

const WHATSAPP = 'https://wa.me/5491172394787';
const fetchImpl = (...args) => fetch(...args);

const $ = (id) => document.getElementById(id);
const form = $('form-pedido');

const state = {
  products: [],
  product: null,
  files: [], // { id, file, name, size, status: 'pendiente' | 'subiendo' | 'listo' | 'error', sent, analysis, error, url }
  turnstileToken: null,
  turnstileWidget: null,
  draft: null, // lo que devolvió el servidor al crear el pedido: { draftToken, chunkSize, files: [{ index, uploadToken }] }
  fields: null, // lo que se envió, para el resumen y para reintentar sin pedir nada de nuevo
  busy: false,
};
let nextId = 1;

// ---------------------------------------------------------------------------------------------- errores en pantalla

const ERROR_IDS = {
  product: 'producto-error',
  quantity: 'cantidad-error',
  finishing: 'terminacion-error',
  files: 'archivos-error',
  name: 'nombre-error',
  email: 'email-error',
  whatsapp: 'whatsapp-error',
  contact: 'contacto-error',
  notes: 'notas-error',
  consent: 'consentimiento-error',
};
const INPUT_IDS = { quantity: 'cantidad', finishing: 'terminacion', name: 'nombre', email: 'email', whatsapp: 'whatsapp', notes: 'notas', consent: 'consentimiento' };

function clearErrors() {
  for (const id of Object.values(ERROR_IDS)) $(id).textContent = '';
  $('turnstile-error').textContent = '';
  $('estado').textContent = '';
  for (const id of Object.values(INPUT_IDS)) $(id).removeAttribute('aria-invalid');
}

function showErrors(errors) {
  for (const [key, message] of Object.entries(errors)) {
    const base = key.startsWith('files') ? 'files' : key;
    const target = $(ERROR_IDS[base]);
    if (!target) continue;
    target.textContent = target.textContent ? `${target.textContent} ${message}` : message;
    const input = $(INPUT_IDS[base] ?? '');
    if (input) input.setAttribute('aria-invalid', 'true');
  }
  if (errors.contact) {
    $('email').setAttribute('aria-invalid', 'true');
    $('whatsapp').setAttribute('aria-invalid', 'true');
  }
}

function focusField(name) {
  const target =
    name === 'product' ? form.querySelector('input[name="producto"]') : name === 'files' ? $('zona-archivos') : $(INPUT_IDS[name] ?? '');
  target?.focus();
}

const setStatus = (text) => ($('estado').textContent = text);

// ---------------------------------------------------------------------------------------------- catálogo

async function loadCatalog() {
  const box = $('productos');
  try {
    const response = await fetchImpl(`${API_BASE}/api/v1/catalog`, { credentials: 'omit' });
    if (!response.ok) throw new Error('catálogo');
    state.products = (await response.json()).products ?? [];
  } catch {
    box.replaceChildren();
    const p = document.createElement('p');
    p.className = 'hint';
    p.append('No pudimos cargar los productos. ');
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'link';
    retry.textContent = 'Reintentar';
    retry.addEventListener('click', () => {
      box.replaceChildren(Object.assign(document.createElement('p'), { className: 'hint', textContent: 'Cargando productos…' }));
      loadCatalog();
    });
    p.append(retry, ' o escribinos por ');
    p.append(Object.assign(document.createElement('a'), { className: 'link', href: WHATSAPP, target: '_blank', rel: 'noopener', textContent: 'WhatsApp' }), '.');
    box.append(p);
    return;
  }
  box.replaceChildren(
    ...state.products.map((product) => {
      const label = document.createElement('label');
      label.className = 'chip';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'producto';
      input.value = product.slug;
      input.addEventListener('change', () => selectProduct(product));
      const text = document.createElement('span');
      text.textContent = product.name;
      label.append(input, text);
      return label;
    }),
  );
}

function selectProduct(product) {
  state.product = product;
  $('producto-error').textContent = '';
}

// ---------------------------------------------------------------------------------------------- archivos

const extensionOf = (name) => name.slice(name.lastIndexOf('.') + 1).toLowerCase();
const isImage = (name) => ['jpg', 'jpeg', 'png'].includes(extensionOf(name));

function addFiles(list) {
  const problems = [];
  for (const file of list) {
    if (state.files.some((f) => f.name === file.name && f.size === file.size)) continue;
    if (state.files.length >= LIMITS.files) {
      problems.push(MESSAGES.filesTooMany);
      break;
    }
    const check = checkFile(file);
    if (!check.ok) {
      problems.push(`${file.name}: ${check.message}`);
      continue;
    }
    state.files.push({ id: nextId++, file, name: file.name, size: file.size, status: 'pendiente', sent: 0, analysis: null, error: '', url: isImage(file.name) ? URL.createObjectURL(file) : null });
  }
  $('archivos-error').textContent = problems.join(' ');
  renderFiles();
}

function removeFile(id) {
  const item = state.files.find((f) => f.id === id);
  if (item?.url) URL.revokeObjectURL(item.url);
  state.files = state.files.filter((f) => f.id !== id);
  renderFiles();
  $('zona-archivos').focus();
}

function verdictFor(item) {
  const a = item.analysis;
  if (!a) return null;
  if (a.status === 'low') return { kind: 'warn', title: 'Poca resolución para imprimir', text: a.message };
  if (a.status === 'ok') return { kind: 'ok', title: `Calidad suficiente${a.effectiveDpi ? ` (${Math.round(a.effectiveDpi)} dpi)` : ''}`, text: '' };
  return { kind: 'ok', title: 'Recibido', text: 'Lo revisamos en el taller.' };
}

function renderFiles() {
  $('lista-archivos').replaceChildren(
    ...state.files.map((item) => {
      const li = document.createElement('li');
      li.className = 'file';
      li.dataset.id = String(item.id);

      const thumb = document.createElement('div');
      thumb.className = 'thumb';
      thumb.setAttribute('aria-hidden', 'true');
      if (item.url) thumb.style.backgroundImage = `url("${item.url}")`;
      else thumb.textContent = extensionOf(item.name).toUpperCase().slice(0, 4);

      const meta = document.createElement('div');
      meta.className = 'file-meta';
      const name = document.createElement('div');
      name.className = 'file-name';
      name.textContent = item.name;
      const info = document.createElement('div');
      info.className = 'file-info';
      const stateText = { pendiente: 'Listo para enviar', subiendo: `Subiendo… ${Math.round((item.sent / item.size) * 100)} %`, listo: 'Subido', error: item.error }[item.status];
      info.textContent = `${formatBytes(item.size)} · ${stateText}`;
      meta.append(name, info);

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'icon-btn file-remove';
      remove.setAttribute('aria-label', `Quitar ${item.name}`);
      remove.disabled = state.busy || Boolean(state.draft);
      remove.innerHTML = '<svg class="i" aria-hidden="true"><use href="#i-x"/></svg>';
      remove.addEventListener('click', () => removeFile(item.id));

      const top = document.createElement('div');
      top.className = 'file-top';
      top.append(thumb, meta, remove);
      li.append(top);

      const verdict = verdictFor(item);
      if (verdict) {
        const box = document.createElement('div');
        box.className = `verdict verdict-${verdict.kind}`;
        box.append(Object.assign(document.createElement('b'), { textContent: verdict.title }));
        if (verdict.text) box.append(' ', verdict.text);
        li.append(box);
      }
      return li;
    }),
  );
}

function setupDropzone() {
  const zone = $('zona-archivos');
  const input = $('archivos');
  zone.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    addFiles([...input.files]);
    input.value = '';
  });
  for (const type of ['dragenter', 'dragover']) {
    zone.addEventListener(type, (event) => {
      event.preventDefault();
      zone.classList.add('over');
    });
  }
  for (const type of ['dragleave', 'drop']) {
    zone.addEventListener(type, (event) => {
      event.preventDefault();
      zone.classList.remove('over');
    });
  }
  zone.addEventListener('drop', (event) => {
    if (!state.busy && !state.draft) addFiles([...(event.dataTransfer?.files ?? [])]);
  });
}

// ---------------------------------------------------------------------------------------------- Turnstile (anti-robots)

// Ojo: el contenedor NO puede llamarse `turnstile`: los navegadores exponen cada id como `window.<id>`, y un <div> con ese
// id haría creer que la verificación ya está cargada. Por eso se comprueba que sea la función real y no solo que exista.
const turnstileReady = () => typeof window.turnstile?.render === 'function';

function setupTurnstile() {
  const onReady = () => {
    state.turnstileWidget = window.turnstile.render('#verificacion-robots', {
      sitekey: TURNSTILE_SITE_KEY,
      language: 'es',
      callback: (token) => {
        state.turnstileToken = token;
        $('turnstile-error').textContent = '';
      },
      'expired-callback': () => (state.turnstileToken = null),
      'error-callback': () => {
        state.turnstileToken = null;
        $('turnstile-error').textContent = 'No pudimos cargar la verificación anti-robots. Recargá la página o escribinos por WhatsApp.';
      },
    });
  };
  if (turnstileReady()) return onReady();
  const script = document.createElement('script');
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  script.async = true;
  script.onload = onReady;
  script.onerror = () => ($('turnstile-error').textContent = 'No pudimos cargar la verificación anti-robots. Recargá la página o escribinos por WhatsApp.');
  document.head.append(script);
}

/** El token vale una sola vez: después de usarlo (o de un rechazo) hace falta uno nuevo. */
function resetTurnstile() {
  state.turnstileToken = null;
  if (turnstileReady() && state.turnstileWidget !== null) window.turnstile.reset(state.turnstileWidget);
}

// ---------------------------------------------------------------------------------------------- envío

function readFields() {
  return {
    product: state.product?.slug ?? '',
    quantity: $('cantidad').value,
    finishing: $('terminacion').value,
    name: $('nombre').value,
    email: $('email').value,
    whatsapp: $('whatsapp').value,
    notes: $('notas').value,
    consent: $('consentimiento').checked,
    files: state.files.map(({ name, size }) => ({ name, size })),
  };
}

function setBusy(busy) {
  state.busy = busy;
  form.setAttribute('aria-busy', String(busy));
  for (const control of form.querySelectorAll('input, select, textarea, #btn-enviar')) control.disabled = busy;
  $('zona-archivos').disabled = busy || Boolean(state.draft);
  const dialog = $('dialogo-subida');
  if (busy && !dialog.open) dialog.showModal();
  else if (!busy && dialog.open) dialog.close();
  renderFiles();
}

function updateProgress() {
  const total = state.files.reduce((sum, f) => sum + f.size, 0);
  const sent = state.files.reduce((sum, f) => sum + (f.status === 'listo' ? f.size : f.sent), 0);
  const percent = total ? Math.round((sent / total) * 100) : 0;
  $('barra').value = percent;
  $('progreso-texto').textContent = `Subiendo ${formatBytes(sent)} de ${formatBytes(total)} (${percent} %)`;
}

const waitText = (seconds) => (seconds ? ` Probá de nuevo en unos ${Math.max(1, Math.ceil(seconds / 60))} minutos.` : '');

/** Traduce un error del servidor a algo que se pueda hacer: corregir un campo, esperar o reintentar. */
function handleError(error) {
  const info = error instanceof ApiError ? error.info : { kind: 'unknown', message: MESSAGES.unknown };
  $('acciones-error').hidden = true;

  switch (info.kind) {
    case 'validation': {
      state.draft = null;
      resetTurnstile();
      showErrors(info.fields);
      setStatus(info.message);
      break;
    }
    case 'antibot':
      resetTurnstile();
      $('turnstile-error').textContent = 'No pudimos verificar que no seas un robot. Probá de nuevo.';
      break;
    case 'rate-limit':
      resetTurnstile();
      setStatus(`${info.message}${info.retryAfter ? waitText(info.retryAfter) : ''}`);
      break;
    case 'file-rejected': {
      // El pedido ya existe en el servidor con ese archivo: hay que quitarlo y mandar uno nuevo.
      const bad = state.files.find((f) => f.status === 'subiendo');
      if (bad) Object.assign(bad, { status: 'error', error: info.message });
      state.draft = null;
      resetTurnstile();
      setStatus(`${info.message} Quitá ese archivo y volvé a enviar el pedido.`);
      break;
    }
    case 'expired':
    case 'not-found':
      state.draft = null;
      for (const f of state.files) Object.assign(f, { status: 'pendiente', sent: 0, analysis: null });
      resetTurnstile();
      setStatus('El pedido quedó sin actividad y se cerró. Volvé a enviarlo y empezamos de nuevo.');
      break;
    case 'storage':
      setStatus(info.message);
      $('acciones-error').hidden = false;
      break;
    case 'incomplete':
    case 'network':
    case 'unavailable':
    default:
      setStatus(info.message || MESSAGES.unknown);
      $('acciones-error').hidden = !state.draft;
  }
  const failing = state.files.find((f) => f.status === 'subiendo');
  if (failing && failing.status !== 'error') failing.status = 'pendiente';
  renderFiles();
}

async function send() {
  setBusy(true);
  setStatus('');
  $('acciones-error').hidden = true;
  try {
    if (!state.draft) {
      state.fields = readFields();
      state.draft = await createDraft({ fetchImpl, payload: buildDraftPayload(state.fields, state.turnstileToken) });
      resetTurnstile(); // el token ya se gastó
      $('zona-archivos').disabled = true;
    }
    for (const [index, item] of state.files.entries()) {
      if (item.status === 'listo') continue;
      item.status = 'subiendo';
      item.sent = 0;
      const { analysis } = await uploadFile({
        fetchImpl,
        uploadToken: state.draft.files[index].uploadToken,
        file: item.file,
        chunkSize: state.draft.chunkSize,
        onProgress: (sent) => {
          item.sent = sent;
          updateProgress();
          renderFiles();
        },
      });
      Object.assign(item, { status: 'listo', sent: item.size, analysis });
      updateProgress();
      renderFiles();
    }
    const order = await finalizeOrder({ fetchImpl, draftToken: state.draft.draftToken });
    showDone(order);
  } catch (error) {
    handleError(error);
  } finally {
    if (!$('pedido-listo').hidden) return;
    setBusy(false);
    if (state.draft) $('zona-archivos').disabled = true;
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (state.busy) return;
  clearErrors();
  const result = validateOrder(readFields());
  if (!result.ok) {
    showErrors(result.errors);
    setStatus('Revisá los campos marcados.');
    focusField(result.firstInvalid);
    return;
  }
  if (!state.turnstileToken) {
    $('turnstile-error').textContent = 'Completá la verificación anti-robots para enviar el pedido.';
    return;
  }
  send();
});

$('btn-reintentar').addEventListener('click', () => {
  clearErrors();
  send();
});

// ---------------------------------------------------------------------------------------------- pantalla final

function showDone({ orderNo, needsReview }) {
  const f = state.fields;
  const lines = [
    ['Producto', state.product?.name],
    ['Cantidad', f.quantity.trim()],
    ['Terminación', f.finishing || null],
    ['Archivos', state.files.length === 1 ? state.files[0].name : `${state.files.length} archivos`],
  ].filter(([, value]) => value);
  $('resumen').replaceChildren(
    ...lines.flatMap(([label, value]) => [Object.assign(document.createElement('dt'), { textContent: label }), Object.assign(document.createElement('dd'), { textContent: value })]),
  );
  $('numero-pedido').textContent = orderNo;
  $('aviso-revision').hidden = !needsReview;
  $('btn-wa-listo').href = `${WHATSAPP}?text=${encodeURIComponent(`Hola! Hice el pedido ${orderNo} en la web.`)}`;
  $('dialogo-subida').close();
  form.hidden = true;
  $('pedido-intro').hidden = true; // el pedido ya está enviado: la bienvenida y el consejo del original sobran
  $('pedido-aviso').hidden = true;
  $('pedido-listo').hidden = false;
  $('pedido-listo').focus();
  window.scrollTo({ top: 0 });
}

$('btn-otro').addEventListener('click', () => location.reload());

// ---------------------------------------------------------------------------------------------- arranque

for (const id of Object.values(INPUT_IDS)) {
  $(id).addEventListener('input', () => {
    $(id).removeAttribute('aria-invalid');
    const error = $(ERROR_IDS[Object.keys(INPUT_IDS).find((key) => INPUT_IDS[key] === id)]);
    if (error) error.textContent = '';
    if (id === 'email' || id === 'whatsapp') $('contacto-error').textContent = '';
  });
}
$('notas').addEventListener('input', () => ($('notas-contador').textContent = `${$('notas').value.length} / ${LIMITS.notes}`));

// El diálogo de subida no se cierra con Escape: solo lo cierra el final de la subida (con éxito o con error).
$('dialogo-subida').addEventListener('cancel', (event) => event.preventDefault());

// Mientras se sube, cerrar la pestaña cortaría la subida: se le avisa a la persona.
window.addEventListener('beforeunload', (event) => {
  if (state.busy) event.preventDefault();
});

setupDropzone();
setupTurnstile();
loadCatalog();
