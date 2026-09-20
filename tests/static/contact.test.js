import { describe, it, expect } from 'vitest';
import { document, textOf } from '../helpers/page.js';

describe('datos de contacto de la sección Contacto', () => {
  const facts = textOf(document.querySelector('#cotizar .facts'));

  it('muestran el horario, la ubicación, el correo y los envíos a todo el país', () => {
    expect(facts).toContain('Lunes a viernes de 9 a 18 h');
    expect(facts).toContain('Paso del Rey, Moreno');
    expect(facts).toContain('clientes@delphgrafica.com.ar');
    expect(facts).toContain('Envíos a todo el país');
  });
});

describe('PAI (se quitó hasta confirmar qué es)', () => {
  it('no aparece en ningún texto visible ni en la descripción del sitio', () => {
    const visible = textOf(document.body);
    const description = document.querySelector('meta[name="description"]').getAttribute('content');
    expect(visible).not.toMatch(/\bPAI\b/);
    expect(description).not.toMatch(/\bPAI\b/);
  });
});
