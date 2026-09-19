// Lógica pura del formulario de cotización: sin DOM, para poder probarla sola.

export const WHATSAPP_NUMBER = '5491172394787';

export const LIMITS = { name: 60, email: 100, phone: 30, description: 500 };

const PHONE_DIGITS = { min: 8, max: 15 };

// Solo ASCII a propósito: cada carácter no ASCII se codifica a hasta 9 caracteres en la URL de WhatsApp,
// y el techo de 6000 caracteres (regla 7) se calculó con un email ASCII.
const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
const PHONE_PATTERN = /^\+?[\d\s\-()]+$/;

export const MESSAGES = {
  nameRequired: 'Contanos tu nombre.',
  nameTooLong: `El nombre puede tener hasta ${LIMITS.name} caracteres.`,
  emailInvalid: 'Ingresá un email válido, por ejemplo nombre@dominio.com.',
  phoneInvalid: 'Ingresá un teléfono válido: solo números, con o sin código de área.',
  contactRequired: 'Dejanos al menos un dato de contacto: email o teléfono',
  descriptionRequired: 'Contanos brevemente qué necesitás.',
  descriptionTooLong: `La descripción puede tener hasta ${LIMITS.description} caracteres.`,
  limitReached: 'Llegaste al límite. Resumí tu pedido y mandanos el detalle por WhatsApp.',
  pasteTruncated: `Pegaste más de ${LIMITS.description} caracteres, así que recortamos el texto. Revisalo y mandanos el detalle por WhatsApp.`,
  opened: 'Se abrió WhatsApp con tu consulta. Si no se abrió, tocá acá.',
};

const clean = (value) => String(value ?? '').replace(/\r\n?/g, '\n').trim();

export function normalize(fields) {
  return {
    name: clean(fields.name),
    email: clean(fields.email),
    phone: clean(fields.phone),
    description: clean(fields.description),
  };
}

export function counterText(length) {
  return `${length} / ${LIMITS.description}`;
}

/** ¿Pegar este texto pasaría el tope? El navegador recortaría en silencio, así que hay que avisar. */
export function pasteOverflows({ currentLength, selectedLength, pastedLength, max = LIMITS.description }) {
  return currentLength - selectedLength + pastedLength > max;
}

/**
 * Valida los cuatro campos. `firstInvalid` sigue el orden del formulario (nombre, email, teléfono,
 * descripción); si falta todo contacto, el error se muestra aparte (`contact`) y el foco va al email.
 */
export function validate(fields) {
  const { name, email, phone, description } = normalize(fields);
  const errors = {};
  const invalid = [];

  if (!name) errors.name = MESSAGES.nameRequired;
  else if (name.length > LIMITS.name) errors.name = MESSAGES.nameTooLong;
  if (errors.name) invalid.push('name');

  if (email && (email.length > LIMITS.email || !EMAIL_PATTERN.test(email))) {
    errors.email = MESSAGES.emailInvalid;
    invalid.push('email');
  }

  const digits = phone.replace(/\D/g, '').length;
  if (phone && (phone.length > LIMITS.phone || !PHONE_PATTERN.test(phone) || digits < PHONE_DIGITS.min || digits > PHONE_DIGITS.max)) {
    errors.phone = MESSAGES.phoneInvalid;
    invalid.push('phone');
  }

  if (!email && !phone) {
    errors.contact = MESSAGES.contactRequired;
    invalid.splice(invalid.includes('name') ? 1 : 0, 0, 'email');
  }

  if (!description) errors.description = MESSAGES.descriptionRequired;
  else if (description.length > LIMITS.description) errors.description = MESSAGES.descriptionTooLong;
  if (errors.description) invalid.push('description');

  return { ok: invalid.length === 0, errors, firstInvalid: invalid[0] ?? null };
}

export function buildMessage(fields) {
  const { name, email, phone, description } = normalize(fields);
  const contact = [email && `- Email: ${email}`, phone && `- Teléfono: ${phone}`].filter(Boolean);

  return [
    `¡Hola, Gráfica Delph! Soy ${name}. Quiero cotizar un proyecto:`,
    description,
    ['Mis datos de contacto:', ...contact].join('\n'),
  ].join('\n\n');
}

export function buildWhatsAppUrl(message) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
