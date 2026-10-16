import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { INDEXED_PAGES, PAGES } from '../../scripts/stamp.mjs';
import { document as home, textOf, waText } from '../helpers/page.js';
import { findAccentMisuse, findExternalImages, findNonVoseo, findPromiseWords, visibleText } from '../helpers/guards.js';

const root = new URL('../../', import.meta.url);
const PAGE = 'grafica-en-paso-del-rey.html';
const MORENO = 'grafica-en-moreno.html';
const ORIGIN = 'https://delphgrafica.com.ar';
const exists = existsSync(new URL(PAGE, root));
const html = exists ? readFileSync(new URL(PAGE, root), 'utf8') : '<html><body></body></html>';
const document = new JSDOM(html).window.document;
const moreno = new JSDOM(readFileSync(new URL(MORENO, root), 'utf8')).window.document;
const portfolio = new JSDOM(readFileSync(new URL('portfolio.html', root), 'utf8')).window.document;
const meta = (doc, name) => doc.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ?? '';

// Esta landing existe para quien busca "gráfica Paso del Rey". Tiene que decir cosas propias:
// si copiara la de Moreno, Google las vería como duplicadas y no rankearía ninguna.
describe('landing "Gráfica en Paso del Rey"', () => {
  it('existe, se indexa y se sella como las demás páginas', () => {
    expect(exists).toBe(true);
    expect(INDEXED_PAGES).toContain(PAGE);
    expect(PAGES).toContain(PAGE);
  });

  it('el título y la descripción dicen qué y dónde, y no repiten los de otras páginas', () => {
    expect(document.title).toMatch(/Paso del Rey/);
    expect(document.title.length).toBeLessThanOrEqual(60);
    for (const other of [home, moreno]) {
      expect(document.title).not.toBe(other.title);
      expect(meta(document, 'description')).not.toBe(meta(other, 'description'));
    }
    expect(meta(document, 'description')).toMatch(/Paso del Rey/);
  });

  it('tiene un solo h1 con la búsqueda que atiende', () => {
    const h1 = document.querySelectorAll('h1');
    expect(h1).toHaveLength(1);
    expect(textOf(h1[0])).toBe('Gráfica en Paso del Rey');
  });

  it('el texto principal es propio: no repite el de la página de Moreno', () => {
    const lead = (doc) => textOf(doc.querySelector('main .lead'));
    expect(lead(document)).toMatch(/Paso del Rey/);
    expect(lead(document)).not.toBe(lead(moreno));
  });

  it('describe los mismos 4 servicios que el inicio, cada uno con su enlace a WhatsApp', () => {
    const names = [...document.querySelectorAll('.services .service h3')].map(textOf);
    expect(names).toEqual([...home.querySelectorAll('.services .service h3')].map(textOf));
    for (const card of document.querySelectorAll('.services .service')) {
      const name = textOf(card.querySelector('h3'));
      const link = card.querySelector('a.link');
      expect(waText(link.getAttribute('href'))).toBe(`Hola! Quiero cotizar: ${name}`);
      expect(link.getAttribute('aria-label')).toBe(`Cotizar esto: ${name}`);
    }
  });

  it('dice dónde está, cuándo atiende y que envía al resto del país (igual que el inicio)', () => {
    const text = textOf(document.querySelector('main'));
    expect(text).toContain('Paso del Rey, Moreno');
    expect(text).toContain('Lunes a viernes de 9 a 18 h');
    expect(text).toContain('Envíos a todo el país');
  });

  it('muestra el mismo mapa que el inicio y el botón para llegar', () => {
    const src = (doc) => doc.querySelector('iframe.map-frame')?.getAttribute('src');
    expect(src(document)).toBe(src(home));
    expect(document.querySelector('a[href^="https://www.google.com/maps/dir/"]')).not.toBeNull();
  });

  it('tiene salidas de conversión: WhatsApp, portfolio, inicio y la página hermana de Moreno', () => {
    expect(document.querySelector('main a[href^="https://wa.me/5491172394787"]')).not.toBeNull();
    expect(document.querySelector('main a[href="portfolio.html"]')).not.toBeNull();
    expect(document.querySelector('a[href="index.html"]')).not.toBeNull();
    expect(document.querySelector(`main a[href="${MORENO}"]`)).not.toBeNull();
  });

  it('declara una página web con migas de pan Inicio > Gráfica en Paso del Rey', () => {
    const data = [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent));
    expect(data.find((d) => d['@type'] === 'WebPage').url).toBe(`${ORIGIN}/${PAGE}`);
    const crumbs = data.find((d) => d['@type'] === 'BreadcrumbList').itemListElement;
    expect(crumbs.map((c) => [c.position, c.name, c.item])).toEqual([
      [1, 'Inicio', `${ORIGIN}/`],
      [2, 'Gráfica en Paso del Rey', `${ORIGIN}/${PAGE}`],
    ]);
  });

  it('el pie invita a dejar una reseña, igual que el inicio', () => {
    expect(document.querySelector('#pie a[href="https://g.page/r/CUxU71ozKWdJEAE/review"]')).not.toBeNull();
  });

  it('cumple las reglas de copy del sitio: voseo, sin promesas, sin imágenes externas, acento solo donde corresponde', () => {
    const text = visibleText(html);
    expect(findNonVoseo(text)).toEqual([]);
    expect(findPromiseWords(text)).toEqual([]);
    expect(findExternalImages(html)).toEqual([]);
    expect(findAccentMisuse(html)).toEqual([]);
  });
});

describe('enlaces hacia la landing', () => {
  it.each([['inicio', home], ['portfolio', portfolio], ['Moreno', moreno]])('el pie de %s enlaza a "Gráfica en Paso del Rey"', (_, doc) => {
    const link = doc.querySelector(`#pie a[href="${PAGE}"]`);
    expect(link, 'falta el enlace').not.toBeNull();
    expect(textOf(link)).toBe('Gráfica en Paso del Rey');
  });
});
