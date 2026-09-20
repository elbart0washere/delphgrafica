import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('US2-S1: en un celular de 360 px se ve todo sin scrollear', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');

  const header = page.locator('header');
  await expect(header.getByRole('img', { name: 'Gráfica Delph' })).toBeVisible();
  for (const locator of [page.locator('#badge-construccion'), page.getByRole('heading', { level: 1 }), page.locator('#cta-hero')]) {
    await expect(locator).toBeInViewport({ ratio: 1 });
  }
  await expect(page.locator('#badge-construccion')).toHaveText('Sitio en construcción');
  await expect(page.locator('#cta-hero')).toHaveText('Cotizá tu proyecto');
});

test('US2-S2: tocar el CTA lleva al formulario y mueve el foco a esa sección', async ({ page }) => {
  await page.locator('#cta-hero').click();
  await expect(page.locator('#cotizar')).toBeInViewport();
  await expect(page.locator('#cotizar')).toBeFocused();
});

test('US2-S3: con Tab se llega al CTA y tiene indicador de foco visible', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'Safari no enfoca los enlaces con Tab salvo que el usuario lo active en sus preferencias');
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press('Tab');
    if (await page.locator('#cta-hero').evaluate((el) => el === document.activeElement)) break;
  }
  await expect(page.locator('#cta-hero')).toBeFocused();
  const outline = await page.locator('#cta-hero').evaluate((el) => {
    const style = getComputedStyle(el);
    return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
  });
  expect(outline.style).not.toBe('none');
  expect(outline.width).toBeGreaterThan(0);
});

test('US2-S4: con movimiento reducido el desplazamiento es instantáneo', async ({ page }) => {
  const behavior = () => page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await behavior()).toBe('auto');

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  expect(await behavior()).toBe('smooth');
});
