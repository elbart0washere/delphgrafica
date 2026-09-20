import { test, expect } from '@playwright/test';

test('el mapa y su botón entran en la columna en todos los tamaños', async ({ page }) => {
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const frame = await page.locator('.map-frame').boundingBox();
    expect(frame.x, `${width}px`).toBeGreaterThanOrEqual(0);
    expect(frame.x + frame.width, `${width}px`).toBeLessThanOrEqual(width);
    expect(frame.height, `${width}px`).toBeGreaterThanOrEqual(240);
    const button = await page.getByRole('link', { name: 'Cómo llegar' }).boundingBox();
    expect(button.height).toBeGreaterThanOrEqual(44);
  }
});
