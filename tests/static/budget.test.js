import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { document } from '../helpers/page.js';

const root = new URL('../../', import.meta.url);
const KB = 1024;

const gzipped = (path) => gzipSync(readFileSync(new URL(path, root))).length;
const raw = (path) => statSync(new URL(path, root)).size;

const TEXT = ['index.html', 'assets/styles.css', 'js/main.js', 'js/form.js', 'js/form-logic.js', 'js/dialog.js'];
const BINARY = ['assets/fonts/inter-latin-var.woff2', 'assets/logo.png', 'assets/logo-sm.png', 'assets/favicon.png'];

describe('performance', () => {
  it('regla28: la primera carga pesa 300 KB o menos (texto en gzip, binarios en crudo)', () => {
    const total = [...TEXT.map(gzipped), ...BINARY.map(raw)].reduce((sum, size) => sum + size, 0);
    expect(total, `${(total / KB).toFixed(1)} KB`).toBeLessThanOrEqual(300 * KB);
  });

  it('regla29: toda imagen fuera del encabezado y el hero carga diferida', () => {
    const below = [...document.querySelectorAll('img')].filter((img) => !img.closest('header, .hero'));
    expect(below.length).toBeGreaterThan(0);
    for (const img of below) expect(img.getAttribute('loading'), img.getAttribute('src')).toBe('lazy');
  });
});
