import { describe, it, expect } from 'vitest';
import {
  API_BASE,
  LIMITS,
  MiB,
  buildDraftPayload,
  checkFile,
  contentRange,
  describeApiError,
  formatBytes,
  planChunks,
  validateOrder,
} from '../../js/pedido-logic.js';

const file = (name = 'arte.jpg', size = 1_000_000) => ({ name, size });
const valid = (over = {}) => ({
  product: 'tarjetas',
  quantity: '500',
  finishing: 'Ojales y bolsillo',
  notes: '',
  name: 'María Pérez',
  email: 'maria@example.com',
  whatsapp: '',
  consent: true,
  files: [file()],
  ...over,
});

describe('tamaños', () => {
  it('formatBytes usa MB con coma (sin decimales cuando son grandes) y KB para lo chico', () => {
    expect(formatBytes(1_300_000)).toBe('1,2 MB');
    expect(formatBytes(1_048_576)).toBe('1,0 MB');
    expect(formatBytes(300 * MiB)).toBe('300 MB');
    expect(formatBytes(900)).toBe('1 KB'); // lo chico se muestra en KB: "0,0 MB" no le dice nada a nadie
    expect(formatBytes(50 * 1024)).toBe('50 KB');
  });
});

describe('archivos: se mira el nombre antes de subir nada (la decisión final la toma el servidor por el contenido)', () => {
  it.each(['a.jpg', 'a.JPEG', 'a.png', 'a.tif', 'a.tiff', 'a.pdf', 'mi foto final.JPG'])('acepta %s', (name) => {
    expect(checkFile(file(name))).toEqual({ ok: true });
  });

  it.each([
    ['logo.cdr', /CorelDRAW/],
    ['logo.ai', /Illustrator/],
    ['foto.psd', /Photoshop/],
    ['arte.eps', /PDF/],
  ])('%s se rechaza con la guía para exportar a PDF', (name, guide) => {
    const r = checkFile(file(name));
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(guide);
    expect(r.message).toMatch(/PDF/);
  });

  it('una extensión desconocida o ausente se rechaza listando los formatos aceptados', () => {
    for (const name of ['virus.exe', 'cosas.zip', 'sinextension', '.jpg.exe']) {
      const r = checkFile(file(name));
      expect(r.ok, name).toBe(false);
      expect(r.message).toMatch(/JPG.*PNG.*TIFF.*PDF/);
    }
  });

  it('rechaza archivos vacíos y los que superan 300 MB', () => {
    expect(checkFile(file('a.jpg', 0)).ok).toBe(false);
    expect(checkFile(file('a.jpg', 300 * MiB)).ok).toBe(true);
    const grande = checkFile(file('a.jpg', 300 * MiB + 1));
    expect(grande.ok).toBe(false);
    expect(grande.message).toMatch(/300 MB/);
  });
});

