import { JSDOM } from 'jsdom';

// Ids de los únicos elementos que pueden llevar el acento como color propio (regla 16).
export const ACCENT_ALLOWED_IDS = ['cta-hero', 'btn-enviar', 'btn-modal-whatsapp'];

const STATE_PREFIXES = ['hover:', 'focus:', 'focus-visible:', 'focus-within:', 'active:'];

const PROMISE_PATTERNS = [/\$/, /gratis/i, /garant[ií]a/i, /24\s?hs?\b/i, /\bd[ií]as?\b/i, /entrega/i];

const NON_VOSEO_PATTERNS = [/\bpuedes\b/i, /\btienes\b/i, /\bquieres\b/i, /\benv[ií]anos\b/i, /\bcont[aá]ctanos\b/i, /\bescr[ií]benos\b/i, /\bcotiza\b/i];

const FORBIDDEN_API_PATTERNS = [
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\bsendBeacon\b/,
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /\bdocument\.cookie\b/,
];

const parse = (html) => new JSDOM(html).window.document;

export function findExternalImages(html) {
  return [...parse(html).querySelectorAll('img[src]')]
    .map((img) => img.getAttribute('src'))
    .filter((src) => /^(https?:)?\/\//i.test(src));
}

export function findForbiddenApis(js) {
  return FORBIDDEN_API_PATTERNS.filter((pattern) => pattern.test(js)).map(String);
}

export function visibleText(html) {
  const document = parse(html);
  document.querySelectorAll('script, style').forEach((node) => node.remove());
  return document.body.textContent.replace(/\s+/g, ' ').trim();
}

export function findPromiseWords(text) {
  return PROMISE_PATTERNS.filter((pattern) => pattern.test(text)).map(String);
}

export function findNonVoseo(text) {
  return NON_VOSEO_PATTERNS.filter((pattern) => pattern.test(text)).map(String);
}

export function findAccentMisuse(html, allowedIds = ACCENT_ALLOWED_IDS) {
  const misused = [];
  for (const element of parse(html).querySelectorAll('[class]')) {
    const usesAccent = element.className
      .split(/\s+/)
      .some((token) => token.includes('accent') && !STATE_PREFIXES.some((prefix) => token.startsWith(prefix)));
    if (usesAccent && !allowedIds.includes(element.id)) misused.push(element.id || element.tagName.toLowerCase());
  }
  return misused;
}
