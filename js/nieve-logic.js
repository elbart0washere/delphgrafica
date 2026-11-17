// Lógica pura de la nevada decorativa (sin DOM, para poder probarla). Cada página usa un estilo distinto:
//  - clasica:   copos redondos que caen casi derechos (portada)
//  - cristales: cristales de 6 puntas, grandes, lentos y girando (Moreno)
//  - ventisca:  puntitos chicos y rápidos empujados en diagonal por el viento (Paso del Rey)
// Medidas en píxeles y segundos. `radio` y `caida` son [mínimo, máximo]; `cantidad` es [celular, compu].
export const ESTILOS = {
  clasica: { forma: 'redondo', radio: [1.5, 4], caida: [25, 55], viento: 0, vaiven: 14, giro: 0, cantidad: [35, 60] },
  cristales: { forma: 'cristal', radio: [6, 12], caida: [15, 35], viento: 0, vaiven: 10, giro: 0.8, cantidad: [14, 26] },
  ventisca: { forma: 'redondo', radio: [1.4, 3.2], caida: [40, 80], viento: 35, vaiven: 6, giro: 0, cantidad: [70, 115] },
};

const CELULAR = 640; // por debajo de este ancho, menos copos: cuida la batería y no tapa el contenido
const TOPE = 120;
const SALTO_MAXIMO = 0.5; // s. Si la pestaña estuvo dormida, no se manda el copo lejos: se avanza como mucho esto.
const MARGEN = 12;

const estiloDe = (nombre) => ESTILOS[nombre] ?? ESTILOS.clasica;
const entre = ([min, max], azar) => min + azar * (max - min);

export function cantidadDeCopos(nombre, ancho) {
  const [celular, compu] = estiloDe(nombre).cantidad;
  return Math.min(TOPE, ancho < CELULAR ? celular : compu);
}

/** Un copo nuevo. Al arrancar (`repartido`) se esparce por toda la altura; al reciclarse nace arriba, fuera de la vista. */
export function crearCopo(nombre, ancho, alto, azar = Math.random, repartido = false) {
  const estilo = estiloDe(nombre);
  const r = entre(estilo.radio, azar());
  return {
    x: azar() * ancho,
    y: repartido ? azar() * alto : -(r + azar() * 40),
    r,
    vy: entre(estilo.caida, azar()),
    vx: estilo.viento * (0.7 + 0.6 * azar()),
    fase: azar() * Math.PI * 2,
    ang: azar() * Math.PI,
  };
}

/** Mueve el copo `dt` segundos. Si sale por abajo vuelve a nacer arriba; si sale por un costado entra por el otro. */
export function avanzar(copo, nombre, dt, ancho, alto, azar = Math.random) {
  const estilo = estiloDe(nombre);
  const t = Math.min(Math.max(dt, 0), SALTO_MAXIMO);
  copo.fase += t;
  copo.y += copo.vy * t;
  copo.x += (copo.vx + Math.sin(copo.fase * 0.9) * estilo.vaiven) * t;
  copo.ang += estilo.giro * t;

  if (copo.y > alto + copo.r + MARGEN) {
    Object.assign(copo, crearCopo(nombre, ancho, alto, azar));
    return;
  }
  if (copo.x > ancho + MARGEN) copo.x -= ancho + 2 * MARGEN;
  else if (copo.x < -MARGEN) copo.x += ancho + 2 * MARGEN;
}
