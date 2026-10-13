import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { INDEXED_PAGES } from '../../scripts/stamp.mjs';
import { EMAIL, IG, WA, document as home, textOf } from '../helpers/page.js';
import { findPromiseWords } from '../helpers/guards.js';

const root = new URL('../../', import.meta.url);
const ORIGIN = 'https://delphgrafica.com.ar';
const exists = existsSync(new URL('llms.txt', root));
const text = exists ? readFileSync(new URL('llms.txt', root), 'utf8') : '';

// llms.txt es un resumen en texto plano (Markdown) para asistentes de IA. Lo que dice tiene que ser lo que dice el
// sitio: si se desfasa, un asistente le repite a un cliente un horario o un servicio que ya no existe.
describe('llms.txt', () => {
  it('existe y sigue el formato: título, resumen en cita y secciones', () => {
    expect(exists).toBe(true);
    expect(text).toMatch(/^# Gráfica Delph\n/);
    expect(text).toMatch(/^> .{40,}/m);
    expect(text).toMatch(/^## Páginas$/m);
    expect(text).toMatch(/^## Servicios$/m);
  });

  it('enlaza, con URL absoluta, exactamente las páginas que se indexan', () => {
    const links = [...text.matchAll(/^- \[[^\]]+\]\((https:\/\/[^)]+)\)/gm)].map((match) => match[1]).filter((url) => url.startsWith(ORIGIN));
    const pages = INDEXED_PAGES.map((page) => (page === 'index.html' ? `${ORIGIN}/` : `${ORIGIN}/${page}`));
    expect([...links].sort()).toEqual([...pages].sort());
  });

  it('lista los mismos servicios que el inicio', () => {
    const section = text.split(/^## Servicios$/m)[1].split(/^## /m)[0];
    const listed = [...section.matchAll(/^- ([^:\n]+):/gm)].map((match) => match[1]);
    expect(listed).toEqual([...home.querySelectorAll('.services .service h3')].map(textOf));
  });

  it('repite los datos de contacto del sitio', () => {
    expect(text).toContain('Paso del Rey, Moreno');
    expect(text).toContain('Lunes a viernes de 9 a 18 h');
    expect(text).toContain('Envíos a todo el país');
    expect(text).toContain(EMAIL);
    expect(text).toContain(IG);
    expect(text).toContain(WA);
  });

  it('no promete precios, plazos ni garantías que el sitio no ofrece', () => {
    expect(findPromiseWords(text)).toEqual([]);
  });
});

describe('check-deploy.sh verifica llms.txt', () => {
  it('lo incluye entre los chequeos de lo publicado', () => {
    expect(readFileSync(new URL('scripts/check-deploy.sh', root), 'utf8')).toContain('llms.txt');
  });
});
