import { test, expect } from '@playwright/test';

// Mismos tamaños que responsive.spec.js: celulares (vertical y horizontal), tablets, notebooks y pantallas anchas.
const SIZES = [
  [320, 568], [360, 740], [375, 667], [390, 844], [414, 896], [600, 900], [740, 360],
  [768, 1024], [820, 1180], [1024, 768], [1180, 820], [1280, 800], [1440, 900], [1920, 1080], [2560, 1440],
];

for (const [width, height] of SIZES) {
  test(`portfolio a ${width}×${height}: sin scroll horizontal, controles de 44 px y columnas acordes`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/portfolio.html');
    await page.waitForLoadState('networkidle');

    const problems = await page.evaluate(() => {
      const viewport = document.documentElement.clientWidth;
      const out = [];
      if (document.documentElement.scrollWidth > viewport) out.push(`scroll horizontal (${document.documentElement.scrollWidth} > ${viewport})`);
      for (const el of document.querySelectorAll('body *')) {
        if (el.closest('svg, dialog:not([open]), noscript') || getComputedStyle(el).position === 'fixed') continue;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && (r.right > viewport + 1 || r.left < -1)) out.push(`se sale: ${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`);
      }
      for (const el of document.querySelectorAll('a[href], button')) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && (Math.round(r.width) < 44 || Math.round(r.height) < 44)) out.push(`chico: ${el.getAttribute('aria-label') || el.textContent.trim().slice(0, 20)} ${Math.round(r.width)}×${Math.round(r.height)}`);
      }
      return out.slice(0, 8);
    });
    expect(problems).toEqual([]);

    const columns = await page.locator('.gallery').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    expect(columns).toBe(width <= 640 ? 2 : width < 1100 ? 3 : 4);
  });
}

for (const [width, height] of SIZES) {
  test(`portfolio a ${width}×${height}: el visor muestra la foto y los botones dentro de la pantalla, sin pisarse`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/portfolio.html');
    // Foto cuadrada fija: con el orden aleatorio, una vertical muy alta se vería angosta con razón.
    await page.locator('.gallery button:has(img[src*="lona-ojales-1"])').click();
    const box = async (selector) => page.locator(selector).boundingBox();
    const photo = await box('#visor img');
    for (const selector of ['[data-visor-cerrar]', '[data-visor-anterior]', '[data-visor-siguiente]']) {
      const b = await box(selector);
      expect(b.x, selector).toBeGreaterThanOrEqual(0);
      expect(b.y, selector).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width, selector).toBeLessThanOrEqual(width);
      expect(b.y + b.height, selector).toBeLessThanOrEqual(height);
      expect(b.width, selector).toBeGreaterThanOrEqual(44);
    }
    expect(photo.x).toBeGreaterThanOrEqual(0);
    expect(photo.y).toBeGreaterThanOrEqual(0);
    expect(photo.x + photo.width).toBeLessThanOrEqual(width);
    expect(photo.y + photo.height).toBeLessThanOrEqual(height);
    // Una foto cuadrada tiene que verse a un tamaño útil, no en miniatura: al menos 60 % del lado menor de la pantalla.
    expect(Math.min(photo.width, photo.height)).toBeGreaterThanOrEqual(Math.min(width, height) * 0.6);
    // El botón de cerrar no tapa la foto (anterior y siguiente sí pueden apoyarse sobre sus bordes: tienen fondo propio).
    const close = await box('[data-visor-cerrar]');
    const overlaps = close.x < photo.x + photo.width && close.x + close.width > photo.x && close.y < photo.y + photo.height && close.y + close.height > photo.y;
    expect(overlaps, `cerrar ${JSON.stringify(close)} vs foto ${JSON.stringify(photo)}`).toBe(false);
  });
}
