import { test, expect } from '@playwright/test';

for (const width of [320, 360, 768, 1280, 1920, 2560]) {
  test(`regla21: sin scroll horizontal a ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
}

test('regla21: a 2560 px el contenido queda centrado con un ancho máximo', async ({ page }) => {
  await page.setViewportSize({ width: 2560, height: 1000 });
  await page.goto('/');
  for (const wrap of await page.locator('.wrap').all()) {
    const box = await wrap.boundingBox();
    expect(box.width).toBeLessThanOrEqual(1300);
    expect(Math.abs(box.x - (2560 - box.width - box.x))).toBeLessThan(4);
  }
});
