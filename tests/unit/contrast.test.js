import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const inputCss = () => readFileSync(new URL('../../src/input.css', import.meta.url), 'utf8');

function token(name) {
  const match = inputCss().match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`));
  if (!match) throw new Error(`Falta el token --color-${name} en src/input.css`);
  return match[1];
}

const WHITE = '#ffffff';

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

const AA_TEXT = 4.5;
const AA_UI = 3;

// [color de frente, color de fondo, mínimo, descripción]
const PAIRS = [
  [WHITE, 'accent', AA_TEXT, 'texto blanco sobre el botón de acento'],
  [WHITE, 'wa', AA_TEXT, 'texto blanco sobre los botones de WhatsApp'],
  ['accent', 'paper', AA_TEXT, 'acento sobre el papel (enlaces y foco)'],
  ['accent', 'ink', AA_UI, 'acento sobre la tinta (foco en el hero oscuro)'],
  ['ink', 'paper', AA_TEXT, 'tinta sobre el papel'],
  ['ink', 'brand-cyan', AA_TEXT, 'tinta sobre el bloque cian'],
  ['ink', 'brand-yellow', AA_TEXT, 'tinta sobre el bloque y el botón amarillo'],
  ['ink', 'cyan-100', AA_TEXT, 'tinta sobre el bloque cian claro'],
  ['ink', 'yellow-100', AA_TEXT, 'tinta sobre el bloque amarillo claro'],
  ['ink', 'mist-2', AA_TEXT, 'tinta sobre el bloque gris'],
  ['ink', 'mist-3', AA_TEXT, 'tinta sobre el bloque gris oscuro'],
  ['muted', 'paper', AA_TEXT, 'texto secundario sobre el papel'],
  ['muted', 'mist', AA_TEXT, 'texto secundario sobre el gris del hero'],
  [WHITE, 'ink', AA_TEXT, 'texto blanco sobre la tinta (hero y footer)'],
];

const resolve = (value) => (value.startsWith('#') ? value : token(value));

describe('contraste AA de la paleta (regla 19)', () => {
  for (const [fg, bg, min, label] of PAIRS) {
    it(label, () => {
      expect(contrast(resolve(fg), resolve(bg))).toBeGreaterThanOrEqual(min);
    });
  }
});
