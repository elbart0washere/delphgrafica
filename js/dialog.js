// Modal de "Adjuntar archivo": usa el <dialog> nativo, que ya resuelve Esc, el foco atrapado y el fondo
// inerte. Se agrega el cierre al tocar fuera del cuadro y devolver el foco al botón que lo abrió, porque
// no todos los navegadores lo hacen solos.
export function initDialog(dialog = document.querySelector('#modal-arte')) {
  if (!dialog || typeof dialog.showModal !== 'function') return;

  let opener = null;

  for (const button of document.querySelectorAll('[data-abrir-modal]')) {
    button.addEventListener('click', () => {
      opener = button;
      dialog.showModal();
    });
  }
  for (const closer of dialog.querySelectorAll('[data-cerrar-modal]')) {
    closer.addEventListener('click', () => dialog.close());
  }
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => opener?.focus());
}
