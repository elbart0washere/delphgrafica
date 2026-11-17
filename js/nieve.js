// Nevada decorativa de las fiestas. Es una capa de adorno: un <canvas> fijo que no recibe clics, sin texto ni enlaces,
// así que no toca el contenido que lee Google ni los lectores de pantalla. Se dibuja después de que la página carga, se
// apaga sola pasada la fecha (la misma que las promos, en hora de Argentina), no arranca si el sistema pide reducir
// movimiento y siempre se puede pausar (WCAG 2.2.2: lo que se mueve más de 5 segundos tiene que poder pausarse).
import { hoyEnArgentina, vigente } from './promos-logic.js';
import { ESTILOS, avanzar, cantidadDeCopos, crearCopo } from './nieve-logic.js';

const CRISTAL = 'rgba(70, 140, 205, .9)';
const RELLENO = 'rgba(255, 255, 255, .95)';
const BORDE = 'rgba(100, 160, 215, .8)';

function dibujarRedondo(ctx, copo) {
  ctx.beginPath();
  ctx.arc(copo.x, copo.y, copo.r, 0, Math.PI * 2);
  ctx.fillStyle = RELLENO;
  ctx.fill();
  ctx.strokeStyle = BORDE;
  ctx.lineWidth = 1;
  ctx.stroke();
}

// Cristal de 6 puntas con dos ramitas por brazo. Se dibuja con trazos celestes porque el fondo de la página es claro
// y un copo blanco no se vería.
function dibujarCristal(ctx, copo) {
  ctx.save();
  ctx.translate(copo.x, copo.y);
  ctx.rotate(copo.ang);
  ctx.strokeStyle = CRISTAL;
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    ctx.rotate(Math.PI / 3);
    ctx.moveTo(0, 0);
    ctx.lineTo(copo.r, 0);
    const rama = copo.r * 0.35;
    const base = copo.r * 0.6;
    ctx.moveTo(base, 0);
    ctx.lineTo(base + rama, rama);
    ctx.moveTo(base, 0);
    ctx.lineTo(base + rama, -rama);
  }
  ctx.stroke();
  ctx.restore();
}

export function initNieve(doc = globalThis.document, hoy = hoyEnArgentina()) {
  const bloque = doc?.querySelector('[data-nieve]');
  if (!bloque) return;

  // Vencida la fecha se esconde todo (nevada, guirnalda y botón). Una fecha mal escrita la deja visible.
  bloque.hidden = !vigente(bloque.dataset.hasta, hoy);
  // El header reserva el lugar de la guirnalda para que no se monte sobre sus botones; vencida, ese lugar se libera.
  doc.querySelector('.con-guirnalda')?.classList.toggle('con-guirnalda', !bloque.hidden);
  if (bloque.hidden) return;

  const ventana = doc.defaultView;
  const canvas = bloque.querySelector('canvas');
  const toggle = bloque.querySelector('[data-nieve-toggle]');
  // Sin animación disponible (o sin canvas) no hay nevada: la guirnalda queda quieta y el botón no tiene sentido.
  if (!canvas || !toggle || typeof ventana?.requestAnimationFrame !== 'function') return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const nombre = ESTILOS[bloque.dataset.nieve] ? bloque.dataset.nieve : 'clasica';
  const dibujar = ESTILOS[nombre].forma === 'cristal' ? dibujarCristal : dibujarRedondo;
  const reducido = ventana.matchMedia?.('(prefers-reduced-motion: reduce)');

  let activa = !reducido?.matches; // la intención: lo que dice el botón
  let cuadro = 0;
  let ultimo = 0;
  let ancho = 0;
  let alto = 0;
  const copos = [];

  const rotular = () => {
    toggle.textContent = activa ? 'Pausar nieve' : 'Activar nieve';
    bloque.classList.toggle('quieta', !activa); // también frena el titilar de la guirnalda
  };

  const medir = () => {
    ancho = ventana.innerWidth;
    alto = ventana.innerHeight;
    const dpr = Math.min(ventana.devicePixelRatio || 1, 2);
    canvas.width = Math.round(ancho * dpr);
    canvas.height = Math.round(alto * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cantidad = cantidadDeCopos(nombre, ancho);
    while (copos.length < cantidad) copos.push(crearCopo(nombre, ancho, alto, Math.random, true));
    copos.length = Math.min(copos.length, cantidad);
  };

  const cuadroNuevo = (ahora) => {
    cuadro = 0;
    if (!activa || doc.hidden) return;
    const dt = ultimo ? (ahora - ultimo) / 1000 : 0;
    ultimo = ahora;
    ctx.clearRect(0, 0, ancho, alto);
    for (const copo of copos) {
      avanzar(copo, nombre, dt, ancho, alto);
      dibujar(ctx, copo);
    }
    cuadro = ventana.requestAnimationFrame(cuadroNuevo);
  };

  const arrancar = () => {
    if (cuadro || !activa || doc.hidden) return;
    ultimo = 0;
    cuadro = ventana.requestAnimationFrame(cuadroNuevo);
  };

  const parar = () => {
    if (cuadro) ventana.cancelAnimationFrame(cuadro);
    cuadro = 0;
  };

  toggle.addEventListener('click', () => {
    activa = !activa;
    rotular();
    if (activa) arrancar();
    else {
      parar();
      ctx.clearRect(0, 0, ancho, alto);
    }
  });
  ventana.addEventListener('resize', medir);
  // Con la pestaña oculta no se gasta batería; al volver sigue donde estaba.
  doc.addEventListener('visibilitychange', () => (doc.hidden ? parar() : arrancar()));

  rotular();
  medir();
  // Después de que la página termina de cargar y el navegador está libre: la nieve nunca compite con el contenido.
  const empezar = () => arrancar();
  if (typeof ventana.requestIdleCallback === 'function') ventana.requestIdleCallback(empezar, { timeout: 1500 });
  else ventana.setTimeout(empezar, 300);
}
