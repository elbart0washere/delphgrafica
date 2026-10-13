import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { PAGES } from '../../scripts/stamp.mjs';

// Una comilla sin escapar dentro de un alt o aria-label corta el atributo: el texto queda truncado y lo que sigue
// se vuelve atributos basura (`hola!`, `llegué."`). Google Imágenes y los lectores de pantalla ven el texto cortado.
const VALID_NAME = /^(?:[a-z][a-z0-9-]*|[a-z]+:[a-z-]+|viewBox|preserveAspectRatio)$/; // SVG conserva mayúsculas

describe.each(PAGES)('atributos HTML de %s', (page) => {
  const document = new JSDOM(readFileSync(new URL(`../../${page}`, import.meta.url), 'utf8')).window.document;

  it('ningún elemento tiene atributos con nombres rotos por comillas sueltas', () => {
    const broken = [];
    for (const element of document.body.querySelectorAll('*')) {
      for (const { name } of element.attributes) {
        if (!VALID_NAME.test(name)) broken.push(`<${element.localName}> ${name}`);
        else if (element.localName === 'img' && !['src', 'alt', 'width', 'height', 'loading', 'fetchpriority', 'decoding', 'class', 'srcset', 'sizes'].includes(name)) {
          broken.push(`<img> ${name}`);
        }
      }
    }
    expect(broken).toEqual([]);
  });

  it('todos los textos alternativos son frases completas (no terminan en un espacio)', () => {
    for (const img of document.querySelectorAll('img[alt]')) expect(img.alt, img.getAttribute('src')).toBe(img.alt.trim());
    for (const el of document.querySelectorAll('[aria-label]')) expect(el.getAttribute('aria-label')).toBe(el.getAttribute('aria-label').trim());
  });
});
