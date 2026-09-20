import { describe, it, expect } from 'vitest';
import { WA, document, textOf, waText } from '../helpers/page.js';

const EXPECTED = [
  ['Impresión en gran formato', 'Lonas, vinilos, cartelería y materiales especiales para tu local, tu evento o tu campaña.'],
  ['Impresión digital', 'Folletería, tarjetas de presentación, tags y todo lo que necesitás para tu marca.'],
  ['Laminados', 'Placas rígidas en PVC, alto impacto, espumado y corrugado.'],
  ['Merchandising y cositas corporativas', 'Remeras, pines, calcos y más, todo para destacar la identidad de tu empresa.'],
];

describe('servicios', () => {
  const cards = [...document.querySelectorAll('#servicios article')];

  it('US3-S1: aparecen exactamente los servicios, con su título, descripción y un ícono', () => {
    expect(cards.map((card) => [textOf(card.querySelector('h3')), textOf(card.querySelector('p'))])).toEqual(EXPECTED);
    for (const card of cards) expect(card.querySelector('svg')).not.toBeNull();
  });

  it('cada servicio tiene un "Cotizar esto" que abre WhatsApp con el servicio en el mensaje', () => {
    for (const [title] of EXPECTED) {
      const card = cards.find((c) => textOf(c.querySelector('h3')) === title);
      const link = card.querySelector('a');
      expect(textOf(link)).toBe('Cotizar esto');
      expect(link.getAttribute('href').startsWith(WA + '?text=')).toBe(true);
      expect(waText(link.getAttribute('href'))).toBe(`Hola! Quiero cotizar: ${title}`);
      expect(link.getAttribute('target')).toBe('_blank');
    }
  });

  it('no menciona offset (el taller no lo ofrece)', () => {
    expect(textOf(document.querySelector('#servicios')).toLowerCase()).not.toContain('offset');
  });
});
