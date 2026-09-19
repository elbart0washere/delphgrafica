import { describe, it, expect } from 'vitest';
import {
  LIMITS,
  MESSAGES,
  WHATSAPP_NUMBER,
  buildMessage,
  buildWhatsAppUrl,
  counterText,
  pasteOverflows,
  validate,
} from '../../js/form-logic.js';

const valid = { name: 'Lucía', email: 'lucia@mail.com', phone: '', description: 'Necesito 50 lonas de 2x1' };

const textOf = (url) => decodeURIComponent(url.split('?text=')[1]);

describe('límites (regla 3)', () => {
  it('son los de la spec', () => {
    expect(LIMITS).toEqual({ name: 60, email: 100, phone: 30, description: 500 });
  });
});

describe('mensaje de cotización (reglas 5 y 6)', () => {
  it('US1-S1: con nombre, email y descripción incluye el email y no el teléfono', () => {
    expect(buildMessage(valid)).toBe(
      '¡Hola, Gráfica Delph! Soy Lucía. Quiero cotizar un proyecto:\n\n' +
        'Necesito 50 lonas de 2x1\n\n' +
        'Mis datos de contacto:\n- Email: lucia@mail.com',
    );
  });

  it('US1-S2: con solo teléfono incluye el teléfono y no el email', () => {
    const message = buildMessage({ ...valid, email: '', phone: '11 5555-1234' });
    expect(message).toContain('- Teléfono: 11 5555-1234');
    expect(message).not.toContain('Email');
  });

  it('con email y teléfono incluye las dos líneas, en ese orden', () => {
    const message = buildMessage({ ...valid, phone: '11 5555-1234' });
    expect(message.endsWith('- Email: lucia@mail.com\n- Teléfono: 11 5555-1234')).toBe(true);
  });

  it('recorta espacios de los extremos y normaliza los saltos de línea', () => {
    const message = buildMessage({ ...valid, name: '  Lucía ', description: ' hola\r\nchau ' });
    expect(message).toContain('Soy Lucía.');
    expect(message).toContain('\n\nhola\nchau\n\n');
  });

  it('la URL usa el número del taller y encodeURIComponent', () => {
    expect(WHATSAPP_NUMBER).toBe('5491172394787');
    const url = buildWhatsAppUrl('Hola & chau');
    expect(url).toBe('https://wa.me/5491172394787?text=Hola%20%26%20chau');
  });

  it('US1-S8: tildes, saltos de línea, emojis, &, ? y # llegan íntegros', () => {
    const description = 'Cartelería: ¿50 lonas? Tamaño 2x1 & luz #3 😀\nSegunda línea…';
    const url = buildWhatsAppUrl(buildMessage({ ...valid, description }));
    expect(url.split('?')).toHaveLength(2);
    expect(url).not.toMatch(/[&#]/);
    expect(textOf(url)).toContain(description);
  });
});

describe('validación (regla 2)', () => {
  it('acepta datos válidos con email', () => {
    expect(validate(valid)).toEqual({ ok: true, errors: {}, firstInvalid: null });
  });

  it('acepta datos válidos con solo teléfono', () => {
    expect(validate({ ...valid, email: '', phone: '+54 9 11 7239-4787' }).ok).toBe(true);
  });

  it('US1-S3: sin email ni teléfono pide un dato de contacto y manda el foco al email', () => {
    const result = validate({ ...valid, email: '', phone: '' });
    expect(result.ok).toBe(false);
    expect(result.errors.contact).toBe('Dejanos al menos un dato de contacto: email o teléfono');
    expect(result.firstInvalid).toBe('email');
  });

  it('US1-S4: nombre vacío o de solo espacios es inválido y va primero', () => {
    for (const name of ['', '   ']) {
      const result = validate({ ...valid, name });
      expect(result.ok).toBe(false);
      expect(result.errors.name).toBe(MESSAGES.nameRequired);
      expect(result.firstInvalid).toBe('name');
    }
  });

  it('descripción vacía o de solo espacios es inválida', () => {
    const result = validate({ ...valid, description: '  \n ' });
    expect(result.errors.description).toBe(MESSAGES.descriptionRequired);
    expect(result.firstInvalid).toBe('description');
  });

  it('US1-S5: email sin formato válido es inválido aunque el teléfono esté bien', () => {
    for (const email of ['lucia@', 'lucia', '@mail.com', 'lu cia@mail.com', 'lucía@mail.com']) {
      const result = validate({ ...valid, email, phone: '11 5555-1234' });
      expect(result.errors.email, email).toBe(MESSAGES.emailInvalid);
      expect(result.firstInvalid).toBe('email');
    }
  });

  it('US1-S5: teléfono con letras es inválido aunque el email esté bien', () => {
    const result = validate({ ...valid, phone: '11 abcd-1234' });
    expect(result.errors.phone).toBe(MESSAGES.phoneInvalid);
    expect(result.firstInvalid).toBe('phone');
  });

  it('teléfono: entre 8 y 15 dígitos, con espacios, guiones, paréntesis y un + inicial', () => {
    const ok = ['11 5555-1234', '(011) 5555 1234', '+54 9 11 7239-4787', '12345678', '123456789012345'];
    const bad = ['1234567', '1234567890123456', '11++5555-1234', '11 5555-1234 x'];
    for (const phone of ok) expect(validate({ ...valid, email: '', phone }).ok, phone).toBe(true);
    for (const phone of bad) expect(validate({ ...valid, email: '', phone }).ok, phone).toBe(false);
  });

  it('el primer campo inválido sigue el orden del formulario', () => {
    const result = validate({ name: '', email: 'x', phone: 'abc', description: '' });
    expect(result.firstInvalid).toBe('name');
    expect(Object.keys(result.errors)).toEqual(['name', 'email', 'phone', 'description']);
  });

  it('un campo por encima de su tope es inválido y no se recorta en silencio (regla 4)', () => {
    const result = validate({ ...valid, description: 'a'.repeat(LIMITS.description + 1) });
    expect(result.errors.description).toBe(MESSAGES.descriptionTooLong);
  });
});

describe('tope de la descripción (regla 4)', () => {
  it('US1-S6: llegar al tope muestra el contador lleno y el aviso de límite', () => {
    expect(counterText(0)).toBe('0 / 500');
    expect(counterText(LIMITS.description)).toBe('500 / 500');
    expect(MESSAGES.limitReached).toBe('Llegaste al límite. Resumí tu pedido y mandanos el detalle por WhatsApp.');
  });

  it('US1-S7: pegar más de lo que entra se detecta y tiene su aviso', () => {
    expect(pasteOverflows({ currentLength: 480, selectedLength: 0, pastedLength: 21 })).toBe(true);
    expect(pasteOverflows({ currentLength: 480, selectedLength: 0, pastedLength: 20 })).toBe(false);
    expect(pasteOverflows({ currentLength: 480, selectedLength: 10, pastedLength: 30 })).toBe(false);
    expect(pasteOverflows({ currentLength: 0, selectedLength: 0, pastedLength: 501 })).toBe(true);
    expect(MESSAGES.pasteTruncated).toBe(
      'Pegaste más de 500 caracteres, así que recortamos el texto. Revisalo y mandanos el detalle por WhatsApp.',
    );
  });

  it('US1-S9: el aviso posterior al envío tiene el texto de la spec', () => {
    expect(MESSAGES.opened).toBe('Se abrió WhatsApp con tu consulta. Si no se abrió, tocá acá.');
  });
});

describe('peor caso de la URL (regla 7)', () => {
  it('con todos los campos al máximo y caracteres de 3 bytes no supera 6000 caracteres', () => {
    const worst = {
      name: '—'.repeat(LIMITS.name),
      email: '+'.repeat(LIMITS.email),
      // Los extremos no pueden ser espacios: el mensaje recorta el teléfono y perdería la línea.
      phone: `1${' '.repeat(LIMITS.phone - 2)}1`,
      description: '…'.repeat(LIMITS.description),
    };
    const url = buildWhatsAppUrl(buildMessage(worst));
    expect(url.length).toBeLessThanOrEqual(6000);
    // Si baja de acá, el fixture dejó de ser el peor caso (por ejemplo, un campo se recortó a vacío).
    expect(url.length).toBeGreaterThan(5500);
  });
});
