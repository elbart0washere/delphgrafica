import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { document, textOf } from '../helpers/page.js';

const root = new URL('../../', import.meta.url);
const section = document.querySelector('#trabajos');
const background = section?.querySelector('[data-clip]');
const video = background?.querySelector('video');

describe('video de calcos: fondo de la sección Trabajos', () => {
  it('es el fondo de Trabajos, decorativo (oculto para lectores de pantalla) y solo con JavaScript', () => {
    expect(background, 'falta [data-clip] en #trabajos').not.toBeNull();
    expect(background.getAttribute('aria-hidden')).toBe('true');
    expect(background.classList.contains('js-only')).toBe(true);
    expect(background.classList.contains('works-bg')).toBe(true);
  });

  it('la sección de video aparte ("En el taller") se eliminó', () => {
    expect(document.querySelector('.clip')).toBeNull();
    expect(document.querySelector('.clip-copy')).toBeNull();
    expect(textOf(document.body)).not.toContain('En el taller');
    expect(document.querySelectorAll('video')).toHaveLength(1);
  });

  it('es silencioso, en bucle y no se baja hasta que está por verse (no pesa en la primera carga)', () => {
    expect(video.hasAttribute('muted')).toBe(true);
    expect(video.hasAttribute('loop')).toBe(true);
    expect(video.hasAttribute('playsinline')).toBe(true);
    expect(video.getAttribute('preload')).toBe('none');
    expect(video.hasAttribute('autoplay')).toBe(false);
    expect(video.hasAttribute('controls')).toBe(false);
    expect(video.getAttribute('tabindex')).toBe('-1');
    // Sin src ni poster: se asignan desde data-* cuando el video se acerca a la pantalla.
    expect(video.hasAttribute('src')).toBe(false);
    expect(video.hasAttribute('poster')).toBe(false);
    expect(video.getAttribute('data-src')).toMatch(/^assets\/calcos-plotter\.mp4\?v=[0-9a-f]{8}$/);
    expect(video.getAttribute('data-poster')).toMatch(/^assets\/calcos-plotter\.jpg\?v=[0-9a-f]{8}$/);
  });

  it('aunque es de fondo, se puede pausar: hay un botón (WCAG 2.2.2, todo lo que se mueve más de 5 s)', () => {
    const toggle = section.querySelector('[data-clip-toggle]');
    expect(toggle.tagName).toBe('BUTTON');
    expect(toggle.getAttribute('type')).toBe('button');
    expect(toggle.closest('[aria-hidden="true"]')).toBeNull();
    expect(toggle.classList.contains('js-only')).toBe(true);
  });
});

describe('archivos del video', () => {
  const file = (path) => new URL(path, root);

  it('existen el video y la portada', () => {
    expect(existsSync(file('assets/calcos-plotter.mp4'))).toBe(true);
    expect(existsSync(file('assets/calcos-plotter.jpg'))).toBe(true);
  });

  it('el video no tiene pista de audio (viene de WhatsApp con audio)', () => {
    // Una pista de audio se declara con un manejador `soun` dentro del MP4.
    expect(readFileSync(file('assets/calcos-plotter.mp4')).includes('soun')).toBe(false);
  });

  it('pesa 5 MB o menos (no cuenta en la primera carga: se baja al acercarse) y la portada 100 KB o menos', () => {
    expect(statSync(file('assets/calcos-plotter.mp4')).size).toBeLessThanOrEqual(5 * 1024 * 1024);
    expect(statSync(file('assets/calcos-plotter.jpg')).size).toBeLessThanOrEqual(100 * 1024);
  });
});
