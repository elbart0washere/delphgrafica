// Entrada del sitio: conecta los módulos con el DOM.
import { initDialog } from './dialog.js';
import { initForm } from './form.js';

initForm();
initDialog();

// El ancla nativa hace el desplazamiento; acá solo se mueve el foco a la sección del formulario.
document.querySelector('#cta-hero')?.addEventListener('click', () => {
  document.querySelector('#cotizar')?.focus({ preventScroll: true });
});
