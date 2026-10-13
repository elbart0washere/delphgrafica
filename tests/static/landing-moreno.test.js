import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { INDEXED_PAGES, PAGES } from '../../scripts/stamp.mjs';
import { document as home, textOf, waText } from '../helpers/page.js';
import { findAccentMisuse, findExternalImages, findNonVoseo, findPromiseWords, visibleText } from '../helpers/guards.js';

const root = new URL('../../', import.meta.url);
const PAGE = 'grafica-en-moreno.html';
const ORIGIN = 'https://delphgrafica.com.ar';
const exists = existsSync(new URL(PAGE, root));
const html = exists ? readFileSync(new URL(PAGE, root), 'utf8') : '<html><body></body></html>';
const document = new JSDOM(html).window.document;
const portfolio = new JSDOM(readFileSync(new URL('portfolio.html', root), 'utf8')).window.document;
const meta = (name) => document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ?? '';

// Esta landing existe para quien busca "gráfica en Moreno". Tiene que ser una página con contenido propio:
// si repitiera el texto del inicio, Google la trataría como duplicada y no rankearía ninguna de las dos.
describe('landing "Gráfica en Moreno"', () => {
  it('existe, se indexa y se sella como las demás páginas', () => {
    expect(exists).toBe(true);
    expect(INDEXED_PAGES).toContain(PAGE);
    expect(PAGES).toContain(PAGE);
  });

  it('el título y la descripción dicen qué y dónde, y no repiten los del inicio', () => {
    expect(document.title).toMatch(/Moreno/);
    expect(document.title.length).toBeLessThanOrEqual(60);
    expect(document.title).not.toBe(home.title);
    expect(meta('description')).toMatch(/Paso del Rey/);
    expect(meta('description')).toMatch(/Moreno/);
    expect(meta('description')).not.toBe(home.querySelector('meta[name="description"]').getAttribute('content'));
  });

  it('tiene un solo h1 con la búsqueda que atiende', () => {
    const h1 = document.querySelectorAll('h1');
    expect(h1).toHaveLength(1);
    expect(textOf(h1[0])).toBe('Gráfica en Moreno');
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

  it('tiene salidas de conversión: WhatsApp, portfolio e inicio', () => {
    expect(document.querySelector('main a[href^="https://wa.me/5491172394787"]')).not.toBeNull();
    expect(document.querySelector('main a[href="portfolio.html"]')).not.toBeNull();
    expect(document.querySelector('a[href="index.html"]')).not.toBeNull();
  });

  it('declara una página web con migas de pan Inicio > Gráfica en Moreno', () => {
    const data = [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent));
    expect(data.find((d) => d['@type'] === 'WebPage').url).toBe(`${ORIGIN}/${PAGE}`);
    const crumbs = data.find((d) => d['@type'] === 'BreadcrumbList').itemListElement;
    expect(crumbs.map((c) => [c.position, c.name, c.item])).toEqual([
      [1, 'Inicio', `${ORIGIN}/`],
      [2, 'Gráfica en Moreno', `${ORIGIN}/${PAGE}`],
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

// Una landing que nadie enlaza no la descubre ni un visitante ni Google (el sitemap solo ayuda).
describe('enlaces hacia la landing', () => {
  it.each([['inicio', home], ['portfolio', portfolio]])('el pie de %s enlaza a "Gráfica en Moreno"', (_, doc) => {
    const link = doc.querySelector(`#pie a[href="${PAGE}"]`);
    expect(link, 'falta el enlace').not.toBeNull();
    expect(textOf(link)).toBe('Gráfica en Moreno');
  });
});
