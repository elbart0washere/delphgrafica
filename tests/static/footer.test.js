import { describe, it, expect } from 'vitest';
import { EMAIL, IG, WA, document, textOf } from '../helpers/page.js';

describe('footer', () => {
  const footer = document.querySelector('#pie');
  const text = textOf(footer);

  it('US5-S1: muestra el copyright, el horario, la ubicación y el correo', () => {
    expect(text).toContain('© 2026 Gráfica Delph');
    expect(text).toContain('Lunes a viernes de 9 a 18 h');
    expect(text).toContain('Paso del Rey, Moreno');
    expect(text).toContain(EMAIL);
  });

  it('avisa que hay envíos a todo el país', () => {
    expect(text).toContain('Envíos a todo el país');
  });

  it('US5-S2: Instagram abre el perfil en una pestaña nueva', () => {
    const link = footer.querySelector('a[aria-label="Instagram"]');
    expect(link.getAttribute('href')).toBe(IG);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('US5-S3: WhatsApp abre el número del taller, sin mensaje prellenado', () => {
    expect(footer.querySelector('a[aria-label="WhatsApp"]').getAttribute('href')).toBe(WA);
  });

  it('US5-S4: el ícono de email abre el correo al taller', () => {
    expect(footer.querySelector('a[aria-label="Email"]').getAttribute('href')).toBe('mailto:' + EMAIL);
  });
});
