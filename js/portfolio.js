// Entrada de portfolio.html: mezcla las fotos en cada visita y abre cada una ampliada en un visor.
// Sin JavaScript la galería se ve igual, en el orden del HTML.
import { shuffle } from './shuffle.js';

const gallery = document.querySelector('.gallery');
const viewer = document.querySelector('#visor');

if (gallery) {
  // Reordenar los <li> existentes (en vez de recrearlos) conserva la carga diferida de cada imagen.
  gallery.append(...shuffle([...gallery.children]));
}

// Los videos de la grilla arrancan solos al verse (mudos y en bucle) y se pausan al salir de pantalla. Con movimiento
// reducido no arrancan solos. Al tocar uno se abre ampliado en el visor, igual que las fotos.
const clips = [...document.querySelectorAll('.gallery video')];
if (clips.length && !matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) entry.target.play().catch(() => {});
      else entry.target.pause();
    }
  }, { threshold: 0.5 });
  for (const video of clips) observer.observe(video);
}

if (gallery && viewer && typeof viewer.showModal === 'function') {
  const photo = viewer.querySelector('img');
  const clip = viewer.querySelector('video');
  const counter = viewer.querySelector('[data-visor-contador]');
  let index = 0;
  let opener = null;

  // Cada <li> es una foto o un video; el visor recorre todos en el orden (ya mezclado) de la grilla.
  const media = () => [...gallery.querySelectorAll('li')].map((item) => item.querySelector('img, video'));

  const show = (next) => {
    const list = media();
    index = (next + list.length) % list.length;
    const item = list[index];
    const isVideo = item.tagName === 'VIDEO';
    clip.pause();
    photo.hidden = isVideo;
    clip.hidden = !isVideo;
    if (isVideo) {
      clip.src = item.currentSrc || item.getAttribute('src');
      clip.setAttribute('aria-label', item.closest('button').getAttribute('aria-label'));
      clip.play().catch(() => {});
    } else {
      photo.src = item.src;
      photo.alt = item.alt;
    }
    counter.textContent = `${index + 1} de ${list.length}`;
  };

  for (const button of gallery.querySelectorAll('button')) {
    button.addEventListener('click', () => {
      opener = button;
      show(media().indexOf(button.querySelector('img, video')));
      viewer.showModal();
    });
  }
  viewer.querySelector('[data-visor-anterior]').addEventListener('click', () => show(index - 1));
  viewer.querySelector('[data-visor-siguiente]').addEventListener('click', () => show(index + 1));
  viewer.querySelector('[data-visor-cerrar]').addEventListener('click', () => viewer.close());
  viewer.addEventListener('click', (event) => {
    if (event.target === viewer) viewer.close();
  });
  viewer.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') show(index - 1);
    if (event.key === 'ArrowRight') show(index + 1);
  });
  viewer.addEventListener('close', () => {
    clip.pause();
    opener?.focus();
  });
}
