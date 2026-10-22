// Lógica pura del formulario de pedidos: sin DOM ni red, para poder probarla sola.
// Las reglas espejan las del servidor (sistema de pedidos) para avisar ANTES de subir un archivo de 300 MB;
// el servidor vuelve a validar todo, así que acá nada es una garantía de seguridad, solo comodidad.

export const API_BASE = 'https://pedidos.delphgrafica.com.ar';
// Clave PÚBLICA del widget de Turnstile (anti-robots). La clave secreta vive solo en el servidor.
export const TURNSTILE_SITE_KEY = '0x4AAAAAAFYzRXtk3bd5MPXz';

export const MiB = 1024 * 1024;
export const LIMITS = {
  name: 100,
  email: 254,
  whatsapp: 25,
  finishing: 100,
  notes: 1000,
  files: 5,
  fileBytes: 300 * MiB,
  totalBytes: 800 * MiB,
  quantity: 1_000_000,
};

export const MESSAGES = {
  product: 'Elegí qué querés imprimir.',
  quantity: 'Ingresá una cantidad entera, de 1 en adelante.',
  quantityMax: `La cantidad máxima es ${LIMITS.quantity.toLocaleString('es-AR')}.`,
  nameRequired: 'Contanos tu nombre.',
  nameTooLong: `El nombre puede tener hasta ${LIMITS.name} caracteres.`,
  email: 'Ingresá un email válido, por ejemplo nombre@dominio.com.',
  whatsapp: 'Ingresá un WhatsApp válido: solo números, con código de área.',
  contact: 'Dejanos al menos un dato de contacto: email o WhatsApp.',
  finishingTooLong: `La terminación puede tener hasta ${LIMITS.finishing} caracteres.`,
  notesTooLong: `Las aclaraciones pueden tener hasta ${LIMITS.notes} caracteres.`,
  consent: 'Tenés que aceptar la política de privacidad para enviar el pedido.',
  filesNone: 'Elegí al menos un archivo.',
  filesTooMany: `Podés subir hasta ${LIMITS.files} archivos por pedido.`,
  fileTooBig: 'Cada archivo puede pesar hasta 300 MB.',
  fileEmpty: 'Ese archivo está vacío.',
  filesTotal: 'Entre todos los archivos no pueden pasar los 800 MB.',
  unknown: 'Algo salió mal. Probá de nuevo en unos minutos o escribinos por WhatsApp.',
};

// ---------------------------------------------------------------------------------------------- tamaños

