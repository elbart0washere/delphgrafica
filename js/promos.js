// Sección de promos de la portada: oculta las promos vencidas y arma el carrusel.
import { hoyEnArgentina, vigente } from './promos-logic.js';

const ICONO_FLECHA = '<svg class="i" aria-hidden="true"><use href="#i-arrow-right"/></svg>';

export function initPromos(root = globalThis.document, hoy = hoyEnArgentina()) {
  const section = root?.querySelector('#promos');
  if (!section) return;

  // Cada grupo declara hasta cuándo vale (`data-hasta`). Sin JS quedan todos a la vista; con JS, el que venció se va solo.
  const grupos = [...section.querySelectorAll('[data-promos]')];
  for (const grupo of grupos) grupo.hidden = !vigente(grupo.dataset.hasta, hoy);

  // Si ya no queda ninguna promo vigente, desaparece la sección entera (con su espacio).
  const visibles = grupos.filter((grupo) => !grupo.hidden);
  section.hidden = visibles.length === 0;
  // El botón del hero lleva a esta sección: si la sección no está, el botón tampoco (si no, sería un enlace muerto).
  const acceso = root.querySelector('#btn-promos');
  if (acceso) acceso.hidden = section.hidden;

  // Con JS las promos son un carrusel. Sin JS (o en un navegador viejo sin estas APIs) queda la lista, que funciona igual.
  if (!soportaCarrusel()) return;
  section.dataset.vista = 'carrusel';
  for (const grupo of visibles) armarCarrusel(grupo);
}

const soportaCarrusel = () =>
  typeof ResizeObserver !== 'undefined' && typeof globalThis.matchMedia === 'function';

function armarCarrusel(grupo) {
  const lista = grupo.querySelector('.promo-list');
  const items = [...lista.children];
  if (items.length < 2) return;

  const reducirMovimiento = globalThis.matchMedia('(prefers-reduced-motion: reduce)');
  const titulo = grupo.querySelector('h2')?.textContent.trim() ?? 'Promos';

  grupo.setAttribute('role', 'region');
  grupo.setAttribute('aria-roledescription', 'carrusel');
  grupo.setAttribute('aria-label', titulo);

  const controles = document.createElement('div');
  controles.className = 'promo-controls';
  controles.innerHTML = `
    <button type="button" class="promo-arrow promo-prev" aria-label="Promo anterior">${ICONO_FLECHA}</button>
    <div class="promo-dots">${items
      .map((_, i) => `<button type="button" class="promo-dot" aria-label="Ir a la promo ${i + 1} de ${items.length}"></button>`)
      .join('')}</div>
    <button type="button" class="promo-arrow promo-next" aria-label="Promo siguiente">${ICONO_FLECHA}</button>`;
  lista.after(controles);

  const [anterior, siguiente] = controles.querySelectorAll('.promo-arrow');
  const dots = controles.querySelector('.promo-dots');
  const puntos = [...controles.querySelectorAll('.promo-dot')];
  let activo = 0;

  // Dónde tiene que quedar el scroll para que la promo `i` esté en su lugar (al borde, en celu; centrada, en compu).
  // Se calcula así, y no con "la más visible", porque en los extremos el scroll no llega a alinear la primera ni la última:
  // el tope del recorrido hace que dos promos se vean enteras a la vez y el punto activo quedaría trabado en una.
  const objetivo = (i) => {
    const centrada = getComputedStyle(items[0]).scrollSnapAlign.includes('center');
    const posicion = items[i].getBoundingClientRect().left - lista.getBoundingClientRect().left + lista.scrollLeft;
    const desfase = centrada ? (lista.clientWidth - items[i].offsetWidth) / 2 : parseFloat(getComputedStyle(lista).scrollPaddingLeft) || 0;
    const tope = lista.scrollWidth - lista.clientWidth;
    return Math.max(0, Math.min(tope, posicion - desfase));
  };

  const pintar = () => {
    puntos.forEach((punto, i) => (i === activo ? punto.setAttribute('aria-current', 'true') : punto.removeAttribute('aria-current')));
    anterior.disabled = lista.scrollLeft <= 2;
    siguiente.disabled = lista.scrollLeft >= lista.scrollWidth - lista.clientWidth - 2;
  };

  // La promo activa es la que quedó más cerca de su lugar: se actualiza sola mientras se desliza con el dedo.
  const actualizar = () => {
    const actual = lista.scrollLeft;
    // En los extremos manda la posición: en el tope del recorrido varias promos comparten el mismo destino (el scroll no da más).
    const tope = lista.scrollWidth - lista.clientWidth;
    if (actual <= 2 || actual >= tope - 2) {
      activo = actual <= 2 ? 0 : items.length - 1;
      pintar();
      return;
    }
    const masCerca = items.reduce((mejor, _, i) => (Math.abs(objetivo(i) - actual) < Math.abs(objetivo(mejor) - actual) ? i : mejor), 0);
    if (masCerca !== activo) activo = masCerca;
    pintar();
  };

  const moverA = (left) => lista.scrollTo({ left, behavior: reducirMovimiento.matches ? 'auto' : 'smooth' });
  const irA = (i) => moverA(objetivo(Math.max(0, Math.min(items.length - 1, i))));

  // Las flechas van a la parada anterior o siguiente según dónde está el scroll, no según el número de promo: en compu,
  // al final del recorrido, la 2 y la 3 comparten destino y "anterior" desde la 3 no se movería.
  // Si no hay parada en esa dirección (por ejemplo, se tocó mientras todavía animaba y falta menos de 8 px), se va al extremo:
  // nunca al otro lado, que era lo que pasaba con el índice -1.
  anterior.addEventListener('click', () => {
    const parada = items.findLastIndex((_, i) => objetivo(i) < lista.scrollLeft - 8);
    if (parada === -1) moverA(0);
    else irA(parada);
  });
  siguiente.addEventListener('click', () => {
    const parada = items.findIndex((_, i) => objetivo(i) > lista.scrollLeft + 8);
    if (parada === -1) moverA(lista.scrollWidth - lista.clientWidth);
    else irA(parada);
  });
  puntos.forEach((punto, i) => punto.addEventListener('click', () => irA(i)));

  let pendiente = false;
  lista.addEventListener(
    'scroll',
    () => {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(() => {
        pendiente = false;
        actualizar();
      });
    },
    { passive: true },
  );

  // Si las promos entran todas en pantalla (compu), no hace falta deslizar: se esconden los controles.
  const acomodar = () => {
    controles.hidden = lista.scrollWidth <= lista.clientWidth + 1;
    // Si el recorrido es tan corto que dos promos tienen el mismo destino (compu), los puntos engañarían: quedan solo las flechas.
    dots.hidden = !items.every((_, i) => i === 0 || objetivo(i) - objetivo(i - 1) > 8);
    actualizar();
  };
  new ResizeObserver(acomodar).observe(lista);
  acomodar();
  pintar();
}
