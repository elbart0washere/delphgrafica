// Lógica pura de la sección de promos (sin DOM, para poder probarla).

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

// Por qué se fija la zona horaria: "hasta el 31/12" tiene que querer decir lo mismo para todos. Con la hora del
// dispositivo, alguien en otro huso vería la promo vencida (o viva) horas antes o después que en Argentina.
// `en-CA` formatea como AAAA-MM-DD, que además se puede comparar como texto.
const formatoArgentina = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Argentina/Buenos_Aires',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Fecha de hoy en Argentina, como AAAA-MM-DD. */
export function hoyEnArgentina(ahora = new Date()) {
  return formatoArgentina.format(ahora);
}

/**
 * ¿La promo sigue vigente? `hasta` es el último día en que vale (inclusive), como AAAA-MM-DD.
 * Si la fecha del HTML viene mal escrita, la promo queda visible: un typo no tiene que esconderla en silencio.
 */
export function vigente(hasta, hoy = hoyEnArgentina()) {
  if (typeof hasta !== 'string' || !FECHA.test(hasta)) return true;
  return hoy <= hasta;
}
