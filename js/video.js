// Video de calcos: no se baja hasta que está por verse, se reproduce solo (en silencio y en bucle) mientras está en
// pantalla, se pausa al salir, y no arranca solo si el sistema pide reducir movimiento. Siempre hay un botón para
// pausarlo o reproducirlo (WCAG 2.2.2: todo lo que se mueve más de 5 segundos se puede pausar).
export function initVideo(block = document.querySelector('[data-clip]')) {
  if (!block) return;

  const video = block.querySelector('video');
  const toggle = block.closest('section').querySelector('[data-clip-toggle]');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  let loaded = false;
  let playing = false; // la intención: lo que dice el botón
  let startedByScroll = false;
  let pausedByUser = false;

  const render = () => {
    toggle.textContent = playing ? 'Pausar video' : 'Reproducir video';
  };

  const load = () => {
    if (loaded) return;
    loaded = true;
    video.poster = video.dataset.poster;
    video.src = video.dataset.src;
  };

  const play = () => {
    load();
    playing = true;
    render();
    // El navegador puede negarse (política de autoplay, códec no soportado): entonces el botón vuelve a "Reproducir".
    Promise.resolve(video.play()).catch(() => {
      playing = false;
      render();
    });
  };

  const pause = () => {
    playing = false;
    render();
    video.pause();
  };

  new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        load();
        if (!reducedMotion.matches && !pausedByUser) {
          startedByScroll = true;
          play();
        }
      } else if (startedByScroll) {
        startedByScroll = false;
        pause();
      }
    },
    { rootMargin: '200px' },
  ).observe(block);

  toggle.addEventListener('click', () => {
    pausedByUser = playing;
    if (playing) pause();
    else play();
  });

  render();
}