describe('validar el pedido (mismas reglas que el servidor, para avisar antes de subir)', () => {
  it('un pedido completo es válido', () => {
    const r = validateOrder(valid());
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual({});
    expect(r.firstInvalid).toBeNull();
  });

  it('con solo WhatsApp o solo email alcanza', () => {
    expect(validateOrder(valid({ email: '', whatsapp: '+54 9 11 5555-1234' })).ok).toBe(true);
    expect(validateOrder(valid({ email: 'a@b.co', whatsapp: '' })).ok).toBe(true);
  });

  it('sin ningún dato de contacto: un solo error de contacto, y el foco va al email', () => {
    const r = validateOrder(valid({ email: '', whatsapp: '' }));
    expect(r.ok).toBe(false);
    expect(r.errors.contact).toMatch(/email o WhatsApp/);
    expect(r.firstInvalid).toBe('email');
  });

  it('exige el consentimiento de privacidad', () => {
    const r = validateOrder(valid({ consent: false }));
    expect(r.errors.consent).toMatch(/política de privacidad/);
    expect(r.firstInvalid).toBe('consent');
  });

  it.each([
    ['name', { name: '' }],
    ['name', { name: '   ' }],
    ['name', { name: 'x'.repeat(101) }],
    ['product', { product: '' }],
    ['quantity', { quantity: '' }],
    ['quantity', { quantity: '0' }],
    ['quantity', { quantity: '2,5' }],
    ['quantity', { quantity: '1000001' }],
    ['email', { email: 'no-es-un-mail' }],
    ['email', { email: 'a b@c.com' }],
    ['whatsapp', { email: 'a@b.co', whatsapp: '12' }],
    ['whatsapp', { email: 'a@b.co', whatsapp: 'hola' }],
    ['notes', { notes: 'x'.repeat(1001) }],
    ['finishing', { finishing: 'x'.repeat(101) }],
  ])('campo %s inválido con %j', (field, over) => {
    const r = validateOrder(valid(over));
    expect(r.ok).toBe(false);
    expect(r.errors[field], JSON.stringify(r.errors)).toBeTruthy();
  });

  it('no pide medidas: el taller las toma del archivo', () => {
    const r = validateOrder(valid());
    expect(r.ok).toBe(true);
    expect(r.errors).not.toHaveProperty('width');
    expect(r.errors).not.toHaveProperty('height');
  });

  it('los límites de archivos: al menos 1, hasta 5, y 800 MB en total', () => {
    expect(validateOrder(valid({ files: [] })).errors.files).toMatch(/al menos un archivo/);
    const seis = Array.from({ length: 6 }, (_, i) => file(`a${i}.jpg`));
    expect(validateOrder(valid({ files: seis })).errors.files).toMatch(/hasta 5 archivos/);
    const tres = [file('a.tif', 300 * MiB), file('b.tif', 300 * MiB), file('c.tif', 201 * MiB)];
    expect(validateOrder(valid({ files: tres })).errors.files).toMatch(/800 MB/);
  });

  it('un archivo con formato no aceptado marca ESE archivo, con su guía', () => {
    const r = validateOrder(valid({ files: [file('ok.jpg'), file('logo.cdr')] }));
    expect(r.ok).toBe(false);
    expect(r.errors['files.1']).toMatch(/CorelDRAW/);
    expect(r.errors['files.0']).toBeUndefined();
  });

  it('firstInvalid sigue el orden del formulario', () => {
    const r = validateOrder(valid({ name: '', consent: false, files: [] }));
    expect(r.firstInvalid).toBe('files');
  });

  it('los límites coinciden con los del servidor', () => {
    expect(LIMITS).toMatchObject({ name: 100, notes: 1000, files: 5, fileBytes: 300 * MiB, totalBytes: 800 * MiB });
  });
});

describe('armar el pedido para el servidor', () => {
  it('manda solo lo que completó la persona, sin medidas', () => {
    const body = buildDraftPayload(valid({ whatsapp: '', email: 'maria@example.com' }), 'tok-123');
    expect(body).toEqual({
      turnstileToken: 'tok-123',
      consent: true,
      product: 'tarjetas',
      quantity: 500,
      finishing: 'Ojales y bolsillo',
      name: 'María Pérez',
      email: 'maria@example.com',
      files: [{ name: 'arte.jpg', size: 1_000_000 }],
    });
    expect(body).not.toHaveProperty('whatsapp');
    expect(body).not.toHaveProperty('notes');
    expect(body).not.toHaveProperty('widthMm');
    expect(body).not.toHaveProperty('heightMm');
  });

  it('recorta espacios y manda las notas y el WhatsApp si existen', () => {
    const body = buildDraftPayload(valid({ name: '  Ana  ', notes: ' urgente ', whatsapp: ' +54 9 11 5555-1234 ' }), 't');
    expect(body.name).toBe('Ana');
    expect(body.notes).toBe('urgente');
    expect(body.whatsapp).toBe('+54 9 11 5555-1234');
  });

  it('los archivos viajan solo con nombre y tamaño (el contenido va después, por tramos)', () => {
    const body = buildDraftPayload(valid({ files: [{ name: 'a.jpg', size: 10, extra: 'x', blob: {} }] }), 't');
    expect(body.files).toEqual([{ name: 'a.jpg', size: 10 }]);
  });
});

