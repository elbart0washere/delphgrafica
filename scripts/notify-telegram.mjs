// Avisa por Telegram (al bot del segundo cerebro de Caro) cada cambio que se publica en main.
//
// Lo dispara el hook `scripts/hooks/pre-push`. Un pre-push corre ANTES de que el push termine, así que este
// script espera a que el remoto tenga el commit antes de avisar: si el push falla, nadie recibe un aviso falso.
// Nunca rompe ni demora un push: el hook lo lanza en segundo plano y toda falla queda en el log, sin secretos.
//
// Configuración (fuera del repo): TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID, por entorno o en
// ~/.config/delphgrafica/notify.env. `NOTIFY_DRY_RUN=1` imprime el mensaje en vez de enviarlo.
import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CONFIG_DIR = join(homedir(), '.config', 'delphgrafica');
const CONFIG_FILE = join(CONFIG_DIR, 'notify.env');
const LOG_FILE = join(CONFIG_DIR, 'notify.log');
const PUBLISHED_REF = 'refs/heads/main'; // lo único que se publica; las ramas de trabajo no avisan
const SITE = 'https://delphgrafica.com.ar';
const MAX_LISTED = 10;
const ZEROS = /^0+$/;

/** Líneas del stdin de pre-push (`<ref local> <sha local> <ref remoto> <sha remoto>`) que publican main. */
export function parsePushes(stdin) {
  return stdin
    .split('\n')
    .map((line) => line.trim().split(/\s+/))
    .filter(([, localSha, remoteRef]) => remoteRef === PUBLISHED_REF && localSha && !ZEROS.test(localSha))
    .map(([, localSha, , remoteSha]) => ({ localSha, remoteSha: ZEROS.test(remoteSha ?? '') ? null : remoteSha }));
}

/** Texto para quien no programa: un cambio por viñeta, sin jerga ni firmas. */
export function buildMessage(subjects) {
  const count = subjects.length;
  const listed = subjects.slice(0, MAX_LISTED).map((subject) => `• ${subject}`);
  const rest = count - MAX_LISTED;
  if (rest > 0) listed.push(`y ${rest} ${rest === 1 ? 'cambio' : 'cambios'} más`);
  const title = `Novedades en la web: ${count} ${count === 1 ? 'cambio' : 'cambios'}`;
  return [title, '', ...listed, '', `En unos minutos se ve en ${SITE}`].join('\n');
}

export function loadConfig(env, readConfigFile) {
  const fromFile = {};
  try {
    for (const line of readConfigFile().split('\n')) {
      const match = /^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (match && !line.trim().startsWith('#')) fromFile[match[1]] = match[2];
    }
  } catch {
    // sin archivo: queda lo que haya en el entorno
  }
  const token = env.TELEGRAM_BOT_TOKEN || fromFile.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID || fromFile.TELEGRAM_CHAT_ID;
  return token && chatId ? { token, chatId } : null;
}

// La URL de la API lleva el token: los errores se arman a mano para que nunca la incluyan (terminaría en el log).
export async function sendMessage({ token, chatId, text }, fetchFn = fetch) {
  let response;
  try {
    response = await fetchFn(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
  } catch {
    throw new Error('no se pudo contactar a Telegram');
  }
  if (!response.ok) {
    const detail = await response.json().then((body) => body.description, () => '');
    throw new Error(`Telegram respondió ${response.status}${detail ? `: ${detail}` : ''}`);
  }
}

export async function waitUntilPublished({ sha, lsRemote, sleep, attempts = 40 }) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      if (lsRemote() === sha) return true;
    } catch {
      // sin red todavía: cuenta como "aún no"
    }
    if (attempt < attempts - 1) await sleep();
  }
  return false;
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

function log(line) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  appendFileSync(LOG_FILE, `${new Date().toISOString()} ${line}\n`);
}

async function main() {
  const remote = process.argv[2] ?? 'origin';
  const stdin = readFileSync(0, 'utf8');
  const dryRun = process.env.NOTIFY_DRY_RUN === '1';
  const config = dryRun ? null : loadConfig(process.env, () => readFileSync(CONFIG_FILE, 'utf8'));

  for (const { localSha, remoteSha } of parsePushes(stdin)) {
    if (!dryRun && !config) {
      log(`sin configuración en ${CONFIG_FILE}: no se avisó ${localSha.slice(0, 7)}`);
      continue;
    }
    if (!dryRun) {
      const lsRemote = () => git('ls-remote', remote, PUBLISHED_REF).split(/\s/)[0];
      const sleep = () => new Promise((resolve) => setTimeout(resolve, 3000));
      if (!(await waitUntilPublished({ sha: localSha, lsRemote, sleep }))) {
        log(`el push de ${localSha.slice(0, 7)} no llegó al remoto: no se avisó`);
        continue;
      }
    }
    const range = remoteSha ? [`${remoteSha}..${localSha}`] : ['-1', localSha];
    const subjects = git('log', '--no-merges', '--reverse', '--format=%s', ...range).split('\n').filter(Boolean);
    if (subjects.length === 0) continue;
    const text = buildMessage(subjects);
    if (dryRun) {
      console.log(text);
      continue;
    }
    await sendMessage({ ...config, text });
    log(`avisado ${localSha.slice(0, 7)} (${subjects.length} cambios)`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    try {
      log(`error: ${error.message}`);
    } catch {
      // el log es lo último que puede fallar; el push ya no depende de esto
    }
  });
}
