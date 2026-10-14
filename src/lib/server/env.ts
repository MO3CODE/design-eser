import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

export const ROOT = process.cwd();

export function findChrome(): string | null {
  const c = [process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
  return c.find(p => p && fs.existsSync(p)) || null;
}

export function enginesIndex(): { engines: Record<string, { skill: string; skill_dir: string; version: string }>; synced_at: string } | null {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'engines', 'index.json'), 'utf8')); } catch { return null; }
}

/** يشغّل أمر ويرجع المخرجات (مع مهلة) */
export function run(cmd: string, args: string[], timeoutMs = 240_000): Promise<{ code: number; out: string; err: string }> {
  return new Promise(resolve => {
    const [bin, ...pre] = cmd.split(' ').filter(Boolean);
    const p = spawn(bin, [...pre, ...args], { windowsHide: true, env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' } });
    let out = '', err = '';
    const t = setTimeout(() => { p.kill(); err += '\nانتهت المهلة'; }, timeoutMs);
    p.stdout.on('data', d => (out += d)); p.stderr.on('data', d => (err += d));
    p.on('error', e => { clearTimeout(t); resolve({ code: -1, out, err: String(e) }); });
    p.on('close', code => { clearTimeout(t); resolve({ code: code ?? -1, out, err }); });
  });
}

export const PY = () => process.env.PYTHON_CMD || (process.platform === 'win32' ? 'py -3.11' : 'python3');

let pyOk: boolean | null = null;
export async function pythonOk() {
  if (pyOk !== null) return pyOk;
  const r = await run(PY(), ['-c', 'import PIL, numpy, rembg; print("ok")'], 20_000);
  pyOk = r.code === 0 && r.out.includes('ok');
  return pyOk;
}
