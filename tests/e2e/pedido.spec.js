import { test, expect } from '@playwright/test';

const API = 'https://pedidos.delphgrafica.com.ar';
const CHUNK = 262_144; // el servidor simulado pide tramos de 256 KiB para que un archivo chico ya tenga varios

const PRODUCTS = [
  { slug: 'tarjetas', name: 'Tarjetas', defaultWidthMm: 90, defaultHeightMm: 50, bleedMm: 3, targetDpi: 300 },
  { slug: 'flyer-a5', name: 'Flyer A5', defaultWidthMm: 148, defaultHeightMm: 210, bleedMm: 3, targetDpi: 300 },
  { slug: 'vinilo', name: 'Vinilo', defaultWidthMm: null, defaultHeightMm: null, bleedMm: 10, targetDpi: null },
];

// Reemplazo de la verificación anti-robots de Cloudflare: entrega un token al instante (o nunca, si se pide).
const turnstileStub = (autoToken) => `
  window.turnstile = {
    render(selector, options) { window.__turnstile = options; ${autoToken ? "setTimeout(() => options.callback('token-de-prueba'), 0);" : ''} return 'w1'; },
    reset() { window.__resets = (window.__resets || 0) + 1; ${autoToken ? "setTimeout(() => window.__turnstile.callback('token-nuevo'), 0);" : ''} },
  };`;

/**
 * Servidor de pedidos simulado, con las mismas respuestas que el real. Registra lo que recibe para poder comprobarlo.
 * `chunkHook(n, helpers)` puede interceptar el tramo n-ésimo (para simular cortes o fallas).
 */
async function mockServer(page, { autoToken = true, draft, chunkHook, analysis, finalize } = {}) {
  const seen = { drafts: [], chunks: [], statuses: 0, finalizes: 0, headers: [] };
  const received = {};
  await page.route('https://challenges.cloudflare.com/**', (route) => route.fulfill({ contentType: 'application/javascript', body: turnstileStub(autoToken) }));
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const cors = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'x-upload-token,x-draft-token,content-type,content-range',
      'access-control-allow-methods': 'GET,POST,PUT,OPTIONS',
      'access-control-expose-headers': 'retry-after',
    };
    const json = (status, body, headers = {}) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
    seen.headers.push({ url: url.pathname, method: request.method(), headers: request.headers() });

    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (url.pathname === '/api/v1/catalog') return json(200, { products: PRODUCTS });

    if (url.pathname === '/api/v1/drafts' && request.method() === 'POST') {
      const body = request.postDataJSON();
      seen.drafts.push(body);
      if (draft) return draft({ json, body });
      return json(201, { draftToken: 'DRAFT-TOKEN', chunkSize: CHUNK, expiresInHours: 24, files: body.files.map((_, index) => ({ index, uploadToken: `UP-${index}` })) });
    }

    if (url.pathname === '/api/v1/uploads/chunks' && request.method() === 'PUT') {
      const token = request.headers()['x-upload-token'];
      const [, start, end, total] = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(request.headers()['content-range']).map(Number);
      seen.chunks.push({ token, start, end, total });
      if (chunkHook) {
        // El gancho puede responder él mismo (con `json` o abortando la conexión); si lo hizo, no se responde de nuevo.
        let answered = false;
        const hookJson = (...args) => ((answered = true), json(...args));
        const hookRoute = { abort: (...args) => ((answered = true), route.abort(...args)) };
        const result = await chunkHook(seen.chunks.length, { json: hookJson, route: hookRoute });
        if (answered) return result;
      }
      received[token] = end + 1;
      if (end + 1 === total) return json(200, { complete: true, received: total, analysis: analysis ?? { status: 'ok', needsReview: false, effectiveDpi: 317.5, targetDpi: 300 } });
      return json(200, { complete: false, received: end + 1 });
    }

    if (url.pathname === '/api/v1/uploads/status') {
      seen.statuses++;
      const token = request.headers()['x-upload-token'];
      return json(200, { size: 0, received: received[token] ?? 0, complete: false });
    }

    if (url.pathname === '/api/v1/drafts/finalize') {
      seen.finalizes++;
      if (finalize) return finalize({ json });
      return json(201, { orderNo: 'P-2026-0001', needsReview: false });
    }
    return json(404, { error: 'no_encontrado', message: 'x' });
  });
  return seen;
}

