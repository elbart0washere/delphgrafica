import { describe, it, expect } from 'vitest';
import { ApiError, createDraft, finalizeOrder, uploadFile } from '../../js/pedido-upload.js';
import { MiB } from '../../js/pedido-logic.js';

const BASE = 'https://pedidos.example';
const CHUNK = 256 * 1024;

/** Archivo falso: solo necesita saber su tamaño y devolver "el trozo" que se le pide. */
const fakeFile = (size) => ({ size, slice: (start, end) => ({ start, end, length: end - start }) });
const json = (status, body, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

/**
 * Servidor simulado del sistema de pedidos: lleva la cuenta de lo recibido por archivo, valida el Content-Range igual
 * que el real y permite inyectar fallas por llamada.
 */
function fakeServer({ size, analysis = { status: 'ok', needsReview: false }, script = [] } = {}) {
  let received = 0;
  const calls = [];
  const queue = [...script];
  const fetchImpl = async (url, init = {}) => {
    const call = { url: String(url), method: init.method ?? 'GET', headers: init.headers ?? {}, init };
    calls.push(call);
    const scripted = queue.shift();
    if (scripted === 'network') throw new TypeError('Failed to fetch');
    if (typeof scripted === 'function') {
      const r = scripted(call);
      if (r) return r;
    }
    if (scripted instanceof Response) return scripted;

    if (call.method === 'GET') return json(200, { size, received, complete: received === size, ...(received === size ? { analysis } : {}) });
    const m = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(call.headers['content-range']);
    const [start, end] = [Number(m[1]), Number(m[2])];
    if (start !== received) return json(409, { error: 'offset', message: 'x', expected: received });
    received = end + 1;
    return received === size ? json(200, { complete: true, received, analysis }) : json(200, { complete: false, received });
  };
  return { fetchImpl, calls, get received() { return received; }, set received(v) { received = v; } };
}

const sleeper = () => {
  const waits = [];
  return { waits, sleep: async (ms) => void waits.push(ms) };
};

const upload = (server, size, extra = {}) => {
  const { sleep, waits } = extra.sleeper ?? sleeper();
  return {
    waits,
    run: () =>
      uploadFile({ fetchImpl: server.fetchImpl, apiBase: BASE, uploadToken: 'TOK', file: fakeFile(size), chunkSize: CHUNK, sleep, ...extra.options }),
  };
};

describe('subir un archivo por tramos', () => {
  it('manda cada tramo en orden con el Content-Range y el token en el header (nunca en la URL)', async () => {
    const size = 3 * CHUNK + 100;
    const server = fakeServer({ size });
    await upload(server, size).run();

    const puts = server.calls.filter((c) => c.method === 'PUT');
    expect(puts).toHaveLength(4);
    expect(puts.map((c) => c.headers['content-range'])).toEqual([
      `bytes 0-${CHUNK - 1}/${size}`,
      `bytes ${CHUNK}-${2 * CHUNK - 1}/${size}`,
      `bytes ${2 * CHUNK}-${3 * CHUNK - 1}/${size}`,
      `bytes ${3 * CHUNK}-${size - 1}/${size}`,
    ]);
    for (const c of puts) {
      expect(c.url).toBe(`${BASE}/api/v1/uploads/chunks`);
      expect(c.headers['x-upload-token']).toBe('TOK');
      expect(c.headers['content-type']).toBe('application/octet-stream');
      expect(c.url).not.toContain('TOK');
    }
  });

  it('cada pedido va sin cookies ni credenciales', async () => {
    const server = fakeServer({ size: 100 });
    await upload(server, 100).run();
    for (const c of server.calls) expect(c.init.credentials).toBe('omit');
  });

  it('el cuerpo de cada tramo es el trozo exacto del archivo', async () => {
    const size = 2 * CHUNK;
    const server = fakeServer({ size });
    await upload(server, size).run();
    const bodies = server.calls.filter((c) => c.method === 'PUT').map((c) => [c.init.body.start, c.init.body.end]);
    expect(bodies).toEqual([[0, CHUNK], [CHUNK, 2 * CHUNK]]);
  });

  it('devuelve el análisis de resolución que manda el servidor al completar', async () => {
    const analysis = { status: 'low', needsReview: true, effectiveDpi: 120, targetDpi: 300, message: 'poca resolución' };
    const server = fakeServer({ size: 100, analysis });
    expect(await upload(server, 100).run()).toEqual({ analysis });
  });

  it('informa el avance: crece sin retroceder y termina en el total', async () => {
    const size = 4 * CHUNK;
    const server = fakeServer({ size });
    const seen = [];
    await upload(server, size, { options: { onProgress: (sent, total) => seen.push([sent, total]) } }).run();
    expect(seen.at(-1)).toEqual([size, size]);
    const sent = seen.map(([s]) => s);
    expect(sent).toEqual([...sent].sort((a, b) => a - b));
    expect(seen.every(([, t]) => t === size)).toBe(true);
  });

  it('puede retomar desde un offset ya subido', async () => {
    const size = 4 * CHUNK;
    const server = fakeServer({ size });
    server.received = 2 * CHUNK;
    await upload(server, size, { options: { startFrom: 2 * CHUNK } }).run();
    expect(server.calls.filter((c) => c.method === 'PUT')).toHaveLength(2);
  });
});

describe('cortes de conexión (Escenario 1.5: sigue sin empezar de cero)', () => {
  it('ante un error de red espera, le pregunta al servidor dónde quedó y sigue desde ahí', async () => {
    const size = 4 * CHUNK;
    const server = fakeServer({ size, script: [undefined, undefined, 'network'] }); // 2 tramos OK, el 3.º se corta
    const s = sleeper();
    await upload(server, size, { sleeper: s }).run();

    expect(s.waits).toEqual([1000]);
    const kinds = server.calls.map((c) => c.method + (c.method === 'PUT' ? `:${c.headers['content-range'].split(' ')[1].split('-')[0]}` : ''));
    // PUT 0, PUT CHUNK, PUT 2*CHUNK (se corta), GET estado, PUT 2*CHUNK, PUT 3*CHUNK
    expect(kinds).toEqual(['PUT:0', `PUT:${CHUNK}`, `PUT:${2 * CHUNK}`, 'GET', `PUT:${2 * CHUNK}`, `PUT:${3 * CHUNK}`]);
    expect(server.received).toBe(size);
  });

  it('si el servidor ya había recibido el tramo (se perdió la respuesta), no lo manda dos veces', async () => {
    const size = 3 * CHUNK;
    let tick = 0;
    const server = fakeServer({ size });
    const original = server.fetchImpl;
    // El 2.º PUT llega al servidor pero la respuesta se pierde en el camino.
    server.fetchImpl = async (url, init) => {
      const response = await original(url, init);
      if (init?.method === 'PUT' && ++tick === 2) throw new TypeError('Failed to fetch');
      return response;
    };
    await upload(server, size).run();
    expect(server.received).toBe(size);
    expect(server.calls.filter((c) => c.method === 'PUT').map((c) => c.headers['content-range'].split(' ')[1].split('-')[0])).toEqual(['0', `${CHUNK}`, `${2 * CHUNK}`]);
  });

  it('la espera crece (1 s, 2 s, 4 s…) con tope de 30 s', async () => {
    const size = 2 * CHUNK;
    const server = fakeServer({ size, script: Array(60).fill('network') }); // alcanza para los 8 intentos y sus consultas de estado
    const s = sleeper();
    await expect(upload(server, size, { sleeper: s, options: { maxNetworkRetries: 8 } }).run()).rejects.toBeInstanceOf(ApiError);
    expect(s.waits).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000]);
  });

  it('si la conexión no vuelve tras los reintentos, avisa con un error de red (la persona puede reintentar)', async () => {
    const size = 2 * CHUNK;
    const server = fakeServer({ size, script: Array(20).fill('network') });
    const error = await upload(server, size, { options: { maxNetworkRetries: 3 } }).run().catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.info.kind).toBe('network');
  });

  it('un 502 o 504 transitorio se reintenta igual que un corte', async () => {
    const size = 2 * CHUNK;
    const server = fakeServer({ size, script: [new Response('bad gateway', { status: 502 })] });
    const s = sleeper();
    await upload(server, size, { sleeper: s }).run();
    expect(s.waits).toEqual([1000]);
    expect(server.received).toBe(size);
  });
});

