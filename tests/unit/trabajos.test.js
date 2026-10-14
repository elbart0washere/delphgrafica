import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { pickPhotos, initTrabajos } from '../../js/trabajos.js';

const photo = (name, alt = `Foto ${name}`) =>
  `<li><button type="button" class="shot"><img src="assets/portfolio/${name}.jpg?v=abcd1234" alt="${alt}" width="1400" height="900" loading="lazy"></button></li>`;
const video = '<li><button type="button" class="shot"><video src="v.mp4" poster="v.jpg"></video></button></li>';
const portfolio = `<ul class="gallery">${'abcdefgh'.split('').map((n) => photo(n)).join('')}${video}</ul>`;
const doc = (html) => new JSDOM(html).window.document;

describe('pickPhotos', () => {
  it('toma solo fotos (no videos), sin repetir, con src, alt y medidas', () => {
    const photos = pickPhotos(doc(portfolio), 6, () => 0.3);
    expect(photos).toHaveLength(6);
    expect(new Set(photos.map((p) => p.src)).size).toBe(6);
    for (const p of photos) {
      expect(p.src).toMatch(/^assets\/portfolio\/[a-h]\.jpg\?v=abcd1234$/);
      expect(p.alt).toMatch(/^Foto [a-h]$/);
      expect([p.width, p.height]).toEqual(['1400', '900']);
    }
  });

  it('si hay menos fotos que las pedidas, devuelve todas', () => {
    expect(pickPhotos(doc(`<ul class="gallery">${photo('a')}${photo('b')}</ul>`), 6)).toHaveLength(2);
  });

  it('la muestra depende del azar', () => {
    const at = (r) => pickPhotos(doc(portfolio), 3, () => r).map((p) => p.src);
    expect(at(0)).not.toEqual(at(0.99));
  });
});

describe('initTrabajos', () => {
  const stale = '<li><a class="shot" href="portfolio.html"><img src="assets/portfolio/vieja.jpg" alt="vieja" width="1" height="1"></a></li>';
  const page = () => doc(`<section id="trabajos"><ul data-trabajos>${stale}</ul></section>`);

  it('reemplaza la muestra del HTML por 6 fotos con enlace al portfolio', async () => {
    const d = page();
    await initTrabajos(d, async () => doc(portfolio));
    const imgs = [...d.querySelectorAll('[data-trabajos] li a[href="portfolio.html"] img')];
    expect(imgs).toHaveLength(6);
    expect(imgs.some((img) => img.getAttribute('alt') === 'vieja')).toBe(false);
    expect(imgs.every((img) => img.getAttribute('loading') === 'lazy' && img.getAttribute('alt'))).toBe(true);
  });

  it('si no se puede leer el portfolio, deja la muestra del HTML tal cual', async () => {
    const d = page();
    await initTrabajos(d, async () => { throw new Error('sin red'); });
    expect(d.querySelector('[data-trabajos]').innerHTML).toBe(stale);
  });

  it('si el portfolio no tiene fotos, deja la muestra del HTML tal cual', async () => {
    const d = page();
    await initTrabajos(d, async () => doc('<ul class="gallery"></ul>'));
    expect(d.querySelector('[data-trabajos]').innerHTML).toBe(stale);
  });

  it('en una página sin la sección no hace nada ni pide el portfolio', async () => {
    let asked = false;
    await initTrabajos(doc('<p>hola</p>'), async () => { asked = true; return doc(portfolio); });
    expect(asked).toBe(false);
  });
});
