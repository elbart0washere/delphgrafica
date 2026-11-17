// Entrada del sitio: conecta los módulos con el DOM.
import { initForm } from './form.js';
import { initVideo } from './video.js';
import { initPromos } from './promos.js';
import { initNieve } from './nieve.js';

initForm();
// Cada fondo con video (Servicios y Trabajos) se maneja solo y tiene su propio botón de pausa.
document.querySelectorAll('[data-clip]').forEach((bloque) => initVideo(bloque));
initPromos();
initNieve();

// El ancla nativa hace el desplazamiento; acá solo se mueve el foco a la sección del formulario.
document.querySelector('#cta-hero')?.addEventListener('click', () => {
  document.querySelector('#cotizar')?.focus({ preventScroll: true });
});