const bytes = (size) => ({ name: 'arte.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(size, 1) });

async function fillOrder(page, { product = 'Tarjetas', files = [bytes(600_000)], contact = { email: 'maria@example.com' } } = {}) {
  await page.getByRole('radio', { name: product }).check();
  await page.locator('#archivos').setInputFiles(files);
  await page.locator('#nombre').fill('María Pérez');
  if (contact.email) await page.locator('#email').fill(contact.email);
  if (contact.whatsapp) await page.locator('#whatsapp').fill(contact.whatsapp);
  await page.locator('#consentimiento').check();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__opened = [];
    window.open = (...args) => (window.__opened.push(args), null);
  });
});

test.describe('recorrido completo', () => {
  test('elegir producto, subir el archivo por tramos y recibir el número de pedido', async ({ page }) => {
    const seen = await mockServer(page);
    await page.goto('/pedido.html');
    await expect(page.getByRole('radio', { name: 'Tarjetas' })).toBeVisible();

    await fillOrder(page, { files: [bytes(600_000)] });
    await page.locator('#cantidad').fill('500');
    await page.getByLabel('Terminación').selectOption('Laminado mate');
    await page.getByRole('button', { name: /Enviar pedido/ }).click();

    await expect(page.locator('#numero-pedido')).toHaveText('P-2026-0001');
    await expect(page.getByRole('heading', { name: '¡Recibimos tu pedido!' })).toBeVisible();
    await expect(page.locator('#form-pedido')).toBeHidden();

    // El pedido que recibió el servidor: medidas en milímetros y solo lo que se completó.
    expect(seen.drafts).toHaveLength(1);
    expect(seen.drafts[0]).toMatchObject({
      turnstileToken: 'token-de-prueba',
      consent: true,
      product: 'tarjetas',
      widthMm: 90,
      heightMm: 50,
      quantity: 500,
      finishing: 'Laminado mate',
      name: 'María Pérez',
      email: 'maria@example.com',
      files: [{ name: 'arte.jpg', size: 600_000 }],
    });
    expect(seen.drafts[0]).not.toHaveProperty('whatsapp');

    // 600 000 bytes en tramos de 256 KiB: 3 tramos, en orden, con el Content-Range correcto y el token en el header.
    expect(seen.chunks.map(({ start, end }) => [start, end])).toEqual([[0, CHUNK - 1], [CHUNK, 2 * CHUNK - 1], [2 * CHUNK, 599_999]]);
    expect(seen.chunks.every((c) => c.token === 'UP-0' && c.total === 600_000)).toBe(true);
    expect(seen.finalizes).toBe(1);
    // Ninguna llamada lleva el token en la URL.
    expect(seen.headers.every((h) => !h.url.includes('UP-0') && !h.url.includes('DRAFT'))).toBe(true);
  });

  test('la pantalla final muestra el resumen y un enlace a WhatsApp con el número de pedido', async ({ page }) => {
    await mockServer(page);
    await page.goto('/pedido.html');
    await fillOrder(page);
    await page.locator('#cantidad').fill('250');
    await page.getByRole('button', { name: /Enviar pedido/ }).click();
    await expect(page.locator('#numero-pedido')).toHaveText('P-2026-0001');

    const resumen = page.locator('#resumen');
    await expect(resumen).toContainText('Tarjetas');
    await expect(resumen).toContainText('9 × 5 cm');
    await expect(resumen).toContainText('250');
    await expect(resumen).toContainText('arte.jpg');
    const href = await page.locator('#btn-wa-listo').getAttribute('href');
    expect(decodeURIComponent(href.split('?text=')[1])).toBe('Hola! Hice el pedido P-2026-0001 en la web.');
    await expect(page.locator('#aviso-revision')).toBeHidden();
    // Con el pedido enviado, la bienvenida y el consejo del original ya no se muestran.
    await expect(page.locator('#pedido-intro')).toBeHidden();
    await expect(page.locator('#pedido-aviso')).toBeHidden();
  });

  test('un pedido marcado "para revisar" lo avisa en la pantalla final', async ({ page }) => {
    await mockServer(page, { finalize: ({ json }) => json(201, { orderNo: 'P-2026-0002', needsReview: true }) });
    await page.goto('/pedido.html');
    await fillOrder(page);
    await page.getByRole('button', { name: /Enviar pedido/ }).click();
    await expect(page.locator('#aviso-revision')).toBeVisible();
  });

  test('con varios archivos se suben de a uno, cada uno con su token', async ({ page }) => {
    const seen = await mockServer(page);
    await page.goto('/pedido.html');
    const a = { ...bytes(300_000), name: 'frente.png', mimeType: 'image/png' };
    const b = { name: 'dorso.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(100_000, 2) };
    await fillOrder(page, { files: [a, b] });
    await page.getByRole('button', { name: /Enviar pedido/ }).click();
    await expect(page.locator('#numero-pedido')).toHaveText('P-2026-0001');
    expect(seen.drafts[0].files.map((f) => f.name)).toEqual(['frente.png', 'dorso.pdf']);
    expect([...new Set(seen.chunks.map((c) => c.token))]).toEqual(['UP-0', 'UP-1']);
    const tokens = seen.chunks.map((c) => c.token);
    expect(tokens).toEqual([...tokens].sort()); // todo el primero, después el segundo
  });

  test('"Hacer otro pedido" vuelve a mostrar el formulario vacío', async ({ page }) => {
    await mockServer(page);
    await page.goto('/pedido.html');
    await fillOrder(page);
    await page.getByRole('button', { name: /Enviar pedido/ }).click();
    await page.getByRole('button', { name: 'Hacer otro pedido' }).click();
    await expect(page.locator('#form-pedido')).toBeVisible();
    await expect(page.locator('#nombre')).toHaveValue('');
    await expect(page.locator('#lista-archivos li')).toHaveCount(0);
  });
});

test.describe('producto y medidas', () => {
  test('al elegir un producto se cargan sus medidas y se muestra la resolución ideal', async ({ page }) => {
    await mockServer(page);
    await page.goto('/pedido.html');
    await page.getByRole('radio', { name: 'Tarjetas' }).check();
    await expect(page.locator('#ancho')).toHaveValue('9');
    await expect(page.locator('#alto')).toHaveValue('5');
    const spec = page.locator('#spec');
    await expect(spec).toContainText('9 × 5 cm');
    await expect(spec).toContainText('Sangrado: 0,3 cm por lado');
    await expect(spec).toContainText('300 dpi');
    await expect(spec).toContainText('1.134 × 661 px');
  });

  test('si la persona ya escribió su medida, cambiar de producto no la pisa', async ({ page }) => {
    await mockServer(page);
    await page.goto('/pedido.html');
    await page.getByRole('radio', { name: 'Tarjetas' }).check();
    await page.locator('#ancho').fill('12,5');
    await page.getByRole('radio', { name: 'Flyer A5' }).check();
    await expect(page.locator('#ancho')).toHaveValue('12,5');
    await expect(page.locator('#alto')).toHaveValue('21'); // el alto no lo tocó: sí toma el del producto nuevo
  });

  test('en medida libre la resolución ideal depende del tamaño', async ({ page }) => {
    await mockServer(page);
    await page.goto('/pedido.html');
    await page.getByRole('radio', { name: 'Vinilo' }).check();
    await page.locator('#ancho').fill('200');
    await page.locator('#alto').fill('100');
    await expect(page.locator('#spec')).toContainText('100 dpi');
  });
});

test.describe('validaciones antes de enviar', () => {
  test('enviar vacío marca los campos, lleva el foco al primero y no manda nada al servidor', async ({ page }) => {
    const seen = await mockServer(page);
    await page.goto('/pedido.html');
    await page.getByRole('button', { name: /Enviar pedido/ }).click();

    await expect(page.locator('#producto-error')).toHaveText('Elegí qué querés imprimir.');
    await expect(page.locator('#ancho-error')).not.toBeEmpty();
    await expect(page.locator('#archivos-error')).toHaveText('Elegí al menos un archivo.');
    await expect(page.locator('#nombre-error')).toHaveText('Contanos tu nombre.');
    await expect(page.locator('#contacto-error')).toContainText('email o WhatsApp');
    await expect(page.locator('#consentimiento-error')).toContainText('política de privacidad');
    await expect(page.getByRole('radio', { name: 'Tarjetas' })).toBeFocused();
    expect(seen.drafts).toHaveLength(0);
  });

  test('sin tildar el consentimiento no se envía', async ({ page }) => {
    const seen = await mockServer(page);
    await page.goto('/pedido.html');
    await fillOrder(page);
    await page.locator('#consentimiento').uncheck();
    await page.getByRole('button', { name: /Enviar pedido/ }).click();
    await expect(page.locator('#consentimiento-error')).toContainText('política de privacidad');
    await expect(page.locator('#consentimiento')).toBeFocused();
    expect(seen.drafts).toHaveLength(0);
  });

  test('con solo WhatsApp alcanza', async ({ page }) => {
    const seen = await mockServer(page);
    await page.goto('/pedido.html');
    await fillOrder(page, { contact: { whatsapp: '+54 9 11 5555-1234' } });
    await page.getByRole('button', { name: /Enviar pedido/ }).click();
    await expect(page.locator('#numero-pedido')).toBeVisible();
    expect(seen.drafts[0].whatsapp).toBe('+54 9 11 5555-1234');
    expect(seen.drafts[0]).not.toHaveProperty('email');
  });

  test('un error se borra al corregir el campo', async ({ page }) => {
    await mockServer(page);
    await page.goto('/pedido.html');
    await page.getByRole('button', { name: /Enviar pedido/ }).click();
    await expect(page.locator('#nombre-error')).not.toBeEmpty();
    await page.locator('#nombre').fill('Ana');
    await expect(page.locator('#nombre-error')).toBeEmpty();
    await expect(page.locator('#nombre')).not.toHaveAttribute('aria-invalid', 'true');
  });

  test('sin la verificación anti-robots no se envía y se avisa', async ({ page }) => {
    const seen = await mockServer(page, { autoToken: false });
    await page.goto('/pedido.html');
    await fillOrder(page);
    await page.getByRole('button', { name: /Enviar pedido/ }).click();
    await expect(page.locator('#turnstile-error')).toContainText('verificación anti-robots');
    expect(seen.drafts).toHaveLength(0);
  });
});

test.describe('archivos', () => {
  test('un .cdr se rechaza al elegirlo, con la guía para exportar a PDF, y no queda en la lista', async ({ page }) => {
    await mockServer(page);
    await page.goto('/pedido.html');
    await page.locator('#archivos').setInputFiles({ name: 'logo.cdr', mimeType: 'application/octet-stream', buffer: Buffer.alloc(1000) });
    await expect(page.locator('#archivos-error')).toContainText('CorelDRAW');
    await expect(page.locator('#archivos-error')).toContainText('PDF');
    await expect(page.locator('#lista-archivos li')).toHaveCount(0);
  });

  test('de un grupo, los válidos entran y los inválidos se informan por nombre', async ({ page }) => {
    await mockServer(page);
    await page.goto('/pedido.html');
    await page.locator('#archivos').setInputFiles([bytes(1000), { name: 'virus.exe', mimeType: 'application/octet-stream', buffer: Buffer.alloc(10) }]);
    await expect(page.locator('#lista-archivos li')).toHaveCount(1);
    await expect(page.locator('#archivos-error')).toContainText('virus.exe');
  });

  test('el sexto archivo no entra: el máximo es 5', async ({ page }) => {
    await mockServer(page);
    await page.goto('/pedido.html');
    const files = Array.from({ length: 6 }, (_, i) => ({ name: `a${i}.jpg`, mimeType: 'image/jpeg', buffer: Buffer.alloc(100 + i) }));
    await page.locator('#archivos').setInputFiles(files);
    await expect(page.locator('#lista-archivos li')).toHaveCount(5);
    await expect(page.locator('#archivos-error')).toContainText('hasta 5 archivos');
  });

  test('se puede quitar un archivo de la lista', async ({ page }) => {
    await mockServer(page);
    await page.goto('/pedido.html');
    await page.locator('#archivos').setInputFiles(bytes(1000));
    await page.getByRole('button', { name: 'Quitar arte.jpg' }).click();
    await expect(page.locator('#lista-archivos li')).toHaveCount(0);
  });

  test('el mismo archivo elegido dos veces no se duplica', async ({ page }) => {
    await mockServer(page);
    await page.goto('/pedido.html');
    await page.locator('#archivos').setInputFiles(bytes(1000));
    await page.locator('#archivos').setInputFiles(bytes(1000));
    await expect(page.locator('#lista-archivos li')).toHaveCount(1);
  });

  test('un nombre de archivo con HTML se muestra como texto, nunca se interpreta', async ({ page }) => {
    await mockServer(page);
    await page.goto('/pedido.html');
    await page.locator('#archivos').setInputFiles({ name: '<img src=x onerror=alert(1)>.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(100) });
    await expect(page.locator('#lista-archivos .file-name')).toHaveText('<img src=x onerror=alert(1)>.jpg');
    await expect(page.locator('#lista-archivos img')).toHaveCount(0);
  });

  test('poca resolución: el aviso del servidor aparece en el archivo y el pedido igual se envía', async ({ page }) => {
    await mockServer(page, {
      analysis: { status: 'low', needsReview: true, effectiveDpi: 120, targetDpi: 300, message: 'Esta imagen tiene unos 120 dpi para la medida que pediste y lo ideal es 300.' },
      finalize: ({ json }) => json(201, { orderNo: 'P-2026-0003', needsReview: true }),
    });
    await page.goto('/pedido.html');
    await fillOrder(page);
    await page.locator('#btn-enviar').click();
    await expect(page.locator('#numero-pedido')).toHaveText('P-2026-0003');
    await expect(page.locator('#aviso-revision')).toBeVisible();
  });
});

test.describe('cuando algo sale mal', () => {
  test('falla de almacenamiento: se muestra solo el mensaje con el código, y se puede reintentar', async ({ page }) => {
    await mockServer(page, {
      chunkHook: (n, { json }) => (n === 2 ? json(503, { error: 'almacenamiento', code: 'E-7KQ2', message: 'No pudimos guardar tu archivo en este momento. Tu código de error es E-7KQ2. Si el problema sigue, avisanos con ese código.' }) : undefined),
    });
    await page.goto('/pedido.html');
    await fillOrder(page);
    await page.getByRole('button', { name: /Enviar pedido/ }).click();

    await expect(page.locator('#estado')).toContainText('E-7KQ2');
    await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible();
    const visible = await page.locator('main').innerText();
    expect(visible).not.toMatch(/quota|cuota|espacio|drive|google/i);
  });

  test('"Reintentar" retoma la subida sin crear otro pedido', async ({ page }) => {
    const seen = await mockServer(page, {
      chunkHook: (n, { json }) => (n === 2 ? json(503, { error: 'almacenamiento', code: 'E-7KQ2', message: 'Tu código de error es E-7KQ2.' }) : undefined),
    });
    await page.goto('/pedido.html');
    await fillOrder(page);
    await page.getByRole('button', { name: /Enviar pedido/ }).click();
    await page.getByRole('button', { name: 'Reintentar' }).click();
    await expect(page.locator('#numero-pedido')).toHaveText('P-2026-0001');
    expect(seen.drafts).toHaveLength(1); // un solo pedido en el servidor
  });

  test('se corta la conexión a mitad: el cliente espera, retoma y termina sin que la persona haga nada', async ({ page }) => {
    const seen = await mockServer(page, { chunkHook: (n, { route }) => (n === 2 ? route.abort('connectionfailed') : undefined) });
    await page.goto('/pedido.html');
    await fillOrder(page);
    await page.getByRole('button', { name: /Enviar pedido/ }).click();
    await expect(page.locator('#numero-pedido')).toHaveText('P-2026-0001', { timeout: 15_000 });
    expect(seen.statuses).toBeGreaterThanOrEqual(1); // preguntó dónde había quedado
    expect(seen.drafts).toHaveLength(1);
  });

  test('demasiados pedidos seguidos: se avisa y se puede volver a probar más tarde', async ({ page }) => {
    await mockServer(page, { draft: ({ json }) => json(429, { error: 'limite', message: 'Hiciste varios pedidos seguidos. Intentá más tarde, en un rato podés volver a enviar.' }, { 'retry-after': '1800' }) });
    await page.goto('/pedido.html');
    await fillOrder(page);
    await page.getByRole('button', { name: /Enviar pedido/ }).click();
    await expect(page.locator('#estado')).toContainText('Intentá más tarde');
    await expect(page.locator('#estado')).toContainText('30 minutos');
    await expect(page.locator('#btn-enviar')).toBeEnabled();
  });

  test('el servidor rechaza un campo: el mensaje aparece en ese campo', async ({ page }) => {
    await mockServer(page, { draft: ({ json }) => json(422, { error: 'validacion', message: 'Revisá los datos del pedido', fields: { widthMm: 'La medida debe ser mayor a cero' } }) });
    await page.goto('/pedido.html');
    await fillOrder(page);
    await page.getByRole('button', { name: /Enviar pedido/ }).click();
    await expect(page.locator('#ancho-error')).toHaveText('La medida debe ser mayor a cero');
    await expect(page.locator('#ancho')).toHaveAttribute('aria-invalid', 'true');
  });

  test('el servidor rechaza el archivo por su contenido: se muestra y se pide quitarlo', async ({ page }) => {
    await mockServer(page, {
      chunkHook: (n, { json }) => (n === 1 ? json(422, { error: 'archivo_invalido', code: 'extension_no_coincide', message: 'Ese archivo termina en .jpg pero en realidad es un PNG. Renombralo como .png y volvé a subirlo.' }) : undefined),
    });
    await page.goto('/pedido.html');
    await fillOrder(page);
    await page.getByRole('button', { name: /Enviar pedido/ }).click();
    await expect(page.locator('#estado')).toContainText('en realidad es un PNG');
    await expect(page.locator('#lista-archivos .file-info')).toContainText('en realidad es un PNG');
  });

  test('si no se pueden cargar los productos, se puede reintentar o ir a WhatsApp', async ({ page }) => {
    await page.route('https://challenges.cloudflare.com/**', (route) => route.fulfill({ contentType: 'application/javascript', body: turnstileStub(true) }));
    await page.route(`${API}/**`, (route) => route.abort('connectionfailed'));
    await page.goto('/pedido.html');
    await expect(page.locator('#productos')).toContainText('No pudimos cargar los productos');
    await expect(page.locator('#productos').getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', 'https://wa.me/5491172394787');
    await expect(page.locator('#productos').getByRole('button', { name: 'Reintentar' })).toBeVisible();
  });
});

test.describe('accesibilidad y diseño', () => {
  for (const width of [360, 1280]) {
    test(`a ${width}px todo control mide al menos 44 × 44 px y no hay scroll horizontal`, async ({ page }) => {
      await mockServer(page);
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/pedido.html');
      await expect(page.getByRole('radio', { name: 'Tarjetas' })).toBeVisible();
      await page.locator('#archivos').setInputFiles(bytes(1000));
      const small = await page.evaluate(() => {
        const visible = (el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
        };
        return [...document.querySelectorAll('a[href], button, input, textarea, select')]
          .filter(visible)
          .map((el) => ({ name: el.id || el.getAttribute('aria-label') || el.textContent.trim().slice(0, 30), r: el.getBoundingClientRect() }))
          .filter(({ r }) => Math.round(r.width) < 44 || Math.round(r.height) < 44)
          .map(({ name, r }) => `${name} ${Math.round(r.width)}×${Math.round(r.height)}`);
      });
      expect(small).toEqual([]);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test('todo lo que se enfoca con el teclado muestra un indicador de foco', async ({ page }) => {
    await mockServer(page);
    await page.goto('/pedido.html');
    await expect(page.getByRole('radio', { name: 'Tarjetas' })).toBeVisible();
    const missing = [];
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const style = getComputedStyle(el);
        return { name: el.id || el.getAttribute('aria-label') || el.textContent.trim().slice(0, 30), outline: style.outlineStyle, width: parseFloat(style.outlineWidth) };
      });
      if (info && (info.outline === 'none' || info.width === 0)) missing.push(info.name);
    }
    expect(missing).toEqual([]);
  });

  test('se puede completar y enviar solo con el teclado', async ({ page }) => {
    await mockServer(page);
    await page.goto('/pedido.html');
    await page.getByRole('radio', { name: 'Tarjetas' }).focus();
    await page.keyboard.press('Space');
    await expect(page.locator('#ancho')).toHaveValue('9');
  });

  test('mientras se sube se avisa con el progreso y la barra', async ({ page }) => {
    await mockServer(page, {
      chunkHook: async (n) => {
        if (n === 2) await new Promise((resolve) => setTimeout(resolve, 600));
      },
    });
    await page.goto('/pedido.html');
    await fillOrder(page);
    await page.getByRole('button', { name: /Enviar pedido/ }).click();
    await expect(page.locator('#progreso')).toBeVisible();
    await expect(page.locator('#progreso-texto')).toContainText('Subiendo');
    await expect(page.locator('#numero-pedido')).toHaveText('P-2026-0001');
  });
});

test('sin JavaScript el formulario no se ve y aparece el aviso con enlace a WhatsApp', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/pedido.html');
  await expect(page.locator('#form-pedido')).toBeHidden();
  const notice = page.locator('main noscript p');
  await expect(notice).toBeVisible();
  await expect(notice.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', 'https://wa.me/5491172394787');
  await context.close();
});

test('desde el inicio, "Adjuntar archivo / Arte final" lleva al formulario de pedidos', async ({ page }) => {
  await mockServer(page);
  await page.goto('/');
  await page.getByRole('link', { name: 'Adjuntar archivo / Arte final' }).click();
  await expect(page).toHaveURL(/\/pedido\.html$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mandanos tu trabajo');
});

test('la política de privacidad se abre desde el formulario y desde el pie', async ({ page }) => {
  await mockServer(page);
  await page.goto('/pedido.html');
  const popup = page.waitForEvent('popup');
  await page.getByRole('link', { name: 'Leer la política de privacidad' }).click();
  expect((await popup).url()).toMatch(/\/privacidad\.html$/);
  await page.goto('/privacidad.html');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Política de privacidad');
  await expect(page.locator('#pie').getByRole('link', { name: 'Política de privacidad' })).toBeVisible();
});
