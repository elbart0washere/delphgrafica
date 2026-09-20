import { test, expect } from '@playwright/test';

test('US5-S5: los íconos del footer se anuncian por nombre y llevan al destino correcto', async ({ page }) => {
  await page.goto('/');
  const footer = page.locator('#pie');
  await expect(footer.getByRole('link', { name: 'Instagram', exact: true })).toHaveAttribute('href', 'https://www.instagram.com/graficadelph/');
  await expect(footer.getByRole('link', { name: 'WhatsApp', exact: true })).toHaveAttribute('href', 'https://wa.me/5491172394787');
  await expect(footer.getByRole('link', { name: 'Email', exact: true })).toHaveAttribute('href', 'mailto:clientes@delphgrafica.com.ar');
});
