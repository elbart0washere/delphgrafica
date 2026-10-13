import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { INDEXED_PAGES as PAGES } from '../../scripts/stamp.mjs';

const root = new URL('../../', import.meta.url);
const ORIGIN = 'https://delphgrafica.com.ar';
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const doc = (page) => new JSDOM(read(page)).window.document;
const urlOf = (page) => (page === 'index.html' ? `${ORIGIN}/` : `${ORIGIN}/${page}`);
const meta = (document, selector) => document.querySelector(selector)?.getAttribute('content') ?? '';

describe.each(PAGES)('SEO de %s', (page) => {
  const document = doc(page);

  // Sin canonical, Google puede tratar www, http, /index.html o una URL con ?v= como páginas distintas
  // y repartir entre ellas lo que vale una sola.
  it('declara su URL canónica absoluta', () => {
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(urlOf(page));
  });

  it('tiene título y meta descripción propios', () => {
    expect(document.title.length).toBeGreaterThan(10);
    expect(meta(document, 'meta[name="description"]').length).toBeGreaterThan(40);
  });

  // WhatsApp, Instagram y Facebook leen Open Graph para armar la vista previa al compartir el enlace.
  it('tiene vista previa al compartir (Open Graph + Twitter Card) apuntando a su propia URL', () => {
    for (const property of ['og:title', 'og:description', 'og:type', 'og:url', 'og:locale', 'og:image']) {
      expect(meta(document, `meta[property="${property}"]`), property).not.toBe('');
    }
    expect(meta(document, 'meta[property="og:url"]')).toBe(urlOf(page));
    expect(meta(document, 'meta[property="og:locale"]')).toBe('es_AR');
    expect(meta(document, 'meta[property="og:image"]')).toMatch(/^https:\/\/delphgrafica\.com\.ar\/assets\/.+\.jpg$/);
    expect(meta(document, 'meta[name="twitter:card"]')).toBe('summary_large_image');
  });

  it('la imagen de la vista previa existe en el repo', () => {
    const image = new URL(meta(document, 'meta[property="og:image"]')).pathname.slice(1);
    expect(existsSync(new URL(image, root)), image).toBe(true);
  });
});

describe('robots.txt', () => {
  it('permite rastrear todo y apunta al sitemap', () => {
    const robots = read('robots.txt');
    expect(robots).toMatch(/^User-agent:\s*\*$/m);
    expect(robots).not.toMatch(/^Disallow:\s*\/\s*$/m);
    expect(robots).toMatch(new RegExp(`^Sitemap:\\s*${ORIGIN}/sitemap\\.xml$`, 'm'));
  });
});

describe('sitemap.xml', () => {
  const sitemap = existsSync(new URL('sitemap.xml', root)) ? read('sitemap.xml') : '';
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);

  it('es XML de sitemap válido', () => {
    expect(sitemap).toMatch(/<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  });

  it('lista exactamente las páginas del sitio con su URL canónica', () => {
    expect([...locs].sort()).toEqual(PAGES.map(urlOf).sort());
  });
});
