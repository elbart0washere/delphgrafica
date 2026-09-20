import { test, expect } from '@playwright/test';

const WA = 'https://wa.me/5491172394787?text=';

test.beforeEach(async ({ page }) => {
  // Captura window.open en vez de abrir WhatsApp de verdad.
  await page.addInitScript(() => {
    window.__opened = [];
    window.open = (...args) => {
      window.__opened.push(args);
      return null;
    };
  });
  await page.goto('/');
});

const field = (page, name) => page.getByRole('textbox', { name, exact: true });
const nameField = (page) => field(page, 'Nombre');
const emailField = (page) => field(page, 'Email');
const phoneField = (page) => field(page, 'Teléfono');
const descriptionField = (page) => field(page, 'Descripción del proyecto');
const submit = (page) => page.getByRole('button', { name: 'Enviar por WhatsApp' });

async function fillForm(page, { name = '', email = '', phone = '', description = '' }) {
  await nameField(page).fill(name);
  await emailField(page).fill(email);
  await phoneField(page).fill(phone);
  await descriptionField(page).fill(description);
}

const opened = (page) => page.evaluate(() => window.__opened);
const openedText = async (page) => {
  const [[url]] = await opened(page);
  return decodeURIComponent(url.split('?text=')[1]);
};

const lucia = { name: 'Lucía', email: 'lucia@mail.com', description: 'Necesito 50 lonas de 2x1' };

test('US1-regla1: el formulario tiene exactamente cuatro campos', async ({ page }) => {
  await expect(page.locator('#form-cotizar input, #form-cotizar textarea')).toHaveCount(4);
});

test('US1-regla3: los campos tienen su tope como maxlength', async ({ page }) => {
  await expect(nameField(page)).toHaveAttribute('maxlength', '60');
  await expect(emailField(page)).toHaveAttribute('maxlength', '100');
  await expect(phoneField(page)).toHaveAttribute('maxlength', '30');
  await expect(descriptionField(page)).toHaveAttribute('maxlength', '500');
});

test('US1-S1: con nombre, email y descripción abre WhatsApp con el mensaje, sin línea de teléfono', async ({ page }) => {
  await fillForm(page, lucia);
  await submit(page).click();

  const calls = await opened(page);
  expect(calls).toHaveLength(1);
  expect(calls[0][0].startsWith(WA)).toBe(true);
  const text = await openedText(page);
  expect(text).toContain('Soy Lucía');
  expect(text).toContain('Necesito 50 lonas de 2x1');
  expect(text).toContain('- Email: lucia@mail.com');
  expect(text).not.toContain('Teléfono');
});

test('US1-regla5: abre en pestaña nueva y con noopener', async ({ page }) => {
  await fillForm(page, lucia);
  await submit(page).click();
  const [[, target, features]] = await opened(page);
  expect(target).toBe('_blank');
  expect(features).toContain('noopener');
});

test('US1-S2: con solo teléfono el mensaje lleva el teléfono y no el email', async ({ page }) => {
  await fillForm(page, { name: 'Lucía', phone: '11 5555-1234', description: 'Necesito lonas' });
  await submit(page).click();

  const text = await openedText(page);
  expect(text).toContain('- Teléfono: 11 5555-1234');
  expect(text).not.toContain('Email');
});

test('US1-S3: sin email ni teléfono no abre WhatsApp, muestra el error y enfoca el email', async ({ page }) => {
  await fillForm(page, { name: 'Lucía', description: 'Necesito lonas' });
  await submit(page).click();

  expect(await opened(page)).toHaveLength(0);
  await expect(page.getByText('Dejanos al menos un dato de contacto: email o teléfono')).toBeVisible();
  await expect(emailField(page)).toBeFocused();
});

test('US1-S4: nombre vacío o de espacios no abre WhatsApp, marca el campo y lo enfoca', async ({ page }) => {
  await fillForm(page, { name: '   ', email: 'lucia@mail.com', description: 'Necesito lonas' });
  await submit(page).click();

  expect(await opened(page)).toHaveLength(0);
  await expect(page.getByText('Contanos tu nombre.')).toBeVisible();
  await expect(nameField(page)).toHaveAttribute('aria-invalid', 'true');
  await expect(nameField(page)).toBeFocused();
});

