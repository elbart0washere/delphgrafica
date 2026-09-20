import { test, expect } from '@playwright/test';

const cards = (page) => page.locator('#servicios article');

async function boxes(page) {
  const all = await cards(page).all();
  return Promise.all(all.map((card) => card.boundingBox()));
}

test('US3-S2: a 360 px los servicios se apilan y no hay scroll horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');

  const list = await boxes(page);
  expect(list).toHaveLength(4);
  for (let i = 1; i < list.length; i++) {
    expect(Math.abs(list[i].x - list[0].x)).toBeLessThan(2);
    expect(list[i].y).toBeGreaterThan(list[i - 1].y);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('US3-S3: en tablet los servicios van de a dos y en pantalla ancha, en cuatro columnas', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto('/');
  let list = await boxes(page);
  expect(Math.abs(list[0].y - list[1].y)).toBeLessThan(2);
  expect(list[2].y).toBeGreaterThan(list[0].y + 10);

  await page.setViewportSize({ width: 1280, height: 900 });
  list = await boxes(page);
  for (const box of list) expect(Math.abs(box.y - list[0].y)).toBeLessThan(2);
  expect(new Set(list.map((box) => Math.round(box.x))).size).toBe(4);
});
