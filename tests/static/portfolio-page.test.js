import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { document as home, textOf } from '../helpers/page.js';
import { findAccentMisuse, findExternalImages, findNonVoseo, findPromiseWords, visibleText } from '../helpers/guards.js';

const root = new URL('../../', import.meta.url);
const html = readFileSync(new URL('portfolio.html', root), 'utf8');
const document = new JSDOM(html).window.document;

describe('página del portfolio', () => {
  const items = [...document.querySelectorAll('.gallery li')].filter((li) => li.querySelector('img'));

  it('el inicio tiene un botón que lleva al portfolio', () => {
    const link = home.querySelector('#btn-portfolio');
    expect(link.getAttribute('href')).toBe('portfolio.html');
    expect(textOf(link)).toBe('Ver el portfolio');
  });

  it('muestra las fotos seleccionadas, cada una con su texto alternativo y tamaño', () => {
    expect(items.length).toBeGreaterThanOrEqual(9);
    for (const item of items) {
      const img = item.querySelector('img');
      const src = img.getAttribute('src').split('?')[0];
      expect(existsSync(new URL(src, root)), src).toBe(true);
      expect(src).toMatch(/^assets\/portfolio\/[a-z0-9-]+\.jpg$/);
      expect(img.getAttribute('alt').length, src).toBeGreaterThan(10);
      expect(Number(img.getAttribute('width')), src).toBeGreaterThan(0);
      expect(Number(img.getAttribute('height')), src).toBeGreaterThan(0);
    }
  });

  it('no hay fotos repetidas y todas las del directorio están en la página', () => {
    const srcs = items.map((item) => item.querySelector('img').getAttribute('src').split('?')[0]);
    expect(new Set(srcs).size).toBe(srcs.length);
    const onDisk = readdirSync(new URL('assets/portfolio/', root)).map((file) => `assets/portfolio/${file}`);
    expect(srcs.sort()).toEqual(onDisk.sort());
  });

  it('las imágenes cargan diferidas (regla 29)', () => {
    for (const img of document.querySelectorAll('.gallery img')) expect(img.getAttribute('loading')).toBe('lazy');
  });

  it('sin JavaScript la galería se ve igual (el orden aleatorio y el visor son mejoras)', () => {
    for (const item of items) expect(item.querySelector('img'), 'la foto no depende del JS').not.toBeNull();
    expect(document.querySelector('dialog#visor')).not.toBeNull();
  });

  it('se puede volver al inicio y cotizar desde la página', () => {
    expect(document.querySelector('.top a.logo').getAttribute('href')).toBe('index.html');
    expect(document.querySelector('a[href="index.html#cotizar"]')).not.toBeNull();
  });

  it('carga el CSS compartido y su propio módulo', () => {
    expect(document.querySelector('link[rel="stylesheet"]').getAttribute('href')).toMatch(/^assets\/styles\.css\?v=/);
    expect(document.querySelector('script[type="module"]').getAttribute('src')).toMatch(/^js\/portfolio\.js\?v=/);
  });

  it('cumple las guardas del sitio: sin imágenes externas, voseo, sin promesas y acento solo donde corresponde', () => {
    expect(findExternalImages(html)).toEqual([]);
    expect(findNonVoseo(visibleText(html))).toEqual([]);
    expect(findPromiseWords(visibleText(html))).toEqual([]);
    expect(findAccentMisuse(html)).toEqual([]);
  });

  it('los videos van mudos, en bucle, sin descargarse hasta que se ven y con portada', () => {
    const videos = [...document.querySelectorAll('.gallery video')];
    expect(videos.length).toBeGreaterThanOrEqual(2);
    for (const video of videos) {
      const src = video.getAttribute('src').split('?')[0];
      const poster = video.getAttribute('poster').split('?')[0];
      expect(existsSync(new URL(src, root)), src).toBe(true);
      expect(existsSync(new URL(poster, root)), poster).toBe(true);
      expect(video.hasAttribute('muted'), src).toBe(true);
      expect(video.hasAttribute('loop'), src).toBe(true);
      expect(video.hasAttribute('playsinline'), src).toBe(true);
      expect(video.getAttribute('preload'), src).toBe('none');
      expect(video.closest('button').getAttribute('aria-label'), src).toMatch(/video/i);
    }
  });

  it('los videos publicados no tienen pista de audio', () => {
    for (const video of document.querySelectorAll('.gallery video')) {
      const file = new URL(video.getAttribute('src').split('?')[0], root);
      expect(readFileSync(file).includes('soun'), file.pathname).toBe(false);
    }
  });
});
