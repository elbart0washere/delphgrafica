import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { findExternalImages, findPromiseWords, visibleText } from '../helpers/guards.js';

const read = (file) => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
const dom = (file) => new JSDOM(read(file)).window.document;
const portfolioPhotos = new Map([...dom('portfolio.html').querySelectorAll('.gallery img')].map((img) => [img.getAttribute('src'), img]));

// Las landings muestran trabajos reales del portfolio. El HTML ya trae 6 fotos (las copia `npm run build`, para que
// Google y quien no tiene JavaScript las vean) y js/trabajos.js las cambia por una muestra al azar en cada visita.
describe.each(['grafica-en-moreno.html', 'grafica-en-paso-del-rey.html'])('galería de trabajos en %s', (page) => {
  const html = read(page);
  const document = dom(page);
  const section = document.querySelector('main #trabajos');
  const photos = [...section.querySelectorAll('ul.gallery[data-trabajos] img')];

  it('trae 6 fotos distintas en el HTML, con la sección visible', () => {
    expect(section.hasAttribute('hidden')).toBe(false);
    expect(photos).toHaveLength(6);
    expect(new Set(photos.map((img) => img.getAttribute('src'))).size).toBe(6);
  });

  it('todas existen en el portfolio, con su misma descripción y medidas', () => {
    for (const img of photos) {
      const original = portfolioPhotos.get(img.getAttribute('src'));
      expect(original, `${img.getAttribute('src')} no está en el portfolio (corré npm run build)`).toBeDefined();
      for (const attribute of ['alt', 'width', 'height']) expect(img.getAttribute(attribute)).toBe(original.getAttribute(attribute));
      expect(img.getAttribute('loading')).toBe('lazy');
    }
  });

  it('cada foto lleva al portfolio y hay un botón para ver todo', () => {
    for (const img of photos) expect(img.closest('a')?.getAttribute('href')).toBe('portfolio.html');
    expect(section.querySelector('a.btn[href="portfolio.html"]')).not.toBeNull();
    expect(section.getAttribute('aria-labelledby')).toBe('trabajos-titulo');
    expect(section.querySelector('h2#trabajos-titulo')).not.toBeNull();
  });

  it('carga js/trabajos.js, que renueva la muestra en cada visita', () => {
    expect(document.querySelector('script[type="module"]').getAttribute('src')).toMatch(/^js\/trabajos\.js\?v=[0-9a-f]{8}$/);
  });

  it('respeta las reglas de copy del sitio', () => {
    expect(findPromiseWords(visibleText(html))).toEqual([]);
    expect(findExternalImages(html)).toEqual([]);
  });
});
