import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { document, html } from '../helpers/page.js';
import { jsVersion, stampHtml } from '../../scripts/stamp.mjs';

const root = new URL('../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root));
const modules = readdirSync(new URL('js/', root)).filter((file) => file.endsWith('.js') && file !== 'main.js');

// Cloudflare le pone 4 horas de caché al navegador a todo lo estático. Sin versionar las URLs, quien ya visitó
// el sitio recibe el HTML nuevo con el CSS viejo (sitio sin estilos). Por eso cada URL lleva el hash de su contenido.
describe('URLs versionadas por contenido (evita mezclar HTML nuevo con CSS o JS viejos)', () => {
  it('index.html está sellado con los hashes actuales (correr `npm run build` si falla)', () => {
    expect(stampHtml(html, read)).toBe(html);
  });

  it('el CSS, el JS de entrada y las imágenes locales llevan ?v=', () => {
    const urls = [
      document.querySelector('link[rel="stylesheet"]').getAttribute('href'),
      document.querySelector('link[rel="icon"]').getAttribute('href'),
      document.querySelector('script[type="module"]').getAttribute('src'),
      ...[...document.querySelectorAll('img')].map((img) => img.getAttribute('src')),
    ];
    for (const url of urls) expect(url, url).toMatch(/\?v=[0-9a-f]{8}$/);
  });

  it('el mapa de importación versiona cada módulo, para que main.js no cargue módulos viejos', () => {
    const map = JSON.parse(document.querySelector('script[type="importmap"]').textContent);
    const version = jsVersion(read);
    expect(Object.keys(map.imports).sort()).toEqual(modules.map((file) => `./js/${file}`).sort());
    for (const file of modules) expect(map.imports[`./js/${file}`]).toBe(`./js/${file}?v=${version}`);
    expect(html.indexOf('type="importmap"')).toBeLessThan(html.indexOf('type="module"'));
  });

  it('la fuente se precarga con la misma URL que usa el CSS (con ?v= se descargaría dos veces)', () => {
    const preload = document.querySelector('link[rel="preload"][as="font"]').getAttribute('href');
    expect(preload).toBe('assets/fonts/inter-latin-var.woff2');
    expect(readFileSync(new URL('assets/styles.css', root), 'utf8')).toContain('url(fonts/inter-latin-var.woff2)');
  });
});
