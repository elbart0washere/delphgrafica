import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import {
  findAccentMisuse,
  findExternalImages,
  findForbiddenApis,
  findNonVoseo,
  findPromiseWords,
  visibleText,
} from '../helpers/guards.js';

const root = new URL('../../', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');
const jsDir = new URL('js/', root);
const jsFiles = existsSync(jsDir) ? readdirSync(jsDir).filter((f) => f.endsWith('.js')) : [];
const sourceOf = (file) => readFileSync(new URL(file, jsDir), 'utf8');

// Enmienda a la regla 10 (octubre de 2026): la landing sigue sin guardar ni enviar nada. La ÚNICA excepción es el
// formulario de pedidos, que existe justamente para mandar el archivo y los datos del cliente al sistema de pedidos
// de Gráfica Delph. Se le permite `fetch`, y nada más: ni almacenamiento del navegador, ni cookies, ni otros envíos.
const ORDER_FORM_MODULES = ['pedido.js', 'pedido-logic.js', 'pedido-upload.js'];
const ORDER_FORM_ALLOWED_URLS = [
  'https://pedidos.delphgrafica.com.ar', // el sistema de pedidos
  'https://wa.me/5491172394787', // WhatsApp del taller
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', // verificación anti-robots
];
const pedidoHtml = readFileSync(new URL('pedido.html', root), 'utf8');
const privacidadHtml = readFileSync(new URL('privacidad.html', root), 'utf8');

describe('los detectores detectan (fixtures que violan la regla)', () => {
  it('imágenes externas', () => {
    expect(findExternalImages('<img src="https://images.unsplash.com/x.jpg"><img src="assets/a.jpg">')).toEqual([
      'https://images.unsplash.com/x.jpg',
    ]);
  });

  it('APIs que sacarían datos del navegador (regla 10)', () => {
    expect(findForbiddenApis('fetch("https://x.com/api"); localStorage.setItem("a","b")')).toHaveLength(2);
    expect(findForbiddenApis('const url = buildUrl(data); window.open(url)')).toEqual([]);
  });

  it('con allowFetch (solo el formulario de pedidos) fetch se permite, pero el resto sigue prohibido', () => {
    expect(findForbiddenApis('fetch("/x")', { allowFetch: true })).toEqual([]);
    expect(findForbiddenApis('fetch("/x"); localStorage.setItem("a","b")', { allowFetch: true })).toHaveLength(1);
    expect(findForbiddenApis('navigator.sendBeacon("/x"); document.cookie = "a=b"; sessionStorage.x = 1', { allowFetch: true })).toHaveLength(3);
  });

  // Leer una página del propio sitio no saca nada del navegador; mandar o pedir algo a otro dominio, o a una URL
  // armada en el momento (que podría llevar datos), sí.
  it('fetch solo se permite a una ruta fija del propio sitio', () => {
    expect(findForbiddenApis("fetch('portfolio.html')")).toEqual([]);
    expect(findForbiddenApis('fetch("/portfolio.html")')).toEqual([]);
    expect(findForbiddenApis('fetch("https://otro.com/x")')).not.toEqual([]);
    expect(findForbiddenApis('fetch("//otro.com/x")')).not.toEqual([]);
    expect(findForbiddenApis('fetch(`portfolio.html?q=${dato}`)')).not.toEqual([]);
    expect(findForbiddenApis('fetch(url)')).not.toEqual([]);
    expect(findForbiddenApis("fetch('portfolio.html', { method: 'POST', body })")).not.toEqual([]);
  });

  it('palabras de promesa (regla 13)', () => {
    expect(findPromiseWords('Entrega en 24 hs, gratis')).not.toEqual([]);
    expect(findPromiseWords('Impresión digital y offset')).toEqual([]);
  });

  it('formas no rioplatenses (regla 12)', () => {
    expect(findNonVoseo('Si quieres cotizar, contáctanos')).not.toEqual([]);
    expect(findNonVoseo('Si querés cotizar, escribinos. Cotizá tu proyecto')).toEqual([]);
  });

  it('acento fuera de los ids permitidos (regla 16)', () => {
    const violating = '<div id="decoracion" class="bg-accent"></div><a id="cta-hero" class="bg-accent"></a>';
    expect(findAccentMisuse(violating)).toEqual(['decoracion']);
    expect(findAccentMisuse('<a class="hover:bg-accent focus-visible:ring-accent"></a>')).toEqual([]);
    expect(findAccentMisuse('<a id="otro" class="btn btn-cta"></a>')).toEqual(['otro']);
    expect(findAccentMisuse('<a id="btn-ig-banner" class="btn btn-cta"></a>')).toEqual([]);
  });
});

describe('guardas sobre el sitio', () => {
  it('sin imágenes externas ni de stock', () => {
    expect(findExternalImages(html)).toEqual([]);
  });

  it('el JS de la landing no guarda ni envía datos (regla 10)', () => {
    for (const file of jsFiles.filter((f) => !ORDER_FORM_MODULES.includes(f))) expect(findForbiddenApis(sourceOf(file)), file).toEqual([]);
  });

  it('regla 10 enmendada: el formulario de pedidos solo puede usar fetch; nunca almacenamiento, cookies ni otros envíos', () => {
    for (const file of ORDER_FORM_MODULES) {
      expect(jsFiles, file).toContain(file);
      expect(findForbiddenApis(sourceOf(file), { allowFetch: true }), file).toEqual([]);
    }
  });

  it('regla 10 enmendada: el formulario de pedidos solo menciona direcciones del sistema de pedidos, WhatsApp y Turnstile', () => {
    for (const file of ORDER_FORM_MODULES) {
      const urls = sourceOf(file).match(/https?:\/\/[^\s'"`)]+/g) ?? [];
      for (const url of urls) expect(ORDER_FORM_ALLOWED_URLS.some((allowed) => url.startsWith(allowed)), `${file}: ${url}`).toBe(true);
    }
  });

  it('ninguna otra página manda datos: solo pedido.html carga el módulo del formulario de pedidos', () => {
    for (const page of ['index.html', 'portfolio.html', 'grafica-en-moreno.html', '404.html', 'privacidad.html']) {
      expect(readFileSync(new URL(page, root), 'utf8'), page).not.toMatch(/js\/pedido\.js/);
    }
  });

  // La política de privacidad queda fuera de la regla 13: tiene que decir cuánto tiempo se guardan los datos ("30 días").
  it('el copy no promete plazos, precios ni garantías (regla 13)', () => {
    expect(findPromiseWords(visibleText(html))).toEqual([]);
    expect(findPromiseWords(visibleText(pedidoHtml))).toEqual([]);
  });

  it('el copy está en voseo rioplatense (regla 12)', () => {
    for (const page of [html, pedidoHtml, privacidadHtml]) expect(findNonVoseo(visibleText(page))).toEqual([]);
  });

  it('el acento solo aparece en los botones permitidos (regla 16)', () => {
    for (const page of [html, pedidoHtml, privacidadHtml]) expect(findAccentMisuse(page)).toEqual([]);
  });

  it('sin imágenes externas en el formulario ni en la política de privacidad', () => {
    for (const page of [pedidoHtml, privacidadHtml]) expect(findExternalImages(page)).toEqual([]);
  });
});
