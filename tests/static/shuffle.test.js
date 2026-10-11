import { describe, it, expect } from 'vitest';
import { shuffle } from '../../js/shuffle.js';

describe('shuffle (orden aleatorio del portfolio)', () => {
  it('devuelve los mismos elementos, sin perder ni repetir ninguno', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    expect([...shuffle(items)].sort()).toEqual(items);
  });

  it('no modifica el arreglo original', () => {
    const items = ['a', 'b', 'c'];
    shuffle(items);
    expect(items).toEqual(['a', 'b', 'c']);
  });

  it('con un azar controlado, el resultado es el esperado', () => {
    expect(shuffle(['a', 'b', 'c'], () => 0)).toEqual(['b', 'c', 'a']);
    expect(shuffle(['a', 'b', 'c'], () => 0.999)).toEqual(['a', 'b', 'c']);
  });

  it('con 0 o 1 elemento no falla', () => {
    expect(shuffle([])).toEqual([]);
    expect(shuffle(['solo'])).toEqual(['solo']);
  });

  it('todos los órdenes posibles pueden salir (no hay sesgo grosero)', () => {
    const seen = new Set();
    for (let i = 0; i < 400; i++) seen.add(shuffle([1, 2, 3]).join(''));
    expect(seen.size).toBe(6);
  });
});
