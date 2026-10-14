import { describe, it, expect } from 'vitest';
import { pickPhotos, renderGallery, syncGallery, keepOrPick, START, END } from '../../scripts/sync-gallery.mjs';

const li = (name, alt = `Foto ${name}`) =>
  `<li><button type="button" class="shot" aria-label="Ampliar foto: ${alt}"><img src="assets/portfolio/${name}.jpg?v=abcd1234" alt="${alt}" width="1400" height="1400" loading="lazy"></button></li>`;
const video = '<li><button type="button" class="shot" aria-label="Ampliar video: x"><video src="assets/portfolio-videos/v.mp4?v=1" poster="assets/portfolio-videos/v.jpg?v=1"></video></button></li>';
const portfolio = `<ul class="gallery">${'abcdefgh'.split('').map((n) => li(n)).join('')}${video}</ul>`;

describe('pickPhotos', () => {
  it('toma solo fotos (no videos), sin repetir, con su src, alt y medidas', () => {
    const photos = pickPhotos(portfolio, 6, () => 0.3);
    expect(photos).toHaveLength(6);
    expect(new Set(photos.map((p) => p.src)).size).toBe(6);
    for (const p of photos) {
      expect(p.src).toMatch(/^assets\/portfolio\/[a-h]\.jpg\?v=abcd1234$/);
      expect(p.alt).toMatch(/^Foto [a-h]$/);
      expect([p.width, p.height]).toEqual(['1400', '1400']);
    }
  });

  it('si el portfolio tiene menos fotos que las pedidas, devuelve todas', () => {
    expect(pickPhotos(`<ul class="gallery">${li('a')}${li('b')}</ul>`, 6)).toHaveLength(2);
  });

  it('la muestra cambia según el azar que se le pase', () => {
    const at = (r) => pickPhotos(portfolio, 3, () => r).map((p) => p.src);
    expect(at(0)).not.toEqual(at(0.99));
  });
});

describe('renderGallery', () => {
  it('cada foto enlaza al portfolio, lleva su descripción y carga diferida', () => {
    const html = renderGallery([{ src: 'assets/portfolio/a.jpg?v=1', alt: 'Una "lona" & más', width: '10', height: '20' }]);
    expect(html).toContain('data-trabajos');
    expect(html).toContain('href="portfolio.html"');
    expect(html).toContain('alt="Una &quot;lona&quot; &amp; más"');
    expect(html).toContain('loading="lazy"');
    expect(html).not.toContain('<button');
  });
});

describe('syncGallery', () => {
  const page = `<p>antes</p>\n  ${START}\n  <ul class="gallery" data-trabajos>viejo</ul>\n  ${END}\n<p>después</p>`;
  const photos = [{ src: 'assets/portfolio/a.jpg?v=1', alt: 'x', width: '1', height: '1' }];

  it('reemplaza solo lo que hay entre las marcas', () => {
    const out = syncGallery(page, photos);
    expect(out).toContain('<p>antes</p>');
    expect(out).toContain('<p>después</p>');
    expect(out).not.toContain('viejo');
    expect(out).toContain('assets/portfolio/a.jpg?v=1');
  });

  it('es idempotente: volver a sincronizar con las mismas fotos no cambia nada', () => {
    const once = syncGallery(page, photos);
    expect(syncGallery(once, photos)).toBe(once);
  });

  it('falla fuerte si la página no tiene las marcas, en vez de no hacer nada', () => {
    expect(() => syncGallery('<p>sin marcas</p>', photos)).toThrow(/marcas/);
  });
});

describe('keepOrPick', () => {
  const six = 'abcdef'.split('');
  const landing = (names) => `${START}\n${renderGallery(pickPhotos(`<ul class="gallery">${names.map((n) => li(n)).join('')}</ul>`, 6, () => 0.5))}\n${END}`;

  it('conserva la muestra actual si sigue siendo válida (así el build no cambia las fotos cada vez)', () => {
    const current = pickPhotos(portfolio, 6, () => 0.9);
    const html = syncGallery(landing(six), current);
    expect(keepOrPick(html, portfolio, () => 0).map((p) => p.src)).toEqual(current.map((p) => p.src));
  });

  it('sortea de nuevo si alguna foto ya no está en el portfolio', () => {
    const html = landing(['x', 'y', 'z', 'w', 'v', 'u']);
    const picked = keepOrPick(html, portfolio, () => 0.1);
    expect(picked).toHaveLength(6);
    expect(picked.every((p) => /\/[a-h]\.jpg/.test(p.src))).toBe(true);
  });

  it('sortea de nuevo si la muestra no tiene 6 fotos (por ejemplo, la landing todavía está vacía)', () => {
    expect(keepOrPick(`${START}\n<ul class="gallery" data-trabajos></ul>\n${END}`, portfolio, () => 0.2)).toHaveLength(6);
  });
});
