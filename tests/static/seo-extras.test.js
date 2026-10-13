import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { INDEXED_PAGES, PAGES } from '../../scripts/stamp.mjs';
import { WA, textOf } from '../helpers/page.js';
import { findNonVoseo, findPromiseWords, visibleText } from '../helpers/guards.js';

const root = new URL('../../', import.meta.url);
const ORIGIN = 'https://delphgrafica.com.ar';
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const doc = (page) => new JSDOM(read(page)).window.document;
const jsonLd = (document) => [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent));
const home = doc('index.html');
const portfolio = doc('portfolio.html');

describe.each(INDEXED_PAGES)('vista previa y ficha de %s', (page) => {
  const document = doc(page);
  const meta = (selector) => document.querySelector(selector)?.getAttribute('content') ?? '';

  // Con el tamaño declarado, WhatsApp y Facebook arman la tarjeta sin tener que descargar la imagen para medirla.
  it('declara tamaño, texto alternativo y nombre del sitio de la imagen social', () => {
    expect(meta('meta[property="og:image:width"]')).toBe('1200');
    expect(meta('meta[property="og:image:height"]')).toBe('630');
    expect(meta('meta[property="og:image:alt"]').length).toBeGreaterThan(10);
    expect(meta('meta[property="og:site_name"]')).toBe('Gráfica Delph');
  });

  it('pinta la barra del navegador del color de la marca y tiene ícono para la pantalla de inicio', () => {
    expect(meta('meta[name="theme-color"]')).toBe('#dc078b');
    expect(document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href')).toMatch(/^assets\/favicon\.png/);
  });
});

describe('datos estructurados del inicio', () => {
  const business = jsonLd(home).find((data) => data['@type'] === 'LocalBusiness');

  // El mapa del sitio y la ficha de Google tienen que ser el mismo lugar: el cid sale del identificador hexadecimal
  // que lleva el iframe del mapa embebido.
  it('hasMap apunta a la misma ficha de Google que el mapa embebido', () => {
    const iframe = home.querySelector('iframe.map-frame').getAttribute('src');
    const feature = /0x[0-9a-f]+%3A(0x[0-9a-f]+)/.exec(iframe)[1];
    expect(business.hasMap).toBe(`https://www.google.com/maps?cid=${BigInt(feature)}`);
  });

  // schema.org pide que lo marcado se vea en la página: los nombres salen de los <h3> del bloque de servicios.
  it('hasOfferCatalog lista exactamente los servicios visibles, sin precios', () => {
    const visible = [...home.querySelectorAll('.services .service h3')].map(textOf);
    const catalog = business.hasOfferCatalog;
    expect(catalog['@type']).toBe('OfferCatalog');
    expect(catalog.itemListElement.map((offer) => offer.itemOffered.name)).toEqual(visible);
    for (const offer of catalog.itemListElement) {
      expect(offer['@type']).toBe('Offer');
      expect(offer.itemOffered['@type']).toBe('Service');
      expect(offer).not.toHaveProperty('price');
    }
  });

  it('no inventa reseñas ni calificaciones', () => {
    expect(JSON.stringify(business)).not.toMatch(/aggregateRating|reviewRating/);
  });
});

describe('datos estructurados del portfolio', () => {
  const data = jsonLd(portfolio);
  const page = data.find((item) => item['@type'] === 'CollectionPage');
  const gallerySrcs = [...portfolio.querySelectorAll('.gallery img')].map((img) => img.getAttribute('src').split('?')[0]);
  const images = page?.mainEntity?.itemListElement ?? [];

  it('es una CollectionPage con su URL y migas de pan Inicio > Portfolio', () => {
    expect(page.url).toBe(`${ORIGIN}/portfolio.html`);
    const crumbs = data.find((item) => item['@type'] === 'BreadcrumbList').itemListElement;
    expect(crumbs.map((crumb) => [crumb.position, crumb.name, crumb.item])).toEqual([
      [1, 'Inicio', `${ORIGIN}/`],
      [2, 'Portfolio', `${ORIGIN}/portfolio.html`],
    ]);
  });

  // La galería es HTML estático: si se agrega una foto y no el JSON-LD, Google ve una lista distinta de la real.
  it('lista como ImageObject exactamente las fotos de la galería, con su texto alternativo', () => {
    expect(images.map((image) => image.contentUrl)).toEqual(gallerySrcs.map((src) => `${ORIGIN}/${src}`));
    const alts = [...portfolio.querySelectorAll('.gallery img')].map((img) => img.getAttribute('alt'));
    expect(images.map((image) => image.description)).toEqual(alts);
    for (const image of images) expect(image['@type']).toBe('ImageObject');
  });
});

describe('portfolio: salida a WhatsApp al terminar la galería', () => {
  it('tiene un botón de WhatsApp que cuenta de dónde viene el cliente', () => {
    const link = portfolio.querySelector('.gallery-cta a[href^="https://wa.me/5491172394787"]');
    expect(link, 'falta el botón de WhatsApp').not.toBeNull();
    expect(textOf(link)).toBe('Consultanos por WhatsApp');
    expect(decodeURIComponent(new URL(link.getAttribute('href')).searchParams.get('text'))).toBe('Hola! Vi el portfolio y quiero cotizar.');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });
});

describe('servicios: enlaces distinguibles para lectores de pantalla', () => {
  // Cuatro enlaces "Cotizar esto" iguales no dicen a qué servicio llevan. El nombre accesible conserva el texto
  // visible al principio (WCAG 2.5.3, "etiqueta en el nombre") y suma el servicio.
  it('cada "Cotizar esto" nombra su servicio', () => {
    for (const card of home.querySelectorAll('.services .service')) {
      const link = card.querySelector('a.link');
      expect(link.getAttribute('aria-label')).toBe(`Cotizar esto: ${textOf(card.querySelector('h3'))}`);
    }
  });
});

describe('404.html', () => {
  const exists = existsSync(new URL('404.html', root));
  const page = exists ? doc('404.html') : null;

  it('existe y se sella como las demás páginas', () => {
    expect(exists).toBe(true);
    expect(PAGES).toContain('404.html');
  });

  // Se sirve en cualquier URL inexistente (/a/b/c), así que sus rutas relativas tienen que resolverse desde la raíz.
  it('resuelve sus rutas desde la raíz y no se indexa', () => {
    expect(page.querySelector('base')?.getAttribute('href')).toBe('/');
    expect(page.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex');
    expect(page.querySelector('link[rel="canonical"]')).toBeNull();
    expect(read('sitemap.xml')).not.toContain('404');
  });

  it('explica el error en voseo y deja dos salidas: el inicio y WhatsApp', () => {
    expect(textOf(page.querySelector('h1'))).toBe('Esta página no existe');
    expect(page.querySelector('a[href="index.html"]')).not.toBeNull();
    expect(page.querySelector(`a[href^="${WA}"]`)).not.toBeNull();
    const text = visibleText(read('404.html'));
    expect(findNonVoseo(text)).toEqual([]);
    expect(findPromiseWords(text)).toEqual([]);
  });
});

describe('scripts/check-deploy.sh', () => {
  const script = read('scripts/check-deploy.sh');

  it('es shell válido', () => {
    expect(() => execFileSync('bash', ['-n', new URL('scripts/check-deploy.sh', root).pathname])).not.toThrow();
  });

  it('verifica lo publicado de SEO: robots, sitemap, canonical y la 404', () => {
    expect(script).toContain('robots.txt');
    expect(script).toContain('sitemap.xml');
    expect(script).toContain('rel="canonical"');
    expect(script).toMatch(/Esta página no existe/);
  });
});
