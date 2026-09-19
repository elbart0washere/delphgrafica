import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = new URL('../../', import.meta.url).pathname;

describe('CSS compilado con el CLI de Tailwind (sin CDN)', () => {
  it('assets/styles.css commiteado coincide con una compilación fresca de src/input.css', () => {
    const committed = join(root, 'assets/styles.css');
    expect(existsSync(committed), 'falta assets/styles.css (npm run build:css)').toBe(true);

    const out = join(mkdtempSync(join(tmpdir(), 'delph-css-')), 'styles.css');
    execFileSync(join(root, 'node_modules/.bin/tailwindcss'), ['-i', 'src/input.css', '-o', out, '--minify'], {
      cwd: root,
      stdio: 'pipe',
    });

    expect(readFileSync(committed, 'utf8')).toBe(readFileSync(out, 'utf8'));
  }, 30_000);

  it('index.html no depende del CDN de Tailwind', () => {
    const html = readFileSync(join(root, 'index.html'), 'utf8');
    expect(html).not.toMatch(/cdn\.tailwindcss\.com/);
  });
});
