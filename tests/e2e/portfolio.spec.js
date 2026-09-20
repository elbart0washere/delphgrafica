import { test, expect } from '@playwright/test';

const tile = (page) => page.locator('#trabajos .tile-a');
const transform = (page) => tile(page).evaluate((el) => getComputedStyle(el).transform);

test('US4-S2: con puntero, el bloque escala al pasar el cursor (y no con movimiento reducido)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'el hover es de dispositivos con puntero');
  await page.goto('/');
  await tile(page).scrollIntoViewIfNeeded();

  expect(await transform(page)).toBe('none');
  await tile(page).hover();
  await expect.poll(() => transform(page)).toMatch(/^matrix\(1\.0\d*/);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.mouse.move(0, 0);
  await tile(page).hover();
  expect(await transform(page)).toBe('none');
});

test('US4-S3: en táctil los títulos ya se ven sin hover', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'solo aplica al proyecto táctil');
  await page.goto('/');
  const labels = page.locator('#trabajos .tile-label');
  await expect(labels).toHaveCount(7);
  for (const label of await labels.all()) await expect(label).toBeVisible();
});

test('US4-S4-click: el banner abre el Instagram de Delph en una pestaña nueva', async ({ page, context }) => {
  await context.route('https://www.instagram.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: 'ok' }));
  await page.goto('/');
  const [popup] = await Promise.all([context.waitForEvent('page'), page.locator('#btn-ig-banner').click()]);
  expect(popup.url()).toBe('https://www.instagram.com/graficadelph/');
});
