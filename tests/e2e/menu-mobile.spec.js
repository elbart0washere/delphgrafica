import { test, expect } from '@playwright/test';

// El menú (Servicios, Portfolio, Cotizar, Subí tu diseño) tiene que verse en el celular, no solo en la PC.
for (const [width, height] of [[320, 568], [390, 844], [600, 900]]) {
  for (const path of ['/', '/portfolio.html']) {
    test(`menú visible a ${width}×${height} en ${path}, con Portfolio y objetivos de 44 px`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto(path);
      const links = page.locator('header nav.menu a');
      await expect(links).toHaveCount(4);
      await expect(links.nth(1)).toHaveText('Portfolio');
      for (const link of await links.all()) {
        await expect(link).toBeVisible();
        const box = await link.boundingBox();
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    });
  }
}

test('tocar Portfolio en el celular abre la página de portfolio', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('header nav.menu a', { hasText: 'Portfolio' }).click();
  await expect(page).toHaveURL(/portfolio\.html$/);
});
