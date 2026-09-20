import { describe, it, expect } from 'vitest';
import { EMAIL, IG, document, textOf } from '../helpers/page.js';

const script = document.querySelector('script[type="application/ld+json"]');
const data = script ? JSON.parse(script.textContent) : null;

describe('datos estructurados del negocio (SEO local)', () => {
  it('hay un JSON-LD válido de tipo LocalBusiness', () => {
    expect(script, 'falta <script type="application/ld+json">').not.toBeNull();
    expect(data['@context']).toBe('https://schema.org');
    expect(data['@type']).toBe('LocalBusiness');
  });

  it('identifica al negocio con los datos de la spec', () => {
    expect(data.name).toBe('Gráfica Delph');
    expect(data.url).toBe('https://delphgrafica.com.ar/');
    expect(data.email).toBe(EMAIL);
    expect(data.telephone).toBe('+5491172394787');
    expect(data.sameAs).toEqual([IG]);
    expect(data.areaServed).toEqual({ '@type': 'Country', name: 'Argentina' });
    expect(data.image).toMatch(/^https:\/\/delphgrafica\.com\.ar\/assets\/.+\.(png|jpg)$/);
  });

  it('la dirección es la localidad de la spec, sin calle', () => {
    expect(data.address).toEqual({
      '@type': 'PostalAddress',
      addressLocality: 'Paso del Rey',
      addressRegion: 'Buenos Aires',
      addressCountry: 'AR',
    });
  });

  it('el horario es de lunes a viernes de 9 a 18', () => {
    expect(data.openingHoursSpecification).toEqual([
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '09:00',
        closes: '18:00',
      },
    ]);
  });

  it('lo que declara coincide con lo que se ve en la página (no hay datos ocultos distintos)', () => {
    const visible = textOf(document.querySelector('#pie'));
    expect(visible).toContain(data.email);
    expect(visible).toContain(data.address.addressLocality);
    expect(visible).toContain('Lunes a viernes de 9 a 18 h');
    expect(visible).toContain('Envíos a todo el país'); // respalda areaServed
    expect(document.querySelector(`a[href="${data.sameAs[0]}"]`)).not.toBeNull();
    expect(document.querySelector(`a[href^="https://wa.me/${data.telephone.slice(1)}"]`)).not.toBeNull();
  });
});
