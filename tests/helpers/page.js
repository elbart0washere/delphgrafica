import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

export const WA = 'https://wa.me/5491172394787';
export const IG = 'https://www.instagram.com/graficadelph/';
export const EMAIL = 'clientes@delphgrafica.com.ar';

export const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
export const { document } = new JSDOM(html).window;

export const textOf = (element) => element.textContent.replace(/\s+/g, ' ').trim();

/** Texto que lleva un enlace de WhatsApp en el parámetro `text`, ya decodificado. */
export const waText = (href) => decodeURIComponent(new URL(href).searchParams.get('text') ?? '');
