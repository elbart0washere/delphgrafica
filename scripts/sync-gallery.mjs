// Copia 6 fotos del portfolio al HTML de las landings ("Trabajos de nuestro taller").
//
// Por qué: js/trabajos.js cambia esa muestra por otra al azar en cada visita, pero Google y quien no tiene JavaScript
// solo ven lo que ya está escrito en el HTML. Esta copia es esa versión estática.
// La muestra se conserva mientras siga siendo válida (6 fotos que existen en el portfolio): si se sorteara en cada
// build, cualquier cambio chico (un color del CSS) movería las fotos de las landings y ensuciaría el historial.
// Uso: `npm run build` (corre antes del sellado, que le pone `?v=` a lo que copia).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { shuffle } from '../js/shuffle.js';

const root = new URL('../', import.meta.url);
export const LANDINGS = ['grafica-en-moreno.html', 'grafica-en-paso-del-rey.html'];
export const COUNT = 6;
export const START = '<!-- galeria-portfolio:inicio -->';
export const END = '<!-- galeria-portfolio:fin -->';

const photosIn = (html, selector) =>
  [...new JSDOM(html).window.document.querySelectorAll(selector)].map((img) => ({
    src: img.getAttribute('src'),
    alt: img.getAttribute('alt'),
    width: img.getAttribute('width'),
    height: img.getAttribute('height'),
  }));

/** Fotos del portfolio (los videos quedan afuera), en orden aleatorio y sin repetir. */
export function pickPhotos(portfolioHtml, count = COUNT, random = Math.random) {
  return shuffle(photosIn(portfolioHtml, '.gallery img'), random).slice(0, count);
}

/** La muestra que ya tiene la landing, si todas sus fotos siguen en el portfolio; si no, una nueva. */
export function keepOrPick(landingHtml, portfolioHtml, random = Math.random) {
  const available = new Set(photosIn(portfolioHtml, '.gallery img').map((p) => `${p.src}|${p.alt}`));
  const current = photosIn(landingHtml, '[data-trabajos] img');
  const valid = current.length === COUNT && current.every((p) => available.has(`${p.src}|${p.alt}`));
  return valid ? current : pickPhotos(portfolioHtml, COUNT, random);
}

const escape = (text) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** Cada foto es un enlace al portfolio (no un botón: las landings no tienen el visor ampliado). */
export function renderGallery(photos) {
  const items = photos.map(({ src, alt, width, height }) =>
    `    <li><a class="shot" href="portfolio.html" aria-label="Ver más trabajos en el portfolio: ${escape(alt)}"><img src="${src}" alt="${escape(alt)}" width="${width}" height="${height}" loading="lazy"></a></li>`);
  return `<ul class="gallery" data-trabajos>\n${items.join('\n')}\n  </ul>`;
}

export function syncGallery(html, photos) {
  const pattern = new RegExp(`${START}[\\s\\S]*?${END}`);
  if (!pattern.test(html)) throw new Error(`Faltan las marcas ${START} y ${END}`);
  return html.replace(pattern, () => `${START}\n  ${renderGallery(photos)}\n  ${END}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const portfolio = readFileSync(new URL('portfolio.html', root), 'utf8');
  for (const page of LANDINGS) {
    const path = fileURLToPath(new URL(page, root));
    const before = readFileSync(path, 'utf8');
    const after = syncGallery(before, keepOrPick(before, portfolio));
    if (after === before) console.log(`${page}: galería sin cambios`);
    else {
      writeFileSync(path, after);
      console.log(`${page}: galería actualizada`);
    }
  }
}
