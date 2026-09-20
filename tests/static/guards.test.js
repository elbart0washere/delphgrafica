import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import {
  findAccentMisuse,
  findExternalImages,
  findForbiddenApis,
  findNonVoseo,
  findPromiseWords,
  visibleText,
} from '../helpers/guards.js';

const root = new URL('../../', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');
const jsDir = new URL('js/', root);
const jsSources = existsSync(jsDir)
  ? readdirSync(jsDir).filter((f) => f.endsWith('.js')).map((f) => readFileSync(new URL(f, jsDir), 'utf8'))
  : [];

describe('los detectores detectan (fixtures que violan la regla)', () => {
  it('imágenes externas', () => {
    expect(findExternalImages('<img src="https://images.unsplash.com/x.jpg"><img src="assets/a.jpg">')).toEqual([
      'https://images.unsplash.com/x.jpg',
    ]);
  });

  it('APIs que sacarían datos del navegador (regla 10)', () => {
    expect(findForbiddenApis('fetch("/x"); localStorage.setItem("a","b")')).toHaveLength(2);
    expect(findForbiddenApis('const url = buildUrl(data); window.open(url)')).toEqual([]);
  });

  it('palabras de promesa (regla 13)', () => {
    expect(findPromiseWords('Entrega en 24 hs, gratis')).not.toEqual([]);
    expect(findPromiseWords('Impresión digital y offset')).toEqual([]);
  });

  it('formas no rioplatenses (regla 12)', () => {
    expect(findNonVoseo('Si quieres cotizar, contáctanos')).not.toEqual([]);
    expect(findNonVoseo('Si querés cotizar, escribinos. Cotizá tu proyecto')).toEqual([]);
  });

  it('acento fuera de los ids permitidos (regla 16)', () => {
    const violating = '<div id="decoracion" class="bg-accent"></div><a id="cta-hero" class="bg-accent"></a>';
    expect(findAccentMisuse(violating)).toEqual(['decoracion']);
    expect(findAccentMisuse('<a class="hover:bg-accent focus-visible:ring-accent"></a>')).toEqual([]);
    expect(findAccentMisuse('<a id="otro" class="btn btn-cta"></a>')).toEqual(['otro']);
    expect(findAccentMisuse('<a id="btn-ig-banner" class="btn btn-cta"></a>')).toEqual([]);
  });
});

describe('guardas sobre el sitio', () => {
  it('sin imágenes externas ni de stock', () => {
    expect(findExternalImages(html)).toEqual([]);
  });

  it('el JS no guarda ni envía datos (regla 10)', () => {
    for (const source of jsSources) expect(findForbiddenApis(source)).toEqual([]);
  });

  it('el copy no promete plazos, precios ni garantías (regla 13)', () => {
    expect(findPromiseWords(visibleText(html))).toEqual([]);
  });

  it('el copy está en voseo rioplatense (regla 12)', () => {
    expect(findNonVoseo(visibleText(html))).toEqual([]);
  });

  it('el acento solo aparece en los botones permitidos (regla 16)', () => {
    expect(findAccentMisuse(html)).toEqual([]);
  });
});
