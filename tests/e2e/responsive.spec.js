import { test, expect } from '@playwright/test';

// [ancho, alto]: celulares chicos y grandes, celular en horizontal, tablets en vertical y horizontal, notebooks y pantallas anchas.
const SIZES = [
  [320, 568], [360, 740], [375, 667], [390, 844], [414, 896], [600, 900], [740, 360],
  [768, 1024], [820, 1180], [1024, 768], [1180, 820], [1280, 800], [1440, 900], [1920, 1080], [2560, 1440],
];

for (const [width, height] of SIZES) {
  test(`regla21: a ${width}×${height} no hay scroll horizontal ni elementos que se salgan de la pantalla`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const problems = await page.evaluate(() => {
      const viewport = document.documentElement.clientWidth;
      const scroll = document.documentElement.scrollWidth > viewport ? [`scroll horizontal (${document.documentElement.scrollWidth} > ${viewport})`] : [];
      const overflowing = [...document.querySelectorAll('body *')]
        .filter((el) => !el.closest('svg, dialog:not([open]), noscript') && getComputedStyle(el).position !== 'fixed')
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.width > 0 && (r.right > viewport + 1 || r.left < -1))
        // Las decoraciones que recorta su contenedor (el fondo de video con overflow oculto) no cuentan.
        .filter(({ el }) => !el.closest('.works-bg'))
        .map(({ el, r }) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${String(el.className).split(' ')[0]} (${Math.round(r.left)}→${Math.round(r.right)})`);
      return [...scroll, ...overflowing.slice(0, 8)];
    });
    expect(problems).toEqual([]);
  });
}

for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [1024, 768], [1440, 900]]) {
  test(`regla22: a ${width}×${height} todo control interactivo mide al menos 44 × 44 px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    const small = await page.evaluate(() =>
      [...document.querySelectorAll('a[href], button, input, textarea')]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' && !el.closest('dialog:not([open])');
        })
        .map((el) => ({ name: el.id || el.getAttribute('aria-label') || el.textContent.trim().slice(0, 30), r: el.getBoundingClientRect() }))
        .filter(({ r }) => Math.round(r.width) < 44 || Math.round(r.height) < 44)
        .map(({ name, r }) => `${name} ${Math.round(r.width)}×${Math.round(r.height)}`),
    );
    expect(small).toEqual([]);
  });
}

test('regla21: el hero muestra el título y el botón principal sin scrollear en todos los tamaños de celular', async ({ page }) => {
  for (const [width, height] of [[320, 568], [360, 740], [375, 667], [390, 844], [414, 896]]) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 }), `${width}×${height}`).toBeInViewport({ ratio: 1 });
    await expect(page.locator('#cta-hero'), `${width}×${height}`).toBeInViewport({ ratio: 1 });
  }
});

test('regla21: a 2560 px el contenido queda centrado con un ancho máximo', async ({ page }) => {
  await page.setViewportSize({ width: 2560, height: 1000 });
  await page.goto('/');
  for (const wrap of await page.locator('.wrap').all()) {
    const box = await wrap.boundingBox();
    expect(box.width).toBeLessThanOrEqual(1300);
    expect(Math.abs(box.x - (2560 - box.width - box.x))).toBeLessThan(4);
  }
});

test('el botón flotante de WhatsApp no tapa el botón principal en ningún celular', async ({ page }) => {
  for (const [width, height] of [[320, 568], [360, 740], [375, 667], [390, 844], [414, 896]]) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    const cta = await page.locator('#cta-hero').boundingBox();
    const fab = await page.locator('#fab-whatsapp').boundingBox();
    const overlaps = cta.x < fab.x + fab.width && cta.x + cta.width > fab.x && cta.y < fab.y + fab.height && cta.y + cta.height > fab.y;
    expect(overlaps, `${width}×${height}: CTA ${JSON.stringify(cta)} vs botón flotante ${JSON.stringify(fab)}`).toBe(false);
  }
});

test('el menú se ve en tablet y se esconde en celular', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Principal' })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('navigation', { name: 'Principal' })).toBeHidden();
});
