import { test, expect } from '@playwright/test';

const srcs = (page) => page.locator('.gallery img').evaluateAll((imgs) => imgs.map((img) => img.getAttribute('src')));

test('el botón del inicio lleva al portfolio', async ({ page }) => {
  await page.goto('/');
  await page.locator('#btn-portfolio').click();
  await expect(page).toHaveURL(/\/portfolio\.html$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nuestros trabajos');
});

test('el orden cambia entre visitas pero siempre están todas las fotos', async ({ page }) => {
  const orders = new Set();
  let all = null;
  for (let i = 0; i < 8; i++) {
    await page.goto('/portfolio.html');
    const order = await srcs(page);
    orders.add(order.join('|'));
    all = [...order].sort().join('|');
    expect(order).toHaveLength(18);
  }
  expect(orders.size).toBeGreaterThan(1);
  expect(new Set(all.split('|')).size).toBe(18);
});

test('al tocar una foto se abre ampliada y se navega con teclado y botones', async ({ page }) => {
  await page.goto('/portfolio.html');
  const visor = page.locator('#visor');
  const first = (await srcs(page))[0];
  await page.locator('.gallery button').first().click();
  await expect(visor).toBeVisible();
  await expect(visor.locator('img')).toHaveAttribute('src', new RegExp(first.split('?')[0]));
  await expect(visor.locator('[data-visor-contador]')).toHaveText('1 de 20');

  await page.keyboard.press('ArrowRight');
  await expect(visor.locator('[data-visor-contador]')).toHaveText('2 de 20');
  await visor.locator('[data-visor-anterior]').click();
  await visor.locator('[data-visor-anterior]').click();
  await expect(visor.locator('[data-visor-contador]')).toHaveText('20 de 20');

  await page.keyboard.press('Escape');
  await expect(visor).toBeHidden();
  await expect(page.locator('.gallery button').first()).toBeFocused();
});

test('sin JavaScript se ven las 18 fotos y los 2 videos en el orden del HTML', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL: 'http://localhost:4173' });
  const page = await context.newPage();
  await page.goto('/portfolio.html');
  await expect(page.locator('.gallery img')).toHaveCount(18);
  await context.close();
});

test('no hay scroll horizontal', async ({ page }) => {
  await page.goto('/portfolio.html');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('al tocar un video se abre ampliado en el visor, con controles, y se pausa al cerrar', async ({ page }) => {
  await page.goto('/portfolio.html');
  const visor = page.locator('#visor');
  await page.locator('.gallery button:has(video)').first().click();
  await expect(visor).toBeVisible();
  await expect(visor.locator('video')).toBeVisible();
  await expect(visor.locator('img')).toBeHidden();
  expect(await visor.locator('video').getAttribute('controls')).not.toBeNull();
  expect(await visor.locator('video').getAttribute('src')).toMatch(/portfolio-videos\/.+\.mp4/);

  await page.keyboard.press('ArrowRight');
  await expect.poll(() => visor.locator('video').isHidden() || visor.locator('img').isHidden()).toBe(true);
  await page.keyboard.press('Escape');
  await expect(visor).toBeHidden();
  expect(await visor.locator('video').evaluate((v) => v.paused)).toBe(true);
});
