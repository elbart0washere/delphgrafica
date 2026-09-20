import { test, expect } from '@playwright/test';

const clip = (page) => page.locator('#trabajos');
const video = (page) => page.locator('[data-clip] video');
const toggle = (page) => page.locator('[data-clip-toggle]');
const counts = (page) => page.evaluate(() => window.__media);

test.beforeEach(async ({ page }) => {
  // Cuenta los play() y pause() en vez de depender del códec: el Chromium de Playwright no trae H.264.
  await page.addInitScript(() => {
    window.__media = { play: 0, pause: 0 };
    const { play, pause } = HTMLMediaElement.prototype;
    HTMLMediaElement.prototype.play = function (...args) {
      window.__media.play++;
      return play.apply(this, args);
    };
    HTMLMediaElement.prototype.pause = function (...args) {
      window.__media.pause++;
      return pause.apply(this, args);
    };
  });
});

test('el video y su portada no se piden al cargar la página', async ({ page }) => {
  const requested = [];
  page.on('request', (request) => {
    if (/calcos-plotter/.test(request.url())) requested.push(request.url());
  });
  await page.goto('/', { waitUntil: 'networkidle' });
  expect(requested).toEqual([]);
  expect(await video(page).getAttribute('src')).toBeNull();
});

test('al acercarse a la pantalla carga el video y lo reproduce', async ({ page }) => {
  await page.goto('/');
  await clip(page).scrollIntoViewIfNeeded();

  await expect(video(page)).toHaveAttribute('src', /calcos-plotter\.mp4\?v=[0-9a-f]{8}/);
  await expect(video(page)).toHaveAttribute('poster', /calcos-plotter\.jpg\?v=[0-9a-f]{8}/);
  await expect.poll(async () => (await counts(page)).play).toBeGreaterThanOrEqual(1);
});

test('al salir de la pantalla se pausa', async ({ page }) => {
  await page.goto('/');
  await clip(page).scrollIntoViewIfNeeded();
  await expect.poll(async () => (await counts(page)).play).toBeGreaterThanOrEqual(1);

  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(async () => (await counts(page)).pause).toBeGreaterThanOrEqual(1);
});

test('con movimiento reducido no arranca solo, y el botón lo reproduce', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await clip(page).scrollIntoViewIfNeeded();
  await expect(video(page)).toHaveAttribute('src', /calcos-plotter\.mp4/); // se prepara, pero no se reproduce
  await page.waitForTimeout(500);
  expect((await counts(page)).play).toBe(0);
  await expect(toggle(page)).toHaveText('Reproducir video');

  await toggle(page).click();
  expect((await counts(page)).play).toBe(1);
});

test('es el fondo de Trabajos: ancho completo y 40 % de opacidad, con el texto sobre un fondo sólido', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  const section = await page.locator('#trabajos').boundingBox();
  const media = await video(page).boundingBox();
  expect(Math.abs(media.width - section.width)).toBeLessThan(2);
  expect(media.height).toBeGreaterThan(300);
  expect(await video(page).evaluate((el) => getComputedStyle(el).opacity)).toBe('0.4');
  // El texto de la sección no se apoya sobre el video: va sobre blanco (contraste, regla 19).
  expect(await page.locator('.works-copy').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
});

test('el botón mide al menos 44 px de alto (regla 22)', async ({ page }) => {
  await page.goto('/');
  await clip(page).scrollIntoViewIfNeeded();
  const box = await toggle(page).boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.width).toBeGreaterThanOrEqual(44);
});

test('WebKit reproduce de verdad: el botón pasa de "Pausar" a "Reproducir"', async ({ page, browserName }) => {
  test.skip(browserName !== 'webkit', 'solo WebKit trae el códec H.264 en Playwright');
  await page.goto('/');
  await clip(page).scrollIntoViewIfNeeded();

  await expect.poll(() => video(page).evaluate((el) => el.currentTime)).toBeGreaterThan(0);
  await expect(toggle(page)).toHaveText('Pausar video');

  await toggle(page).click();
  await expect(toggle(page)).toHaveText('Reproducir video');
  expect(await video(page).evaluate((el) => el.paused)).toBe(true);
});