export function formatBytes(bytes) {
  if (bytes < MiB) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const mb = bytes / MiB;
  return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1).replace('.', ',')} MB`;
}

// ---------------------------------------------------------------------------------------------- archivos

const ACCEPTED = ['jpg', 'jpeg', 'png', 'tif', 'tiff', 'pdf'];
const ACCEPTED_TEXT = 'JPG, PNG, TIFF o PDF';

const REJECTED_GUIDE = {
  cdr: 'Los archivos CDR (CorelDRAW) no se pueden usar directamente. Exportalo a PDF desde CorelDRAW: Archivo > Publicar como PDF, y subí el PDF.',
  ai: 'Los archivos AI (Illustrator) no se pueden usar directamente. Exportalo a PDF desde Illustrator: Archivo > Guardar como > Adobe PDF, y subí el PDF.',
  psd: 'Los archivos PSD (Photoshop) no se pueden usar directamente. Guardalo como TIFF o JPG en calidad máxima, o como PDF, desde Photoshop: Archivo > Guardar como, y subí ese archivo.',
  eps: 'Los archivos EPS no se pueden usar directamente. Exportalo o guardalo como PDF desde tu programa de diseño y subí el PDF.',
};

const extensionOf = (name) => {
  const i = String(name).lastIndexOf('.');
  return i === -1 ? '' : name.slice(i + 1).trim().toLowerCase();
};

/** Chequeo barato antes de subir: formato por nombre y tamaño. El formato real lo decide el servidor por el contenido. */
export function checkFile({ name, size }) {
  const ext = extensionOf(name);
  if (REJECTED_GUIDE[ext]) return { ok: false, message: REJECTED_GUIDE[ext] };
  if (!ACCEPTED.includes(ext)) return { ok: false, message: `Ese tipo de archivo no se acepta. Subí un archivo ${ACCEPTED_TEXT}.` };
  if (!(size > 0)) return { ok: false, message: MESSAGES.fileEmpty };
  if (size > LIMITS.fileBytes) return { ok: false, message: MESSAGES.fileTooBig };
  return { ok: true };
}

// ---------------------------------------------------------------------------------------------- validación

const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
const WHATSAPP_PATTERN = /^\+?[\d\s\-()]+$/;
const DIGITS = { min: 8, max: 15 };

// Orden del formulario: de ahí sale a qué campo se lleva el foco cuando hay errores.
const ORDER = ['product', 'quantity', 'finishing', 'files', 'name', 'email', 'whatsapp', 'notes', 'consent'];

/**
 * Valida el pedido completo. `firstInvalid` es el primer campo con error según el orden del formulario;
 * si falta todo contacto, el error se muestra aparte (`contact`) y el foco va al email.
 */
export function validateOrder(fields) {
  const errors = {};

  if (!String(fields.product ?? '').trim()) errors.product = MESSAGES.product;

  const quantityText = String(fields.quantity ?? '').trim();
  if (!/^\d+$/.test(quantityText) || Number(quantityText) < 1) errors.quantity = MESSAGES.quantity;
  else if (Number(quantityText) > LIMITS.quantity) errors.quantity = MESSAGES.quantityMax;

  if (String(fields.finishing ?? '').trim().length > LIMITS.finishing) errors.finishing = MESSAGES.finishingTooLong;

  const files = fields.files ?? [];
  if (files.length === 0) errors.files = MESSAGES.filesNone;
  else if (files.length > LIMITS.files) errors.files = MESSAGES.filesTooMany;
  else {
    files.forEach((f, i) => {
      const check = checkFile(f);
      if (!check.ok) errors[`files.${i}`] = check.message;
    });
    if (files.reduce((sum, f) => sum + f.size, 0) > LIMITS.totalBytes) errors.files = MESSAGES.filesTotal;
  }

  const name = String(fields.name ?? '').trim();
  if (!name) errors.name = MESSAGES.nameRequired;
  else if (name.length > LIMITS.name) errors.name = MESSAGES.nameTooLong;

  const email = String(fields.email ?? '').trim();
  const whatsapp = String(fields.whatsapp ?? '').trim();
  if (email && (email.length > LIMITS.email || !EMAIL_PATTERN.test(email))) errors.email = MESSAGES.email;
  const digits = whatsapp.replace(/\D/g, '').length;
  if (whatsapp && (whatsapp.length > LIMITS.whatsapp || !WHATSAPP_PATTERN.test(whatsapp) || digits < DIGITS.min || digits > DIGITS.max)) {
    errors.whatsapp = MESSAGES.whatsapp;
  }
  if (!email && !whatsapp) errors.contact = MESSAGES.contact;

  if (String(fields.notes ?? '').trim().length > LIMITS.notes) errors.notes = MESSAGES.notesTooLong;
  if (fields.consent !== true) errors.consent = MESSAGES.consent;

  const fieldOf = (key) => (key === 'contact' ? 'email' : key.startsWith('files') ? 'files' : key);
  const firstInvalid = ORDER.find((candidate) => Object.keys(errors).some((key) => fieldOf(key) === candidate)) ?? null;
  return { ok: Object.keys(errors).length === 0, errors, firstInvalid };
}

// ---------------------------------------------------------------------------------------------- pedido al servidor

/** Cuerpo de `POST /api/v1/drafts`: solo los datos que la persona completó. */
export function buildDraftPayload(fields, turnstileToken) {
  const text = (value) => String(value ?? '').trim();
  const body = {
    turnstileToken,
    consent: true,
    product: text(fields.product),
    quantity: Number(text(fields.quantity)),
    name: text(fields.name),
    files: (fields.files ?? []).map(({ name, size }) => ({ name, size })),
  };
  for (const key of ['finishing', 'email', 'whatsapp', 'notes']) if (text(fields[key])) body[key] = text(fields[key]);
  return body;
}

// ---------------------------------------------------------------------------------------------- tramos

/** Tramos `[start, end]` (fin inclusive) para subir un archivo de `total` bytes, a partir de `from`. */
export function planChunks(total, chunkSize, from = 0) {
  if (!(Number.isInteger(total) && total >= 0) || !(Number.isInteger(chunkSize) && chunkSize > 0) || !(Number.isInteger(from) && from >= 0 && from <= total)) {
    throw new RangeError('Parámetros de tramos inválidos');
  }
  const chunks = [];
  for (let start = from; start < total; start += chunkSize) chunks.push({ start, end: Math.min(start + chunkSize, total) - 1 });
  return chunks;
}

export const contentRange = (start, end, total) => `bytes ${start}-${end}/${total}`;

// ---------------------------------------------------------------------------------------------- errores del servidor

const FIELD_NAMES = { widthMm: 'width', heightMm: 'height' };

const header = (headers, name) => (typeof headers?.get === 'function' ? headers.get(name) : headers?.[name]) ?? null;
const seconds = (value) => (value !== null && Number.isFinite(Number(value)) ? Number(value) : undefined);

/**
 * Traduce una respuesta de error del servidor a algo que la pantalla sepa mostrar. Nunca devuelve detalles técnicos:
 * ante una falla de almacenamiento solo viaja el mensaje del servidor y el código `E-XXXX`, nada más.
 */
export function describeApiError(status, body, headers = {}) {
  const b = body && typeof body === 'object' ? body : {};
  const message = typeof b.message === 'string' ? b.message : MESSAGES.unknown;
  const retryAfter = seconds(header(headers, 'retry-after'));

  if (status === 422 && b.error === 'validacion') {
    const fields = Object.fromEntries(Object.entries(b.fields ?? {}).map(([key, text]) => [FIELD_NAMES[key] ?? key, text]));
    return { kind: 'validation', message, fields };
  }
  if (status === 422 && b.error === 'archivo_invalido') return { kind: 'file-rejected', message, code: b.code };
  if (status === 403 && b.error === 'antibot') return { kind: 'antibot', message };
  if (status === 429) return { kind: 'rate-limit', message, retryAfter };
  if (status === 503 && b.error === 'almacenamiento') return { kind: 'storage', message, code: b.code };
  if (status === 503 && b.error === 'ocupado') return { kind: 'busy', message, retryAfter: retryAfter ?? 2 };
  if (status === 503) return { kind: 'unavailable', message: MESSAGES.unknown, retryAfter };
  if (status === 409 && b.error === 'offset') return { kind: 'offset', message, expected: b.expected };
  if (status === 409 && b.error === 'incompleto') return { kind: 'incomplete', message, pending: b.pending ?? [] };
  if (status === 409 && b.error === 'ocupado') return { kind: 'busy', message, retryAfter: 1 };
  if (status === 409 && b.error === 'completo') return { kind: 'already-complete', message };
  if (status === 410) return { kind: 'expired', message };
  if (status === 404) return { kind: 'not-found', message };
  return { kind: 'unknown', message: MESSAGES.unknown };
}
