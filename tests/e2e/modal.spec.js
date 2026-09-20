import { test, expect } from '@playwright/test';

const NOTICE =
  'Próximamente: La carga directa de archivos estará disponible muy pronto. Por el momento, podés enviarnos tus archivos de diseño directamente por WhatsApp.';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__opened = [];
    window.open = (...args) => {
      window.__opened.push(args);
      return null;
    };
  });
  await page.goto('/');
});

const attach = (page) => page.getByRole('button', { name: 'Adjuntar archivo / Arte final' });
const dialog = (page) => page.locator('#modal-arte');
const open = async (page) => {
  await attach(page).click();
  await expect(dialog(page)).toBeVisible();
};

test('US6-S1: tocar "Adjuntar archivo / Arte final" abre el modal con el aviso', async ({ page }) => {
  await open(page);
  await expect(dialog(page).getByText(NOTICE, { exact: true })).toBeVisible();
});

test('US6-S2: "Abrir WhatsApp" abre el chat del taller con un mensaje sobre el arte final', async ({ page }) => {
  await open(page);
  const link = dialog(page).getByRole('link', { name: 'Abrir WhatsApp' });
  const href = await link.getAttribute('href');
  expect(href.startsWith('https://wa.me/5491172394787?text=')).toBe(true);
  expect(decodeURIComponent(href.split('?text=')[1])).toBe('Hola! Quiero enviarles un arte final para cotizar.');
  await expect(link).toHaveAttribute('target', '_blank');
});

for (const [id, close] of [
  ['US6-S3a', (page) => page.keyboard.press('Escape')],
  ['US6-S3b', (page) => dialog(page).getByRole('button', { name: 'Cerrar' }).click()],
  ['US6-S3c', (page) => page.mouse.click(5, 5)],
]) {
  test(`${id}: se cierra y el foco vuelve al botón`, async ({ page }) => {
    await open(page);
    await close(page);
    await expect(dialog(page)).toBeHidden();
    await expect(attach(page)).toBeFocused();
  });
}

test('US6-S4: el foco no sale del modal hacia el contenido de atrás', async ({ page }) => {
  await open(page);
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    const inside = await page.evaluate(() => document.activeElement === document.body || !!document.activeElement.closest('#modal-arte'));
    expect(inside).toBe(true);
  }
});

test('US6-S5: no envía ni valida el formulario, no abre el selector de archivos y conserva los datos', async ({ page }) => {
  let chooser = false;
  page.on('filechooser', () => (chooser = true));

  await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill('Lucía');
  await page.getByRole('textbox', { name: 'Descripción del proyecto', exact: true }).fill('Necesito lonas');
  await open(page);

  expect(chooser).toBe(false);
  expect(await page.evaluate(() => window.__opened)).toHaveLength(0);
  await expect(page.locator('[aria-invalid="true"]')).toHaveCount(0);
  await dialog(page).getByRole('button', { name: 'Cerrar' }).click();
  await expect(page.getByRole('textbox', { name: 'Nombre', exact: true })).toHaveValue('Lucía');
  await expect(page.getByRole('textbox', { name: 'Descripción del proyecto', exact: true })).toHaveValue('Necesito lonas');
});
