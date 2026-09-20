import { describe, it, expect } from 'vitest';
import { IG, document, textOf } from '../helpers/page.js';

const TITLES = ['Cartelería', 'Lonas', 'Impresión digital', 'Laminados', 'Merchandising', 'Calcos', 'Estructuras'];

describe('portfolio', () => {
  const tiles = [...document.querySelectorAll('#trabajos .mosaic .tile')];

  it('US4-S1: hay 7 bloques con los títulos, sin imágenes ni bordes ni sombras (reglas 16 a 18)', () => {
    expect(tiles.map((tile) => textOf(tile.querySelector('.tile-label')))).toEqual(TITLES);
    expect(document.querySelectorAll('#trabajos .mosaic img')).toHaveLength(0);
    for (const tile of tiles) {
      expect(tile.className).not.toMatch(/border|shadow|btn-cta|accent/);
    }
  });

  it('US4-S4: el banner de Instagram abre el perfil en una pestaña nueva', () => {
    const banner = document.querySelector('#btn-ig-banner');
    expect(banner.getAttribute('href')).toBe(IG);
    expect(banner.getAttribute('target')).toBe('_blank');
    expect(banner.getAttribute('rel')).toContain('noopener');
    expect(textOf(document.querySelector('.ig-banner'))).toContain('Mirá nuestros trabajos más recientes en Instagram');
  });

  it('el botón del banner invita a seguir en Instagram por las promos mensuales', () => {
    expect(textOf(document.querySelector('#btn-ig-banner'))).toBe('Seguinos en Instagram para conocer todas las promos mensuales');
  });

  it('Packaging ya no es un bloque del portfolio', () => {
    expect(tiles.map((tile) => textOf(tile.querySelector('.tile-label')))).not.toContain('Packaging');
  });

  it('US4-S5: reemplazar el ícono de un bloque por una foto no cambia el bloque ni el grid', () => {
    for (const tile of tiles) {
      const visual = tile.querySelector('[data-block-visual]');
      expect(visual, textOf(tile)).not.toBeNull();
      const before = { parent: tile.parentElement.className, classes: tile.className };

      const photo = document.createElement('img');
      photo.setAttribute('loading', 'lazy');
      visual.replaceWith(photo);

      expect({ parent: tile.parentElement.className, classes: tile.className }).toEqual(before);
      expect(tile.querySelector('img').getAttribute('loading')).toBe('lazy');
    }
  });
});
