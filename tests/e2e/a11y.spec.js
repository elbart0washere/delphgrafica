import { test, expect } from '@playwright/test';

const INTERACTIVE = 'a[href], button, input, textarea';

test('regla22: todo control interactivo mide al menos 44 × 44 px', async ({ page }) => {
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    const small = await page.evaluate((selector) => {
      const isVisible = (el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' && !el.closest('dialog:not([open])');
      };
      return [...document.querySelectorAll(selector)]
        .filter(isVisible)
        .map((el) => ({ el: (el.id || el.getAttribute('aria-label') || el.textContent.trim().slice(0, 30)), r: el.getBoundingClientRect() }))
        .filter(({ r }) => Math.round(r.width) < 44 || Math.round(r.height) < 44)
        .map(({ el, r }) => `${el} ${Math.round(r.width)}×${Math.round(r.height)}`);
    }, INTERACTIVE);
    expect(small, `a ${width}px`).toEqual([]);
  }
});

test('regla20: todo lo que se puede enfocar con teclado muestra un indicador de foco', async ({ page }) => {
  await page.goto('/');
  const missing = [];
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const style = getComputedStyle(el);
      return { name: el.id || el.getAttribute('aria-label') || el.textContent.trim().slice(0, 30), outline: style.outlineStyle, width: parseFloat(style.outlineWidth) };
    });
    if (info && (info.outline === 'none' || info.width === 0)) missing.push(info.name);
  }
  expect(missing).toEqual([]);
});
