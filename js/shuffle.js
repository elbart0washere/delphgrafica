// Orden aleatorio (Fisher-Yates). Devuelve una copia: el arreglo original no se toca.
// Se recorre de atrás hacia adelante intercambiando cada posición con una al azar entre 0 y ella misma; así
// cada orden posible tiene la misma probabilidad (ordenar con `sort(() => Math.random() - .5)` favorece algunos).
export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
