import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const { document } = new JSDOM(html).window;

describe('<head> del documento (regla 25)', () => {
  it('declara idioma español de Argentina', () => {
    expect(document.documentElement.getAttribute('lang')).toBe('es-AR');
  });

  it('tiene el título de la spec', () => {
    expect(document.title).toBe('Gráfica Delph — Sitio en construcción');
  });

  it('tiene meta descripción en español', () => {
    const description = document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '';
    expect(description.length).toBeGreaterThan(40);
  });

  it('tiene etiquetas Open Graph de texto', () => {
    for (const property of ['og:title', 'og:description', 'og:type', 'og:url', 'og:locale', 'og:image']) {
      expect(document.querySelector(`meta[property="${property}"]`), property).not.toBeNull();
    }
    expect(document.querySelector('meta[property="og:locale"]').getAttribute('content')).toBe('es_AR');
  });

  it('enlaza favicon, CSS compilado, y precarga la fuente', () => {
    expect(document.querySelector('link[rel="icon"]')).not.toBeNull();
    expect(document.querySelector('link[rel="stylesheet"][href="assets/styles.css"]')).not.toBeNull();
    expect(document.querySelector('link[rel="preload"][as="font"][type="font/woff2"]')).not.toBeNull();
  });

  it('carga el JS como módulo', () => {
    expect(document.querySelector('script[type="module"][src="js/main.js"]')).not.toBeNull();
  });

  it('oculta lo que requiere JavaScript cuando no hay JavaScript (regla 26)', () => {
    const noscriptStyle = document.head.querySelector('noscript')?.textContent ?? '';
    expect(noscriptStyle).toMatch(/\.js-only\s*\{\s*display:\s*none/);
  });
});
