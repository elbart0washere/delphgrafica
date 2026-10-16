// Comunicación con el servidor de pedidos: crear el pedido, subir cada archivo por tramos (con reanudación) y terminar.
// Sin DOM. `fetchImpl` y `sleep` se inyectan para poder probar los cortes de conexión sin red ni esperas reales.
//
// Nota de seguridad: ningún pedido lleva cookies (`credentials: 'omit'`) y los tokens viajan solo en headers, nunca en la
// URL, para que no queden en ningún registro de acceso.
import { API_BASE, contentRange, describeApiError, planChunks } from './pedido-logic.js';

export class ApiError extends Error {
  constructor(info, status) {
    super(info.message);
    this.name = 'ApiError';
    this.info = info;
    this.status = status;
  }
}

const NETWORK_MESSAGE = 'Se cortó la conexión. Revisá tu internet y volvé a intentar.';
const networkError = () => new ApiError({ kind: 'network', message: NETWORK_MESSAGE });
const abortedError = () => new ApiError({ kind: 'aborted', message: 'Cancelaste la subida.' });

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
/** 1 s, 2 s, 4 s… con tope de 30 s. */
const backoff = (attempt) => Math.min(1000 * 2 ** attempt, 30_000);

const readJson = (response) => response.json().catch(() => null);

/** Un fallo que no es culpa de lo enviado: se reintenta igual que un corte de red. */
const isTransient = (status) => status === 502 || status === 504 || status === 500;

/** Pide el estado de la subida (Drive es la fuente de verdad de lo recibido). Devuelve null si no se pudo consultar. */
async function fetchStatus({ fetchImpl, apiBase, uploadToken, signal }) {
  try {
    const response = await fetchImpl(`${apiBase}/api/v1/uploads/status`, { method: 'GET', headers: { 'x-upload-token': uploadToken }, credentials: 'omit', signal });
    return response.ok ? await readJson(response) : null;
  } catch {
    return null;
  }
}

/**
 * Sube un archivo en tramos. Si se corta la conexión espera, le pregunta al servidor hasta dónde llegó y sigue desde
 * ahí, sin empezar de cero ni repetir bytes. Devuelve `{ analysis }` (el análisis de resolución del servidor).
 */
export async function uploadFile({
  fetchImpl,
  apiBase = API_BASE,
  uploadToken,
  file,
  chunkSize,
  onProgress,
  sleep = defaultSleep,
  signal,
  startFrom = 0,
  maxNetworkRetries = 6,
}) {
  const url = `${apiBase}/api/v1/uploads/chunks`;
  let offset = startFrom;
  let failures = 0;
  let offsetConflicts = 0;

  const recover = async () => {
    if (failures >= maxNetworkRetries) throw networkError();
    await sleep(backoff(failures));
    failures++;
    const status = await fetchStatus({ fetchImpl, apiBase, uploadToken, signal });
    if (status && Number.isInteger(status.received)) {
      if (status.complete) return { done: { analysis: status.analysis } };
      offset = status.received;
    }
    return {};
  };

  while (true) {
    if (signal?.aborted) throw abortedError();

    if (offset >= file.size) {
      // Todo subido pero no vimos la confirmación final (p. ej. se perdió la respuesta del último tramo).
      const status = await fetchStatus({ fetchImpl, apiBase, uploadToken, signal });
      if (status?.complete) return { analysis: status.analysis };
      throw new ApiError(describeApiError(0, null), 0);
    }

    const [chunk] = planChunks(file.size, chunkSize, offset);
    let response;
    try {
      response = await fetchImpl(url, {
        method: 'PUT',
        headers: {
          'x-upload-token': uploadToken,
          'content-range': contentRange(chunk.start, chunk.end, file.size),
          'content-type': 'application/octet-stream',
        },
        body: file.slice(chunk.start, chunk.end + 1),
        credentials: 'omit',
        signal,
      });
    } catch {
      if (signal?.aborted) throw abortedError();
      const { done } = await recover();
      if (done) return done;
      continue;
    }

    const body = await readJson(response);

    if (response.ok) {
      failures = 0;
      offsetConflicts = 0;
      offset = body.received;
      onProgress?.(body.received, file.size);
      if (body.complete) return { analysis: body.analysis };
      continue;
    }

    if (isTransient(response.status)) {
      const { done } = await recover();
      if (done) return done;
      continue;
    }

    const info = describeApiError(response.status, body, response.headers);
    if (info.kind === 'offset' && Number.isInteger(info.expected) && ++offsetConflicts <= 5) {
      offset = info.expected; // el servidor ya tenía más (o menos) de lo que creíamos: se retoma donde dice él
      continue;
    }
    if (info.kind === 'busy') {
      await sleep((info.retryAfter ?? 2) * 1000);
      continue;
    }
    if (info.kind === 'unavailable') {
      const { done } = await recover();
      if (done) return done;
      continue;
    }
    throw new ApiError(info, response.status);
  }
}

/** Crea el pedido en construcción. NO se reintenta solo: sin saber si llegó, repetirlo podría duplicar el pedido. */
export async function createDraft({ fetchImpl, apiBase = API_BASE, payload, signal }) {
  let response;
  try {
    response = await fetchImpl(`${apiBase}/api/v1/drafts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'omit',
      signal,
    });
  } catch {
    throw signal?.aborted ? abortedError() : networkError();
  }
  const body = await readJson(response);
  if (response.ok) return body;
  throw new ApiError(describeApiError(response.status, body, response.headers), response.status);
}

/** Termina el pedido y devuelve el Nº. Es idempotente en el servidor, así que sí se reintenta ante cortes. */
export async function finalizeOrder({ fetchImpl, apiBase = API_BASE, draftToken, sleep = defaultSleep, maxRetries = 3, signal }) {
  for (let attempt = 0; ; attempt++) {
    let response;
    try {
      response = await fetchImpl(`${apiBase}/api/v1/drafts/finalize`, {
        method: 'POST',
        headers: { 'x-draft-token': draftToken },
        credentials: 'omit',
        signal,
      });
    } catch {
      if (signal?.aborted) throw abortedError();
      if (attempt >= maxRetries) throw networkError();
      await sleep(backoff(attempt));
      continue;
    }
    const body = await readJson(response);
    if (response.ok) return body;
    if (isTransient(response.status) && attempt < maxRetries) {
      await sleep(backoff(attempt));
      continue;
    }
    throw new ApiError(describeApiError(response.status, body, response.headers), response.status);
  }
}
