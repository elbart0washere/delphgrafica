import { describe, it, expect, vi } from 'vitest';
import { buildMessage, loadConfig, parsePushes, sendMessage, waitUntilPublished } from '../../scripts/notify-telegram.mjs';

const ZERO = '0'.repeat(40);
const A = 'a'.repeat(40);
const B = 'b'.repeat(40);

describe('parsePushes: qué le interesa a quien recibe el aviso', () => {
  it('toma solo lo que se publica (main) y trae el rango de commits', () => {
    const stdin = `refs/heads/main-2 ${B} refs/heads/main ${A}\nrefs/heads/otra ${B} refs/heads/otra ${A}\n`;
    expect(parsePushes(stdin)).toEqual([{ localSha: B, remoteSha: A }]);
  });

  it('ignora el borrado de main', () => {
    expect(parsePushes(`(delete) ${ZERO} refs/heads/main ${A}\n`)).toEqual([]);
  });

  it('un main nuevo en el remoto (sha remoto en ceros) se informa con remoteSha null', () => {
    expect(parsePushes(`refs/heads/main ${B} refs/heads/main ${ZERO}\n`)).toEqual([{ localSha: B, remoteSha: null }]);
  });

  it('tolera líneas vacías', () => {
    expect(parsePushes('\n\n')).toEqual([]);
  });
});

describe('buildMessage: texto para una persona que no programa', () => {
  it('lista cada cambio en una viñeta, con el sitio al final', () => {
    const text = buildMessage(['Agrega sitemap', 'Quita el aviso de obra']);
    expect(text).toContain('• Agrega sitemap');
    expect(text).toContain('• Quita el aviso de obra');
    expect(text).toContain('https://delphgrafica.com.ar');
  });

  it('usa singular o plural según la cantidad', () => {
    expect(buildMessage(['Uno'])).toMatch(/1 cambio\b/);
    expect(buildMessage(['Uno', 'Dos'])).toMatch(/2 cambios\b/);
  });

  it('corta en 10 y dice cuántos quedaron afuera', () => {
    const subjects = Array.from({ length: 13 }, (_, i) => `Cambio ${i + 1}`);
    const text = buildMessage(subjects);
    expect(text).toContain('• Cambio 10');
    expect(text).not.toContain('• Cambio 11');
    expect(text).toContain('y 3 cambios más');
  });

  it('no menciona herramientas ni autoría de IA', () => {
    expect(buildMessage(['Agrega sitemap'])).not.toMatch(/claude|co-authored|anthropic/i);
  });
});

describe('loadConfig', () => {
  it('prefiere las variables de entorno', () => {
    expect(loadConfig({ TELEGRAM_BOT_TOKEN: 't', TELEGRAM_CHAT_ID: '1' }, () => '')).toEqual({ token: 't', chatId: '1' });
  });

  it('si faltan, las lee del archivo de configuración (KEY=VALUE, con comentarios)', () => {
    const file = '# bot de Caro\nTELEGRAM_BOT_TOKEN=abc:def\nTELEGRAM_CHAT_ID=42\n';
    expect(loadConfig({}, () => file)).toEqual({ token: 'abc:def', chatId: '42' });
  });

  it('devuelve null si falta cualquiera de los dos (el aviso se saltea, no rompe el push)', () => {
    expect(loadConfig({}, () => 'TELEGRAM_CHAT_ID=42\n')).toBeNull();
    expect(loadConfig({}, () => { throw new Error('ENOENT'); })).toBeNull();
  });
});

describe('sendMessage', () => {
  it('envía texto plano al chat indicado', async () => {
    const fetchFn = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) }));
    await sendMessage({ token: 'T', chatId: '42', text: 'hola' }, fetchFn);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://api.telegram.org/botT/sendMessage');
    expect(JSON.parse(init.body)).toEqual({ chat_id: '42', text: 'hola', disable_web_page_preview: true });
  });

  // La URL de la API lleva el token: si el error la incluyera, el token terminaría en el archivo de log.
  it('si falla, el error nunca contiene el token', async () => {
    const fetchFn = vi.fn(async () => ({ ok: false, status: 403, json: async () => ({ description: 'Forbidden: bot was blocked' }) }));
    const error = await sendMessage({ token: 'SECRETO', chatId: '42', text: 'x' }, fetchFn).catch((e) => e);
    expect(error.message).toContain('403');
    expect(error.message).not.toContain('SECRETO');
  });

  it('un fallo de red tampoco filtra el token', async () => {
    const fetchFn = vi.fn(async () => { throw new Error('fetch failed https://api.telegram.org/botSECRETO/sendMessage'); });
    const error = await sendMessage({ token: 'SECRETO', chatId: '42', text: 'x' }, fetchFn).catch((e) => e);
    expect(error.message).not.toContain('SECRETO');
  });
});

describe('waitUntilPublished: el hook corre ANTES de que el push termine', () => {
  const sleep = vi.fn(async () => {});

  it('avisa cuando el remoto ya tiene el commit', async () => {
    const lsRemote = vi.fn().mockReturnValueOnce(A).mockReturnValueOnce(B);
    expect(await waitUntilPublished({ sha: B, lsRemote, sleep, attempts: 5 })).toBe(true);
    expect(lsRemote).toHaveBeenCalledTimes(2);
  });

  it('si el push falló y el remoto nunca lo tiene, no avisa', async () => {
    const lsRemote = vi.fn(() => A);
    expect(await waitUntilPublished({ sha: B, lsRemote, sleep, attempts: 3 })).toBe(false);
    expect(lsRemote).toHaveBeenCalledTimes(3);
  });

  it('un error de red al consultar cuenta como "todavía no"', async () => {
    const lsRemote = vi.fn().mockImplementationOnce(() => { throw new Error('network'); }).mockReturnValueOnce(B);
    expect(await waitUntilPublished({ sha: B, lsRemote, sleep, attempts: 3 })).toBe(true);
  });
});
