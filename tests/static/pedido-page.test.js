import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { textOf } from '../helpers/page.js';

const root = new URL('../../', import.meta.url);
const load = (page) => new JSDOM(readFileSync(new URL(page, root), 'utf8')).window.document;
const pedido = load('pedido.html');
const privacidad = load('privacidad.html');

describe('pedido.html: la página del formulario de pedidos', () => {
  it('tiene un solo título principal, su canonical y no se indexa (es una página de trámite, no de contenido)', () => {
    expect(pedido.querySelectorAll('h1')).toHaveLength(1);
    expect(textOf(pedido.querySelector('h1'))).toBe('Mandanos tu trabajo');
    expect(pedido.querySelector('link[rel="canonical"]').getAttribute('href')).toBe('https://delphgrafica.com.ar/pedido.html');
    expect(pedido.querySelector('meta[name="robots"]').getAttribute('content')).toContain('noindex');
  });

  it('el formulario se oculta sin JavaScript y queda el aviso con el enlace a WhatsApp', () => {
    const form = pedido.querySelector('#form-pedido');
    expect(form.classList.contains('js-only')).toBe(true);
    expect(form.hasAttribute('novalidate')).toBe(true);
    expect(pedido.querySelector('head noscript style').textContent).toContain('.js-only{display:none}');
    const notice = pedido.querySelector('main noscript');
    expect(notice.textContent).toContain('activá JavaScript');
    expect(notice.innerHTML).toContain('https://wa.me/5491172394787');
  });

  it('cada campo tiene su etiqueta, y cada uno apunta a un mensaje de error que existe', () => {
    const fields = [...pedido.querySelectorAll('#form-pedido input:not([type="file"]):not([type="radio"]), #form-pedido select, #form-pedido textarea')];
    expect(fields.length).toBeGreaterThanOrEqual(7);
    for (const field of fields) {
      expect(pedido.querySelector(`label[for="${field.id}"]`), `etiqueta de #${field.id}`).not.toBeNull();
      for (const id of (field.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean)) {
        expect(pedido.getElementById(id), `#${field.id} → #${id}`).not.toBeNull();
      }
    }
  });

  it('los mensajes de error se anuncian a los lectores de pantalla', () => {
    for (const error of pedido.querySelectorAll('#form-pedido .field-error')) {
      expect(['alert', 'status'], `#${error.id}`).toContain(error.getAttribute('role'));
    }
  });

  it('los cuatro pasos son grupos con título (el orden importa y se anuncia)', () => {
    const steps = [...pedido.querySelectorAll('#form-pedido fieldset.step > legend')].map((l) => textOf(l));
    expect(steps).toEqual(['¿Qué querés imprimir?', '¿Cuántas necesitás?', 'Tus archivos', '¿Cómo te avisamos?']);
  });

  it('el formulario avanza de a un paso: Atrás y Siguiente, con el botón de enviar recién al final', () => {
    expect(pedido.querySelector('#btn-atras').getAttribute('type')).toBe('button');
    expect(pedido.querySelector('#btn-siguiente').getAttribute('type')).toBe('button');
    expect(pedido.querySelector('#btn-enviar').getAttribute('type')).toBe('submit');
    expect(pedido.querySelector('#paso-actual').getAttribute('role')).toBe('status');
    expect(pedido.querySelectorAll('#form-pedido .wiz-bar i')).toHaveLength(4);
  });

  it('acepta solo los formatos que acepta el sistema, hasta varios archivos, con la entrada nativa oculta', () => {
    const input = pedido.querySelector('#archivos');
    expect(input.getAttribute('accept').split(',').sort()).toEqual(['.jpeg', '.jpg', '.pdf', '.png', '.tif', '.tiff']);
    expect(input.hasAttribute('multiple')).toBe(true);
    expect(input.hasAttribute('hidden')).toBe(true);
    expect(pedido.querySelector('#zona-archivos').tagName).toBe('BUTTON');
  });

  it('junto al consentimiento hay un enlace a la política de privacidad, en una pestaña nueva y sin filtrar el origen', () => {
    const link = pedido.querySelector('#form-pedido a[href="privacidad.html"]');
    expect(link.getAttribute('href')).toBe('privacidad.html');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(pedido.querySelector('#consentimiento').hasAttribute('checked')).toBe(false); // nunca viene tildado de fábrica
  });

  it('el botón de enviar es el único con el color de acento', () => {
    expect(pedido.querySelector('#btn-enviar').className).toContain('btn-cta');
    expect(pedido.querySelectorAll('.btn-cta')).toHaveLength(1);
  });

  it('mientras se carga el pedido no hay accesos a WhatsApp que distraigan: ni en el encabezado, ni flotante, ni en el formulario', () => {
    expect(pedido.querySelector('#fab-whatsapp')).toBeNull();
    expect(pedido.querySelector('header.top .btn-wa')).toBeNull();
    expect(pedido.querySelector('#form-pedido a[href*="wa.me"]')).toBeNull();
  });

  it('no pide medidas y las terminaciones son dos casillas separadas, ocultas hasta que se elige un banner', () => {
    expect(pedido.querySelector('#ancho')).toBeNull();
    expect(pedido.querySelector('#alto')).toBeNull();
    expect(pedido.querySelector('#spec')).toBeNull();
    expect(pedido.querySelector('#terminacion')).toBeNull(); // ya no hay lista desplegable con "Ojales y bolsillo" junto
    const group = pedido.querySelector('fieldset#terminacion-grupo');
    expect(group.hasAttribute('hidden')).toBe(true);
    const boxes = [...group.querySelectorAll('input[type="checkbox"][name="terminacion"]')];
    expect(boxes.map((b) => b.value)).toEqual(['Ojales', 'Bolsillos']);
    expect(boxes.some((b) => b.hasAttribute('checked'))).toBe(false);
  });

  it('la subida se avisa en un diálogo modal (visible aunque el botón quede abajo), cerrado al principio', () => {
    const dialog = pedido.querySelector('dialog#dialogo-subida');
    expect(dialog).not.toBeNull();
    expect(dialog.hasAttribute('open')).toBe(false);
    expect(dialog.getAttribute('aria-labelledby')).toBe('subida-titulo');
    expect(dialog.querySelector('#progreso progress#barra')).not.toBeNull();
    expect(textOf(dialog.querySelector('#subida-titulo'))).toMatch(/subiendo/i);
  });

  it('tiene un lugar para la verificación anti-robots, la barra de progreso y la pantalla final, ocultos al principio', () => {
    expect(pedido.querySelector('#verificacion-robots')).not.toBeNull();
    // Un id "turnstile" haría que window.turnstile sea el <div> y no la API de Cloudflare (los navegadores exponen cada id en window).
    expect(pedido.getElementById('turnstile')).toBeNull();
        expect(pedido.querySelector('progress#barra')).not.toBeNull();
    expect(pedido.querySelector('#pedido-listo').hasAttribute('hidden')).toBe(true);
    expect(pedido.querySelector('#numero-pedido')).not.toBeNull();
  });

  it('avisa que hay que subir el original, no el reenviado por WhatsApp', () => {
    expect(textOf(pedido.querySelector('main'))).toContain('Subí el original, no el reenviado por WhatsApp');
  });

  it('no trae scripts de terceros en el HTML: la verificación anti-robots se carga desde el módulo, no a ciegas', () => {
    for (const script of pedido.querySelectorAll('script[src]')) expect(script.getAttribute('src'), script.outerHTML).toMatch(/^js\//);
  });

  it('el módulo de entrada es js/pedido.js, sellado con su versión', () => {
    expect(pedido.querySelector('script[type="module"]').getAttribute('src')).toMatch(/^js\/pedido\.js\?v=[0-9a-f]{8}$/);
  });
});

describe('privacidad.html: política de privacidad básica', () => {
  const text = textOf(privacidad.querySelector('main'));

  it('tiene un solo título principal y canonical', () => {
    expect(privacidad.querySelectorAll('h1')).toHaveLength(1);
    expect(textOf(privacidad.querySelector('h1'))).toBe('Política de privacidad');
    expect(privacidad.querySelector('link[rel="canonical"]').getAttribute('href')).toBe('https://delphgrafica.com.ar/privacidad.html');
  });

  it('cubre lo que pide una política básica', () => {
    const headings = [...privacidad.querySelectorAll('main h2')].map(textOf);
    expect(headings).toEqual([
      'Quién es responsable',
      'Qué datos recibimos',
      'Para qué los usamos',
      'Dónde se guardan',
      'Cuánto tiempo los conservamos',
      'Tus derechos',
      'Seguridad',
      'Cookies',
      'Cambios',
    ]);
  });

  it('dice lo que el sistema realmente hace: plazo de 30 días, papelera, servidores fuera del país y la ley', () => {
    expect(text).toContain('hasta 30 días después');
    expect(text).toContain('papelera de Google Drive');
    expect(text).toMatch(/fuera de Argentina/);
    expect(text).toContain('Ley 25.326');
    expect(text).toContain('Agencia de Acceso a la Información Pública');
  });

  it('da un contacto para ejercer los derechos', () => {
    const mail = privacidad.querySelector('main a[href^="mailto:"]');
    expect(mail.getAttribute('href')).toBe('mailto:clientes@delphgrafica.com.ar');
  });

  it('no promete lo que el sistema no hace: no dice que borra solo a una fecha exacta', () => {
    expect(text).not.toMatch(/se (borran|eliminan) autom[aá]ticamente/i);
  });
});

describe('el pie de las páginas enlaza la política de privacidad', () => {
  it.each(['index.html', 'portfolio.html', 'grafica-en-moreno.html', 'grafica-en-paso-del-rey.html', 'pedido.html', 'privacidad.html'])('%s', (page) => {
    const link = load(page).querySelector('#pie a[href="privacidad.html"]');
    expect(link, 'falta el enlace').not.toBeNull();
    expect(textOf(link)).toBe('Política de privacidad');
  });
});

describe('el inicio lleva al formulario de pedidos', () => {
  it('"Adjuntar archivo / Arte final" es un enlace a pedido.html y ya no hay modal', () => {
    const index = load('index.html');
    const link = index.querySelector('#btn-adjuntar');
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('pedido.html');
    expect(textOf(link)).toBe('Adjuntar archivo / Arte final');
    expect(index.querySelector('dialog#modal-arte')).toBeNull();
    expect(index.body.textContent).not.toContain('Próximamente');
  });
});

describe('las landings y el portfolio llevan al formulario de pedidos', () => {
  it.each(['grafica-en-moreno.html', 'grafica-en-paso-del-rey.html', 'portfolio.html'])('%s enlaza a pedido.html', (page) => {
    const link = load(page).querySelector('.gallery-cta a[href="pedido.html"]');
    expect(link, 'falta el enlace').not.toBeNull();
    expect(textOf(link)).toBe('Subí tu diseño');
  });
});

describe('el menú principal lleva al formulario de pedidos', () => {
  it.each(['index.html', 'portfolio.html', 'grafica-en-moreno.html', 'grafica-en-paso-del-rey.html', 'pedido.html', 'privacidad.html'])('%s', (page) => {
    const link = load(page).querySelector('nav.menu a[href="pedido.html"]');
    expect(link, 'falta el enlace').not.toBeNull();
    expect(textOf(link)).toBe('Subí tu diseño');
  });
});