test('US1-S5: email inválido o teléfono con letras muestran su error aunque el otro dato esté bien', async ({ page }) => {
  await fillForm(page, { ...lucia, email: 'lucia@', phone: '11 5555-1234' });
  await submit(page).click();
  expect(await opened(page)).toHaveLength(0);
  await expect(page.getByText('Ingresá un email válido', { exact: false })).toBeVisible();
  await expect(emailField(page)).toBeFocused();

  await fillForm(page, { ...lucia, phone: '11 abcd-1234' });
  await submit(page).click();
  expect(await opened(page)).toHaveLength(0);
  await expect(page.getByText('Ingresá un teléfono válido', { exact: false })).toBeVisible();
  await expect(phoneField(page)).toBeFocused();
});

test('US1-S6: al llegar al tope no se puede escribir más y aparece el aviso con el contador lleno', async ({ page }) => {
  const description = descriptionField(page);
  await description.fill('a'.repeat(500));

  await expect(page.getByText('500 / 500')).toBeVisible();
  await expect(page.getByText('Llegaste al límite. Resumí tu pedido y mandanos el detalle por WhatsApp.')).toBeVisible();

  await description.pressSequentially('b');
  expect(await description.inputValue()).toHaveLength(500);
});

test('US1-S7: pegar más de lo que entra muestra el aviso de recorte', async ({ page }) => {
  const description = descriptionField(page);
  await description.focus();
  await page.evaluate(() => {
    const data = new DataTransfer();
    data.setData('text/plain', 'x'.repeat(501));
    document.querySelector('#descripcion').dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  });

  await expect(
    page.getByText('Pegaste más de 500 caracteres, así que recortamos el texto. Revisalo y mandanos el detalle por WhatsApp.'),
  ).toBeVisible();
});

test('US1-S7 (pegado real): el navegador recorta a 500 y el aviso aparece', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'los permisos de portapapeles solo existen en Chromium');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.evaluate(() => navigator.clipboard.writeText('y'.repeat(600)));

  const description = descriptionField(page);
  await description.focus();
  await page.keyboard.press('ControlOrMeta+V');

  expect(await description.inputValue()).toHaveLength(500);
  await expect(page.getByText('Pegaste más de 500 caracteres', { exact: false })).toBeVisible();
});

test('US1-S8: tildes, saltos de línea, emojis, &, ? y # llegan íntegros', async ({ page }) => {
  const description = 'Cartelería: ¿50 lonas? Tamaño 2x1 & luz #3 😀\nSegunda línea…';
  await fillForm(page, { ...lucia, description });
  await submit(page).click();

  const [[url]] = await opened(page);
  expect(url.split('?')).toHaveLength(2);
  expect(await openedText(page)).toContain(description);
});

test('US1-S9: tras enviar conserva los datos y ofrece un enlace al mismo mensaje', async ({ page }) => {
  await fillForm(page, lucia);
  await submit(page).click();

  await expect(nameField(page)).toHaveValue('Lucía');
  await expect(descriptionField(page)).toHaveValue('Necesito 50 lonas de 2x1');

  const status = page.locator('#estado');
  await expect(status).toHaveText('Se abrió WhatsApp con tu consulta. Si no se abrió, tocá acá.');
  const [[url]] = await opened(page);
  await expect(status.getByRole('link', { name: 'tocá acá' })).toHaveAttribute('href', url);
});

test('US1-regla10: enviar no manda datos a ningún servidor', async ({ page }) => {
  // Las imágenes con carga diferida (el logo del pie) pueden pedirse al hacer scroll: no son un envío de datos.
  // Lo que importaría son los requests que podrían llevar los datos: fetch, XHR, beacons y todo lo que no sea GET.
  const DATA_REQUESTS = ['fetch', 'xhr', 'ping', 'websocket', 'eventsource'];
  const requests = [];
  page.on('request', (request) => {
    if (request.frame() !== page.mainFrame()) return; // un iframe de terceros no lleva datos del formulario
    if (request.method() !== 'GET' || DATA_REQUESTS.includes(request.resourceType())) requests.push(`${request.method()} ${request.url()}`);
  });
  await fillForm(page, lucia);
  await submit(page).click();
  expect(await opened(page)).toHaveLength(1);
  expect(requests).toEqual([]);
});

test('US1-regla23: cada campo tiene su etiqueta y los errores se anuncian', async ({ page }) => {
  for (const label of ['Nombre', 'Email', 'Teléfono', 'Descripción del proyecto']) {
    await expect(field(page, label)).toBeVisible();
  }
  await submit(page).click();
  const alerts = page.getByRole('alert');
  await expect(alerts.filter({ hasText: 'Contanos tu nombre.' })).toHaveCount(1);
  await expect(alerts.filter({ hasText: 'Contanos brevemente qué necesitás.' })).toHaveCount(1);
});
