import { describe, it, expect } from 'vitest';
import { EMAIL, IG, WA, document, textOf, waText } from '../helpers/page.js';

describe('encabezado', () => {
  it('tiene el logo, la navegación por secciones, Instagram y WhatsApp', () => {
    const header = document.querySelector('header');
    expect(header.querySelector('img[alt="Gráfica Delph"]')).not.toBeNull();
    const anchors = [...header.querySelectorAll('nav a')].map((a) => a.getAttribute('href'));
    expect(anchors).toEqual(['#servicios', '#trabajos', '#cotizar']);

    const instagram = header.querySelector('a[aria-label="Instagram"]');
    expect(instagram.getAttribute('href')).toBe(IG);
    expect(instagram.getAttribute('target')).toBe('_blank');
    expect(instagram.getAttribute('rel')).toContain('noopener');

    const whatsapp = header.querySelector('a[href^="' + WA + '"]');
    expect(textOf(whatsapp)).toContain('WhatsApp');
    expect(whatsapp.getAttribute('target')).toBe('_blank');
  });
});

describe('hero', () => {
  it('US2-regla14: la etiqueta "Sitio en construcción" no es un enlace ni un botón', () => {
    const badge = document.querySelector('#badge-construccion');
    expect(textOf(badge)).toBe('Sitio en construcción');
    expect(badge.closest('a, button')).toBeNull();
    expect(['A', 'BUTTON']).not.toContain(badge.tagName);
  });

  it('el CTA principal dice "Cotizá tu proyecto" y lleva al formulario', () => {
    const cta = document.querySelector('#cta-hero');
    expect(textOf(cta)).toBe('Cotizá tu proyecto');
    expect(cta.getAttribute('href')).toBe('#cotizar');
  });

  it('hay un título principal y el logo con texto alternativo', () => {
    expect(document.querySelectorAll('h1')).toHaveLength(1);
    expect(textOf(document.querySelector('h1'))).toMatch(/rápida y precisa/i);
  });

  it('tiene WhatsApp directo e Instagram', () => {
    const whatsapp = document.querySelector('#wa-hero');
    expect(whatsapp.getAttribute('href').startsWith(WA)).toBe(true);
    expect(textOf(whatsapp)).toContain('WhatsApp');
    expect(document.querySelector('.hero a[href="' + IG + '"]')).not.toBeNull();
  });
});

describe('botón flotante de WhatsApp', () => {
  it('existe, con nombre accesible y enlace al WhatsApp del taller', () => {
    const fab = document.querySelector('#fab-whatsapp');
    expect(fab.getAttribute('aria-label')).toBe('Escribinos por WhatsApp');
    expect(fab.getAttribute('href').startsWith(WA)).toBe(true);
    expect(waText(fab.getAttribute('href'))).toBe('Hola! Quiero hacer una consulta.');
  });
});

describe('datos de contacto (reglas 15 y 10)', () => {
  it('el correo del taller es el de la spec', () => {
    expect(document.querySelector('a[href="mailto:' + EMAIL + '"]')).not.toBeNull();
  });
});
