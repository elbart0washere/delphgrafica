// Landings (Gráfica en Moreno / Paso del Rey): muestra 6 fotos al azar del portfolio, leídas de portfolio.html del propio
// sitio. Así, al agregar una foto al portfolio aparece sola acá, sin repetirla en cada página.
// El HTML ya trae 6 fotos (las copia scripts/sync-gallery.mjs al construir) para Google y para quien no tiene JavaScript;
// acá se cambian por una muestra distinta en cada visita. Si algo falla, esas 6 quedan como están.
import { shuffle } from './shuffle.js';

const COUNT = 6;

// Los videos se dejan afuera: pesan y arrancan solos, y acá la idea es una vista rápida.
export function pickPhotos(doc, count = COUNT, random = Math.random) {
  const photos = [...doc.querySelectorAll('.gallery img')].map((img) => ({
    src: img.getAttribute('src'),
    alt: img.getAttribute('alt'),
    width: img.getAttribute('width'),
    height: img.getAttribute('height'),
  }));
  return shuffle(photos, random).slice(0, count);
}

function photoItem(document, { src, alt, width, height }) {
  const item = document.createElement('li');
  const link = document.createElement('a');
  link.className = 'shot';
  link.href = 'portfolio.html';
  link.setAttribute('aria-label', `Ver más trabajos en el portfolio: ${alt}`);
  const img = document.createElement('img');
  img.src = src;
  img.alt = alt;
  img.setAttribute('width', width);
  img.setAttribute('height', height);
  img.setAttribute('loading', 'lazy');
  link.append(img);
  item.append(link);
  return item;
}

async function loadPortfolio() {
  const response = await fetch('portfolio.html');
  if (!response.ok) throw new Error(`portfolio.html respondió ${response.status}`);
  return new DOMParser().parseFromString(await response.text(), 'text/html');
}

export async function initTrabajos(document = globalThis.document, load = loadPortfolio) {
  const section = document?.querySelector('#trabajos');
  const list = section?.querySelector('[data-trabajos]');
  if (!list) return;
  try {
    const photos = pickPhotos(await load());
    if (!photos.length) return;
    list.replaceChildren(...photos.map((photo) => photoItem(document, photo)));
  } catch {
    // Sin poder leer el portfolio se queda la muestra del HTML.
  }
}

initTrabajos();
