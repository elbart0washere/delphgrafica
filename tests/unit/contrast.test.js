import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const inputCss = () => readFileSync(new URL('../../src/input.css', import.meta.url), 'utf8');

function token(name) {
  const match = inputCss().match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`));
  if (!match) throw new Error(`Falta el token --color-${name} en src/input.css`);
  return match[1];
}

const channel = (value) => {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel(n >> 16) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
};

const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const AA = 4.5;

describe('contraste AA de la paleta (regla 19)', () => {
  it('texto blanco sobre el acento', () => {
    expect(contrast('#ffffff', token('accent'))).toBeGreaterThanOrEqual(AA);
  });

  it('el acento sobre el papel (anillo de foco y enlaces)', () => {
    expect(contrast(token('accent'), token('paper'))).toBeGreaterThanOrEqual(AA);
  });

  it('tinta sobre el papel', () => {
    expect(contrast(token('ink'), token('paper'))).toBeGreaterThanOrEqual(AA);
  });

  it('tinta sobre el bloque cian', () => {
    expect(contrast(token('ink'), token('brand-cyan'))).toBeGreaterThanOrEqual(AA);
  });

  it('tinta sobre el bloque amarillo', () => {
    expect(contrast(token('ink'), token('brand-yellow'))).toBeGreaterThanOrEqual(AA);
  });
});
