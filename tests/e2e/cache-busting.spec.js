import { test, expect } from '@playwright/test';

// Reproduce el fallo real: Cloudflare le da 4 horas de caché al navegador, y quien ya visitó el sitio tenía el CSS
// y el JS viejos guardados bajo las URLs sin versión. Acá esas URLs devuelven basura; si la página las pidiera, se rompería.
test('nada pide el CSS ni el JS sin versión: un caché viejo de esas URLs no rompe la página', async ({ page }) => {
  const unversioned = [];
  await page.route(/\/(assets\/styles\.css|js\/[\w-]+\.js)$/, (route) => {
    unversioned.push(route.request().url());
    route.fulfill({ status: 200, contentType: 'text/plain', body: '/* caché viejo */' });
  });

  await page.goto('/');
  expect(unversioned).toEqual([]);

  // Tiene estilos: el hero es oscuro.
  await expect(page.locator('.hero-text')).toHaveCSS('background-color', 'rgb(17, 17, 17)');
  // Tiene JavaScript, con todos sus módulos: el contador del formulario responde.
  await page.getByRole('textbox', { name: 'Descripción del proyecto', exact: true }).fill('hola');
  await expect(page.locator('#descripcion-contador')).toHaveText('4 / 500');
});