describe('tramos de subida', () => {
  const CHUNK = 4 * MiB;

  it('un archivo chico va en un solo tramo', () => {
    expect(planChunks(1000, CHUNK)).toEqual([{ start: 0, end: 999 }]);
  });

  it('parte en tramos del tamaño pedido y el último trae el resto (FIN inclusive)', () => {
    expect(planChunks(10 * MiB, CHUNK)).toEqual([
      { start: 0, end: 4 * MiB - 1 },
      { start: 4 * MiB, end: 8 * MiB - 1 },
      { start: 8 * MiB, end: 10 * MiB - 1 },
    ]);
  });

  it('un archivo de exactamente 2 tramos no deja un tercero vacío', () => {
    expect(planChunks(8 * MiB, CHUNK)).toHaveLength(2);
  });

  it('puede retomar desde un offset ya subido', () => {
    expect(planChunks(10 * MiB, CHUNK, 4 * MiB)).toEqual([
      { start: 4 * MiB, end: 8 * MiB - 1 },
      { start: 8 * MiB, end: 10 * MiB - 1 },
    ]);
  });

  it('retomar exactamente en el final no deja nada por subir', () => {
    expect(planChunks(1000, CHUNK, 1000)).toEqual([]);
  });

  it('300 MB son 75 tramos de 4 MiB', () => {
    expect(planChunks(300 * MiB, CHUNK)).toHaveLength(75);
  });

  it('rechaza parámetros absurdos en vez de entrar en un bucle infinito', () => {
    expect(() => planChunks(100, 0)).toThrow();
    expect(() => planChunks(-1, CHUNK)).toThrow();
    expect(() => planChunks(100, CHUNK, 200)).toThrow();
  });

  it('contentRange arma el encabezado que espera el servidor', () => {
    expect(contentRange(0, 999, 1000)).toBe('bytes 0-999/1000');
  });
});

describe('errores del servidor, traducidos a algo que se le pueda mostrar a la persona', () => {
  it('422 de validación: mensajes por campo, con los nombres del formulario', () => {
    const r = describeApiError(422, { error: 'validacion', message: 'Revisá los datos', fields: { widthMm: 'La medida debe ser mayor a cero', 'files.1': 'guía', consent: 'x', contact: 'y' } });
    expect(r.kind).toBe('validation');
    expect(r.fields).toEqual({ width: 'La medida debe ser mayor a cero', 'files.1': 'guía', consent: 'x', contact: 'y' });
  });

  it('403: falló la verificación anti-robots, hay que pedir otro token', () => {
    const r = describeApiError(403, { error: 'antibot', message: 'No pudimos verificar que no seas un robot.' });
    expect(r.kind).toBe('antibot');
    expect(r.message).toMatch(/robot/);
  });

  it('429: demasiados pedidos, con el tiempo de espera', () => {
    const r = describeApiError(429, { error: 'limite', message: 'Intentá más tarde' }, { 'retry-after': '1800' });
    expect(r).toMatchObject({ kind: 'rate-limit', retryAfter: 1800 });
  });

  it('503 con código E-XXXX: solo se muestra el mensaje del servidor y el código, nada más', () => {
    const r = describeApiError(503, { error: 'almacenamiento', message: 'No pudimos guardar tu archivo. Tu código de error es E-7KQ2.', code: 'E-7KQ2' });
    expect(r).toMatchObject({ kind: 'storage', code: 'E-7KQ2' });
    expect(r.message).toContain('E-7KQ2');
  });

  it('503 ocupado: se espera y se reintenta el mismo tramo', () => {
    expect(describeApiError(503, { error: 'ocupado' }, { 'retry-after': '2' })).toMatchObject({ kind: 'busy', retryAfter: 2 });
  });

  it('409 de offset trae dónde retomar', () => {
    expect(describeApiError(409, { error: 'offset', expected: 4194304 })).toMatchObject({ kind: 'offset', expected: 4194304 });
  });

  it('409 incompleto trae qué archivos faltan', () => {
    expect(describeApiError(409, { error: 'incompleto', pending: [1] })).toMatchObject({ kind: 'incomplete', pending: [1] });
  });

  it('410: el pedido venció', () => {
    expect(describeApiError(410, { error: 'vencido', message: 'x' }).kind).toBe('expired');
  });

  it('422 de archivo inválido: se muestra el mensaje del servidor', () => {
    const r = describeApiError(422, { error: 'archivo_invalido', code: 'extension_no_coincide', message: 'Ese archivo termina en .jpg pero en realidad es un PNG.' });
    expect(r).toMatchObject({ kind: 'file-rejected' });
    expect(r.message).toMatch(/PNG/);
  });

  it('413 y cualquier otra cosa: mensaje genérico, sin filtrar nada técnico', () => {
    const r = describeApiError(500, { error: 'interno', message: 'detalle técnico' });
    expect(r.kind).toBe('unknown');
    expect(r.message).not.toMatch(/técnico/);
  });

  it('una respuesta que no es JSON no rompe nada', () => {
    expect(describeApiError(502, null).kind).toBe('unknown');
    expect(describeApiError(502, 'texto').kind).toBe('unknown');
  });

  it('la API es la del sistema de pedidos', () => {
    expect(API_BASE).toBe('https://pedidos.delphgrafica.com.ar');
  });
});
