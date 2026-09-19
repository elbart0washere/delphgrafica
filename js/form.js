// Comportamiento del formulario de cotización: conecta el DOM con la lógica pura de form-logic.js.
import { LIMITS, MESSAGES, buildMessage, buildWhatsAppUrl, counterText, pasteOverflows, validate } from './form-logic.js';

const FIELDS = {
  name: 'nombre',
  email: 'email',
  phone: 'telefono',
  description: 'descripcion',
};

export function initForm(form = document.querySelector('#form-cotizar')) {
  if (!form) return;

  const $ = (id) => form.querySelector(`#${id}`);
  const description = $(FIELDS.description);
  const counter = $('descripcion-contador');
  const notice = $('descripcion-aviso');
  const status = $('estado');

  const readFields = () =>
    Object.fromEntries(Object.entries(FIELDS).map(([key, id]) => [key, $(id).value]));

  const clearErrors = () => {
    for (const id of Object.values(FIELDS)) {
      $(id).removeAttribute('aria-invalid');
      $(`${id}-error`).textContent = '';
    }
    $('contacto-error').textContent = '';
  };

  const showErrors = ({ errors }) => {
    for (const [key, id] of Object.entries(FIELDS)) {
      if (!errors[key]) continue;
      $(id).setAttribute('aria-invalid', 'true');
      $(`${id}-error`).textContent = errors[key];
    }
    if (errors.contact) {
      $(FIELDS.email).setAttribute('aria-invalid', 'true');
      $(FIELDS.phone).setAttribute('aria-invalid', 'true');
      $('contacto-error').textContent = errors.contact;
    }
  };

  const showOpened = (url) => {
    const [before] = MESSAGES.opened.split('tocá acá');
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.className = 'font-semibold underline';
    link.textContent = 'tocá acá';
    status.replaceChildren(before, link, '.');
  };

  // Un pegado que no entra: el navegador lo recorta solo (maxlength), así que el aviso lo damos nosotros.
  let pasted = false;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const fields = readFields();
    const result = validate(fields);

    clearErrors();
    status.replaceChildren();
    if (!result.ok) {
      showErrors(result);
      $(FIELDS[result.firstInvalid]).focus();
      return;
    }

    const url = buildWhatsAppUrl(buildMessage(fields));
    window.open(url, '_blank', 'noopener');
    showOpened(url);
  });

  form.addEventListener('input', (event) => {
    const id = event.target.id;
    if (id === FIELDS.email || id === FIELDS.phone) $('contacto-error').textContent = '';
    if ($(`${id}-error`)) {
      $(`${id}-error`).textContent = '';
      event.target.removeAttribute('aria-invalid');
    }
  });

  description.addEventListener('input', () => {
    const length = description.value.length;
    counter.textContent = counterText(length);
    if (pasted && length >= LIMITS.description) return; // conserva el aviso de recorte
    notice.textContent = length >= LIMITS.description ? MESSAGES.limitReached : '';
  });

  description.addEventListener('paste', (event) => {
    const text = event.clipboardData?.getData('text') ?? '';
    const overflows = pasteOverflows({
      currentLength: description.value.length,
      selectedLength: description.selectionEnd - description.selectionStart,
      pastedLength: text.length,
    });
    if (!overflows) return;

    notice.textContent = MESSAGES.pasteTruncated;
    pasted = true;
    setTimeout(() => {
      pasted = false;
    });
  });

  counter.textContent = counterText(description.value.length);
}
