import { describe, it, expect } from 'vitest';
import { document, textOf } from '../helpers/page.js';

const map = document.querySelector('#cotizar .map');
const frame = map?.querySelector('iframe');

describe('mapa de Google en la sección Contacto', () => {
  it('es el mapa oficial de Google de la ficha "Delph Grafica" (código de Compartir → Insertar un mapa)', () => {
    expect(frame, 'falta el iframe en #cotizar .map').not.toBeNull();
    const src = frame.getAttribute('src');
    expect(src.startsWith('https://www.google.com/maps/embed?pb=')).toBe(true);
    // Identificador de la ficha (0x…:0x496729335aef544c) y su nombre: son los que la muestran con su pin.
    expect(src).toContain('0x496729335aef544c');
    expect(src).toContain('Delph%20Grafica');
  });

  it('carga diferida: el navegador decide cuándo pedirlo (loading="lazy")', () => {
    expect(frame.getAttribute('loading')).toBe('lazy');
  });

  it('viene después del formulario en el HTML (orden de lectura y de tabulación en pantallas angostas)', () => {
    const form = document.querySelector('#form-cotizar');
    const FOLLOWING = 4; // Node.DOCUMENT_POSITION_FOLLOWING
    expect(form.compareDocumentPosition(map) & FOLLOWING).toBeTruthy();
    expect(map.closest('.contact-grid')).not.toBeNull();
  });

  it('queda fuera del orden de tabulación: el teclado no queda atrapado ni pierde el indicador de foco', () => {
    // El foco entra "adentro" del mapa de Google y el iframe no muestra contorno. Lo que hace el mapa (llegar) lo cubre
    // el botón "Cómo llegar", que sí es enfocable, y la dirección está escrita en el texto.
    expect(frame.getAttribute('tabindex')).toBe('-1');
  });

  it('tiene título accesible y no manda el referrer completo', () => {
    expect(frame.getAttribute('title')).toMatch(/mapa/i);
    expect(frame.getAttribute('title')).toContain('Delph');
    expect(frame.getAttribute('referrerpolicy')).toBe('strict-origin-when-cross-origin');
  });

  it('tiene un botón "Cómo llegar" que abre las indicaciones de Google Maps en una pestaña nueva', () => {
    const link = [...map.querySelectorAll('a')].find((a) => textOf(a) === 'Cómo llegar');
    expect(link, 'falta "Cómo llegar"').toBeTruthy();
    const url = new URL(link.getAttribute('href'));
    expect(url.origin + url.pathname).toBe('https://www.google.com/maps/dir/');
    expect(url.searchParams.get('api')).toBe('1');
    // El destino es el mismo punto que muestra el mapa incrustado (el centro del pb: 2d = longitud, 3d = latitud).
    const [lat, lng] = url.searchParams.get('destination').split(',').map(Number);
    const pb = frame.getAttribute('src');
    expect(lng).toBeCloseTo(Number(/!2d(-?[\d.]+)/.exec(pb)[1]), 3);
    expect(lat).toBeCloseTo(Number(/!3d(-?[\d.]+)/.exec(pb)[1]), 3);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });
});
