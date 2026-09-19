import { test, expect } from '@playwright/test';

test.use({ javaScriptEnabled: false });

test('US1-regla26: sin JavaScript el formulario no se ve y aparece el aviso con enlace a WhatsApp', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('#form-cotizar')).toBeHidden();

  // getByText ignora todo lo que está dentro de <noscript>, así que se usa un selector CSS.
  const notice = page.locator('#cotizar noscript p');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('Activá JavaScript o escribinos directo por');
  await expect(notice.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', 'https://wa.me/5491172394787');
});
