// Sella index.html con el hash del contenido de cada archivo local que referencia (CSS, JS, imágenes).
//
// Por qué: Cloudflare le pone 4 horas de caché en el navegador a todo lo estático. Si una URL no cambia cuando
// cambia el archivo, quien ya visitó el sitio recibe el HTML nuevo con el CSS o el JS viejos y ve la página rota.
// Con `?v=<hash>` cada versión tiene su propia URL y no puede mezclarse con otra.
//
// Uso: `npm run build` (compila el CSS y sella el HTML). Un test falla si el HTML quedó sin sellar.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const defaultRead = (path) => readFileSync(new URL(path, root));

// La fuente no se versiona: se precarga y la pide el CSS, y las dos URLs tienen que ser idénticas
// (si no, el navegador la descarga dos veces). Si cambia, se renombra el archivo.
const UNVERSIONED = ['assets/fonts/'];
const LOCAL_URL = /(\b(?:href|src|poster)=")((?:assets|js)\/[^"?#]+)(?:\?v=[0-9a-f]+)?(")/g;

const hash = (...buffers) => {
  const digest = createHash('sha1');
  for (const buffer of buffers) digest.update(buffer);
  return digest.digest('hex').slice(0, 8);
};

const modules = () => readdirSync(new URL('js/', root)).filter((file) => file.endsWith('.js')).sort();

/** Versión de todo el grafo de módulos JS: si cambia cualquiera, cambia para todos. */
export function jsVersion(read = defaultRead) {
  return hash(...modules().map((file) => read(`js/${file}`)));
}

// El mapa de importación versiona los módulos que importa main.js (`./form.js`, etc.), que el navegador
// resolvería sin `?v=` y podría servir desde su caché en una versión vieja.
function importMap(version) {
  const imports = Object.fromEntries(
    modules().filter((file) => file !== 'main.js').map((file) => [`./js/${file}`, `./js/${file}?v=${version}`]),
  );
  return `<script type="importmap">${JSON.stringify({ imports })}</script>`;
}

export function stampHtml(html, read = defaultRead) {
  const version = jsVersion(read);

  const stamped = html.replace(LOCAL_URL, (match, before, path, after) => {
    if (UNVERSIONED.some((prefix) => path.startsWith(prefix))) return `${before}${path}${after}`;
    return `${before}${path}?v=${path.startsWith('js/') ? version : hash(read(path))}${after}`;
  });

  const map = importMap(version);
  return /<script type="importmap">/.test(stamped)
    ? stamped.replace(/<script type="importmap">[\s\S]*?<\/script>/, map)
    : stamped.replace(/^(\s*)(<script type="module")/m, `$1${map}\n$1$2`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const path = fileURLToPath(new URL('index.html', root));
  const before = readFileSync(path, 'utf8');
  const after = stampHtml(before);
  if (after === before) console.log('index.html ya estaba sellado');
  else {
    writeFileSync(path, after);
    console.log('index.html sellado');
  }
}
