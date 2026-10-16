import { test, expect } from '@playwright/test';

const PAGES = ['/grafica-en-moreno.html', '/grafica-en-paso-del-rey.html'];
const srcs = (page) => page.locator('#trabajos .gallery img').evaluateAll((imgs) => imgs.map((img) => img.getAttribute('src')));

for (const path of PAGES) {
  test(`${path}: muestra 6 fotos del portfolio y la muestra cambia entre visitas`, async ({ page }) => {
    await page.goto('/portfolio.html');
    const all = new Set(await page.locator('.gallery img').evaluateAll((imgs) => imgs.map((img) => img.getAttribute('src'))));

    const samples = new Set();
    for (let i = 0; i < 6; i++) {
      await page.goto(path);
      await expect(page.locator('#trabajos')).toBeVisible();
      const shown = await srcs(page);
      expect(shown).toHaveLength(6);
      expect(new Set(shown).size).toBe(6);
      for (const src of shown) expect(all.has(src), src).toBe(true);
      samples.add(shown.join('|'));
    }
    expect(samples.size).toBeGreaterThan(1);
  });

  test(`${path}: una foto lleva al portfolio`, async ({ page }) => {
    await page.goto(path);
    await page.locator('#trabajos .gallery a').first().click();
    await expect(page).toHaveURL(/\/portfolio\.html$/);
  });
}

test.describe('sin JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  for (const path of PAGES) {
    test(`${path}: igual muestra las 6 fotos que trae el HTML`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('#trabajos')).toBeVisible();
      await expect(page.locator('#trabajos .gallery img')).toHaveCount(6);
    });
  }
});