describe('respuestas del servidor', () => {
  it('409 offset: retoma donde el servidor dice que va, sin repetir ni saltear', async () => {
    const size = 4 * CHUNK;
    const server = fakeServer({ size });
    server.received = 2 * CHUNK; // el servidor ya tiene 2 tramos, el cliente cree que va en 0
    await upload(server, size).run();
    const starts = server.calls.filter((c) => c.method === 'PUT').map((c) => c.headers['content-range'].split(' ')[1].split('-')[0]);
    expect(starts).toEqual(['0', `${2 * CHUNK}`, `${3 * CHUNK}`]); // el 1.º se rechaza con 409 y se corrige
    expect(server.received).toBe(size);
  });

  it('503 ocupado: espera lo que pide Retry-After y reintenta el mismo tramo', async () => {
    const size = 2 * CHUNK;
    const busy = json(503, { error: 'ocupado', message: 'Hay muchas subidas.' }, { 'retry-after': '3' });
    const server = fakeServer({ size, script: [busy] });
    const s = sleeper();
    await upload(server, size, { sleeper: s }).run();
    expect(s.waits).toEqual([3000]);
    expect(server.received).toBe(size);
  });

  it('503 de almacenamiento: NO se reintenta y se muestra solo el mensaje con el código E-XXXX', async () => {
    const size = 3 * CHUNK;
    const storage = json(503, { error: 'almacenamiento', code: 'E-7KQ2', message: 'No pudimos guardar tu archivo. Tu código de error es E-7KQ2.' });
    const server = fakeServer({ size, script: [undefined, storage] });
    const error = await upload(server, size).run().catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.info).toMatchObject({ kind: 'storage', code: 'E-7KQ2' });
    expect(server.calls.filter((c) => c.method === 'PUT')).toHaveLength(2); // no insiste
  });

  it('422 archivo inválido: corta de inmediato con el mensaje del servidor', async () => {
    const rejected = json(422, { error: 'archivo_invalido', code: 'extension_no_coincide', message: 'Ese archivo termina en .jpg pero en realidad es un PNG.' });
    const server = fakeServer({ size: 3 * CHUNK, script: [rejected] });
    const error = await upload(server, 3 * CHUNK).run().catch((e) => e);
    expect(error.info).toMatchObject({ kind: 'file-rejected' });
    expect(error.info.message).toMatch(/PNG/);
    expect(server.calls).toHaveLength(1);
  });

  it.each([
    [410, { error: 'vencido', message: 'venció' }, 'expired'],
    [404, { error: 'no_encontrado', message: 'x' }, 'not-found'],
    [429, { error: 'limite', message: 'x' }, 'rate-limit'],
  ])('%i corta sin reintentar', async (status, body, kind) => {
    const server = fakeServer({ size: 2 * CHUNK, script: [json(status, body)] });
    const error = await upload(server, 2 * CHUNK).run().catch((e) => e);
    expect(error.info.kind).toBe(kind);
    expect(server.calls).toHaveLength(1);
  });

  it('se puede cancelar: no manda más tramos', async () => {
    const size = 5 * CHUNK;
    const controller = new AbortController();
    const server = fakeServer({ size });
    const error = await upload(server, size, {
      options: { signal: controller.signal, onProgress: () => controller.abort() },
    }).run().catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.info.kind).toBe('aborted');
    expect(server.calls.filter((c) => c.method === 'PUT')).toHaveLength(1);
  });
});

