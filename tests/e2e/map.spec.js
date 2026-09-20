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

test('en celular y tablet el mapa va después del formulario; en escritorio, en la columna izquierda', async ({ page }) => {
  const boxes = async () => ({
    form: await page.locator('#form-cotizar').boundingBox(),
    map: await page.locator('.map').boundingBox(),
  });

  for (const width of [390, 768, 820]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const { form, map } = await boxes();
    expect(map.y, `${width}px: el mapa tiene que quedar debajo del formulario`).toBeGreaterThanOrEqual(form.y + form.height - 1);
  }

  for (const width of [1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const { form, map } = await boxes();
    expect(map.x + map.width, `${width}px: el mapa queda a la izquierda del formulario`).toBeLessThanOrEqual(form.x + 1);
    expect(map.y, `${width}px: y empieza a la altura del formulario, no debajo`).toBeLessThan(form.y + form.height);
  }
});