describe('crear el pedido y terminarlo', () => {
  const payload = { turnstileToken: 't', product: 'tarjetas' };

  it('createDraft manda el JSON y devuelve los tokens', async () => {
    const reply = { draftToken: 'D', chunkSize: 4 * MiB, expiresInHours: 24, files: [{ index: 0, uploadToken: 'U0' }] };
    const calls = [];
    const fetchImpl = async (url, init) => (calls.push({ url, init }), json(201, reply));
    expect(await createDraft({ fetchImpl, apiBase: BASE, payload })).toEqual(reply);
    expect(calls[0].url).toBe(`${BASE}/api/v1/drafts`);
    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].init.headers['content-type']).toBe('application/json');
    expect(JSON.parse(calls[0].init.body)).toEqual(payload);
    expect(calls[0].init.credentials).toBe('omit');
  });

  it('createDraft traduce los errores del servidor', async () => {
    const validation = json(422, { error: 'validacion', message: 'Revisá', fields: { widthMm: 'mal', consent: 'falta' } });
    const error = await createDraft({ fetchImpl: async () => validation, apiBase: BASE, payload }).catch((e) => e);
    expect(error.info).toMatchObject({ kind: 'validation', fields: { width: 'mal', consent: 'falta' } });

    const limit = json(429, { error: 'limite', message: 'Intentá más tarde' }, { 'retry-after': '900' });
    const limited = await createDraft({ fetchImpl: async () => limit, apiBase: BASE, payload }).catch((e) => e);
    expect(limited.info).toMatchObject({ kind: 'rate-limit', retryAfter: 900 });

    const antibot = json(403, { error: 'antibot', message: 'robot' });
    expect((await createDraft({ fetchImpl: async () => antibot, apiBase: BASE, payload }).catch((e) => e)).info.kind).toBe('antibot');
  });

  it('createDraft NO reintenta solo (un reintento sin saber si llegó podría duplicar el pedido): avisa del error de red', async () => {
    let n = 0;
    const fetchImpl = async () => (n++, Promise.reject(new TypeError('Failed to fetch')));
    const error = await createDraft({ fetchImpl, apiBase: BASE, payload }).catch((e) => e);
    expect(error.info.kind).toBe('network');
    expect(n).toBe(1);
  });

  it('finalizeOrder devuelve el Nº de pedido', async () => {
    const calls = [];
    const fetchImpl = async (url, init) => (calls.push({ url, init }), json(201, { orderNo: 'P-2026-0001', needsReview: false }));
    expect(await finalizeOrder({ fetchImpl, apiBase: BASE, draftToken: 'D' })).toEqual({ orderNo: 'P-2026-0001', needsReview: false });
    expect(calls[0].url).toBe(`${BASE}/api/v1/drafts/finalize`);
    expect(calls[0].init.headers['x-draft-token']).toBe('D');
    expect(calls[0].url).not.toContain('D?');
  });

  it('finalizeOrder SÍ reintenta ante cortes: es idempotente, repetirlo devuelve el mismo número', async () => {
    const results = [() => Promise.reject(new TypeError('Failed to fetch')), () => Promise.reject(new TypeError('Failed to fetch')), () => json(200, { orderNo: 'P-2026-0007', needsReview: true })];
    const s = sleeper();
    const out = await finalizeOrder({ fetchImpl: async () => results.shift()(), apiBase: BASE, draftToken: 'D', sleep: s.sleep });
    expect(out).toEqual({ orderNo: 'P-2026-0007', needsReview: true });
    expect(s.waits).toEqual([1000, 2000]);
  });

  it('finalizeOrder con archivos pendientes informa cuáles', async () => {
    const incomplete = json(409, { error: 'incompleto', message: 'faltan', pending: [1] });
    const error = await finalizeOrder({ fetchImpl: async () => incomplete, apiBase: BASE, draftToken: 'D' }).catch((e) => e);
    expect(error.info).toMatchObject({ kind: 'incomplete', pending: [1] });
  });

  it('una respuesta con cuerpo que no es JSON no rompe: se informa como error desconocido', async () => {
    const error = await finalizeOrder({ fetchImpl: async () => new Response('<html>', { status: 502 }), apiBase: BASE, draftToken: 'D', sleep: async () => {}, maxRetries: 0 }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
  });
});
