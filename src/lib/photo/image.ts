'use client';
// تجهيز الصور بالمتصفح: تحميل/تصغير، قص الخلفية (BiRefNet)، info.json بنفس حقول المهارة، تدريج ألوان بوابة المستثمر، QR.

export async function decode(blob: Blob): Promise<ImageBitmap> {
  return createImageBitmap(blob, { imageOrientation: 'from-image' } as ImageBitmapOptions);
}

export function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export const toBlob = (c: HTMLCanvasElement, type = 'image/png', q?: number) =>
  new Promise<Blob>((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('toBlob'))), type, q));

export function fit(bmp: ImageBitmap | HTMLCanvasElement, max: number, type = 'image/jpeg', q = 0.82) {
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = canvas(Math.round(bmp.width * s), Math.round(bmp.height * s));
  const g = c.getContext('2d')!;
  g.imageSmoothingQuality = 'high';
  g.drawImage(bmp, 0, 0, c.width, c.height);
  return { c, url: c.toDataURL(type, q) };
}

/** صورة مرفوعة → نسخة عمل (≤3400px مثل المهارة) + مصغّرة */
export async function ingest(file: File) {
  const bmp = await decode(file);
  let blob: Blob = file;
  if (Math.max(bmp.width, bmp.height) > 3400) blob = await toBlob(fit(bmp, 3400).c, 'image/jpeg', 0.93);
  const b2 = blob === file ? bmp : await decode(blob);
  return { blob, w: b2.width, h: b2.height, thumb: fit(b2, 360, 'image/jpeg', 0.78).url };
}

/** صورة صغيرة للرؤية (توفير توكن: 448px JPEG) */
export async function visionThumb(blob: Blob, max = 448) {
  return fit(await decode(blob), max, 'image/jpeg', 0.7).url;
}

// ───── قص الخلفية بالـ worker ─────
let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, { res: (v: { w: number; h: number; mask: Uint8ClampedArray; device: string }) => void; rej: (e: Error) => void }>();
export const cutoutProgress = { pct: 0, device: '', listeners: new Set<(p: number, d: string) => void>() };

let wasmOnly = false;
function getWorker() {
  if (worker) return worker;
  worker = new Worker('/workers/cutout.js' + (wasmOnly ? '?device=wasm' : ''), { type: 'module' });
  worker.onmessage = e => {
    const d = e.data;
    if (d.type === 'progress') {
      cutoutProgress.pct = d.pct; cutoutProgress.device = d.device;
      cutoutProgress.listeners.forEach(l => l(d.pct, d.device));
    } else if (d.type === 'done') { pending.get(d.id)?.res(d); pending.delete(d.id); }
    else if (d.type === 'error') { pending.get(d.id)?.rej(new Error(d.message)); pending.delete(d.id); }
  };
  return worker;
}

function segmentOnce(blob: Blob) {
  const id = ++seq;
  return new Promise<{ w: number; h: number; mask: Uint8ClampedArray; device: string }>((res, rej) => {
    pending.set(id, { res, rej });
    getWorker().postMessage({ id, blob });
  });
}

export async function segment(blob: Blob) {
  try { return await segmentOnce(blob); }
  catch (e) {
    // WebGPU فشل بهالجهاز → worker جديد على WASM (أبطأ بس مضمون)
    if (wasmOnly || !/WEBGPU_FAIL|webgpu/i.test(String((e as Error).message))) throw e;
    wasmOnly = true; worker?.terminate(); worker = null;
    return segmentOnce(blob);
  }
}

/** يبقي أكبر جسم + أي جسم ≥ 25% منه (keep_main بالمهارة) — على نسخة مصغّرة للسرعة */
function keepMain(mask: Uint8ClampedArray, w: number, h: number) {
  const s = Math.min(1, 400 / Math.max(w, h));
  const sw = Math.max(1, Math.round(w * s)), sh = Math.max(1, Math.round(h * s));
  const small = new Uint8Array(sw * sh);
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++)
    small[y * sw + x] = mask[Math.min(h - 1, Math.floor(y / s)) * w + Math.min(w - 1, Math.floor(x / s))] > 40 ? 1 : 0;
  const lab = new Int32Array(sw * sh);
  const areas: number[] = [0];
  const stack: number[] = [];
  for (let i = 0; i < small.length; i++) {
    if (!small[i] || lab[i]) continue;
    const L = areas.length; let a = 0;
    stack.push(i); lab[i] = L;
    while (stack.length) {
      const p = stack.pop()!; a++;
      const x = p % sw, y = (p / sw) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= sw || ny >= sh) continue;
        const q = ny * sw + nx;
        if (small[q] && !lab[q]) { lab[q] = L; stack.push(q); }
      }
    }
    areas.push(a);
  }
  if (areas.length <= 2) return mask;
  const big = Math.max(...areas);
  const keep = areas.map(a => a >= big * 0.25);
  const out = new Uint8ClampedArray(mask.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const l = lab[Math.min(sh - 1, Math.floor(y * s)) * sw + Math.min(sw - 1, Math.floor(x * s))];
    // حواف ناعمة (قيم بين 0 و40) تتبع أقرب جسم محفوظ
    out[y * w + x] = (l === 0 || keep[l]) ? mask[y * w + x] : 0;
  }
  return out;
}

function bbox(alpha: Uint8ClampedArray, w: number, h: number, thr: number) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (alpha[y * w + x] > thr) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 };
}

/** صورة + قناع → PNG مقصوص (اختياري: بدون قص للحدود) */
async function applyMask(bmp: ImageBitmap, mask: Uint8ClampedArray, crop: boolean) {
  const W = bmp.width, H = bmp.height;
  const c = canvas(W, H); const g = c.getContext('2d')!;
  g.drawImage(bmp, 0, 0);
  const id = g.getImageData(0, 0, W, H);
  for (let i = 0; i < W * H; i++) id.data[i * 4 + 3] = mask[i];
  g.putImageData(id, 0, 0);
  const bb = bbox(mask, W, H, 20);
  if (!bb) throw new Error('ما لقيت أشخاص/عنصر واضح بالصورة');
  if (!crop) return { c, bb, W, H };
  const out = canvas(bb.x1 - bb.x0, bb.y1 - bb.y0);
  out.getContext('2d')!.drawImage(c, bb.x0, bb.y0, out.width, out.height, 0, 0, out.width, out.height);
  return { c: out, bb, W, H };
}

/** Güzel Eser: cut.png + info (نفس حقول scripts/prep_photo.py) */
export async function cutoutGuzeleser(blob: Blob) {
  const bmp = await decode(blob);
  const seg = await segment(blob);
  const mask = keepMain(seg.mask, seg.w, seg.h);
  const { c, bb, W, H } = await applyMask(bmp, mask, true);
  const cw = c.width, ch = c.height;
  const a = c.getContext('2d')!.getImageData(0, 0, cw, ch).data;
  const op = (x: number, y: number) => a[(y * cw + x) * 4 + 3] > 60;
  const prof: number[] = [];
  for (let col = 0; col < 48; col++) {
    const xa = Math.floor(col * cw / 48), xb = Math.max(Math.floor((col + 1) * cw / 48), xa + 1);
    let top = -1;
    for (let y = 0; y < ch && top < 0; y++) for (let x = xa; x < xb; x++) if (op(x, y)) { top = y; break; }
    prof.push(top < 0 ? 1 : +(top / ch).toFixed(4));
  }
  let sx = 0, n = 0;
  for (let y = 0; y < ch; y += 2) for (let x = 0; x < cw; x += 2) if (op(x, y)) { sx += x; n++; }
  const info = {
    w: W, h: H,
    cut: { x0: bb.x0 / W, y0: bb.y0 / H, x1: bb.x1 / W, y1: bb.y1 / H },
    cut_w: cw, cut_h: ch, top_profile: prof,
    cx: n ? +(sx / n / cw).toFixed(4) : 0.5,
    faces: [] as unknown[],
    touches_bottom: bb.y1 >= H - 4, touches_left: bb.x0 <= 3, touches_right: bb.x1 >= W - 3,
    engine: 'المتصفح: ' + seg.device,
  };
  // cut_check: فوق أخضر وكحلي (يكشف البقايا والهالات) — نفس فحص المهارة
  const t = fit(c, 420).c;
  const chk = canvas(t.width * 2 + 12, t.height); const g = chk.getContext('2d')!;
  g.fillStyle = '#fff'; g.fillRect(0, 0, chk.width, chk.height);
  g.fillStyle = 'rgb(60,200,90)'; g.fillRect(0, 0, t.width, t.height); g.drawImage(t, 0, 0);
  g.fillStyle = 'rgb(10,40,70)'; g.fillRect(t.width + 12, 0, t.width, t.height); g.drawImage(t, t.width + 12, 0);
  return { png: await toBlob(c), info, check: chk.toDataURL('image/jpeg', 0.8) };
}

// ───── تدريج ألوان بوابة المستثمر (port من prep_photo.py: grade + add_grain) ─────
const hex = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
function toneMap(l: number, stops: [number, string][]) {
  for (let i = 1; i < stops.length; i++) if (l <= stops[i][0]) {
    const [p0, c0] = stops[i - 1], [p1, c1] = stops[i];
    const t = (l - p0) / (p1 - p0 || 1), a = hex(c0), b = hex(c1);
    return [0, 1, 2].map(k => a[k] + (b[k] - a[k]) * t);
  }
  return hex(stops[stops.length - 1][1]);
}
const curve = (x: number, lift = 0, gain = 1, contrast = 1) => Math.min(1, Math.max(0, lift + ((x - 0.5) * contrast + 0.5) * (gain - lift)));

export function grade(id: ImageData, treat: string, grain = 0.06) {
  const d = id.data;
  const cream = hex('#FFF8EC');
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
    const L = r * 0.2126 + g * 0.7152 + b * 0.0722;
    let o: number[];
    if (treat === 'noir') {
      const t = toneMap(L, [[0, '#0E0B08'], [0.35, '#3A2E20'], [0.7, '#B79A6B'], [1, '#F6E6C4']]);
      o = [r, g, b].map((c, k) => curve(t[k] * 0.78 + (L * 0.25 + c * 0.75) * 0.22, 0.02, 0.97, 1.1));
    } else if (treat === 'gold') {
      const t = toneMap(L, [[0, '#2A1F12'], [0.5, '#B58E57'], [1, '#FBEBCB']]);
      o = [r, g, b].map((c, k) => curve(t[k] * 0.72 + c * 0.28, 0.04, 0.98, 1.05));
    } else if (treat === 'sepia') {
      const t = toneMap(L, [[0, '#2F2a1E'], [0.55, '#8F8160'], [1, '#EDE5CF']]);
      o = t.map(c => curve(c, 0.06, 0.95, 0.95));
    } else if (treat === 'mono') {
      o = [0, 1, 2].map(k => curve(L, 0.05, 0.96, 1.08) * cream[k]);
    } else if (treat === 'warm') {
      o = [r, g, b].map((c, k) => curve((L + (c - L) * 0.8) * [1.04, 1, 0.9][k], 0.03, 0.98, 1.03));
    } else if (treat === 'none') {
      o = [r, g, b];
    } else {
      o = [r, g, b].map(c => curve(c, 0.015, 0.99, 1.02));
    }
    if (grain > 0) {
      const lum = (o[0] + o[1] + o[2]) / 3;
      const n = ((rnd() + rnd() + rnd()) / 3 - 0.5) * 0.9 * grain * (1.2 - Math.abs(lum - 0.5) * 1.2);
      o = o.map(c => c + n);
    }
    d[i] = Math.round(Math.min(1, Math.max(0, o[0])) * 255);
    d[i + 1] = Math.round(Math.min(1, Math.max(0, o[1])) * 255);
    d[i + 2] = Math.round(Math.min(1, Math.max(0, o[2])) * 255);
  }
  return id;
}

/** بوابة المستثمر: _file + _aspect (+ قص اختياري) */
export async function prepInvestors(blob: Blob, o: { treat: string; grain?: number; cutout?: boolean; nocrop?: boolean; crop?: number[] }) {
  let bmp: ImageBitmap | HTMLCanvasElement = await decode(blob);
  if (o.crop?.length === 4) {
    const [x0, y0, x1, y1] = o.crop; const W = bmp.width, H = bmp.height;
    const c = canvas(Math.round((x1 - x0) * W), Math.round((y1 - y0) * H));
    c.getContext('2d')!.drawImage(bmp, x0 * W, y0 * H, c.width, c.height, 0, 0, c.width, c.height);
    bmp = c;
  }
  let c: HTMLCanvasElement;
  let model = '';
  if (o.cutout) {
    const src = bmp instanceof HTMLCanvasElement ? await toBlob(bmp) : blob;
    const seg = await segment(src);
    const b2 = await decode(src);
    const r = await applyMask(b2, keepMain(seg.mask, seg.w, seg.h), !o.nocrop);
    c = r.c; model = seg.device;
  } else {
    c = canvas(bmp.width, bmp.height);
    c.getContext('2d')!.drawImage(bmp, 0, 0);
  }
  const g = c.getContext('2d')!;
  const id = g.getImageData(0, 0, c.width, c.height);
  g.putImageData(grade(id, o.treat, o.grain ?? 0.06), 0, 0);
  const hasAlpha = !!o.cutout || blob.type === 'image/png' || blob.type === 'image/webp';
  const out = await toBlob(c, hasAlpha ? 'image/png' : 'image/jpeg', 0.92);
  return { blob: out, aspect: +(c.width / c.height).toFixed(4), w: c.width, h: c.height, model };
}

/** QR — أسلوب Güzel Eser (نقاط كحلية + زوايا بعنابي) أو مربعات عادية */
export async function makeQR(url: string, style: 'guzeleser' | 'plain' = 'plain', color = '#2B241A') {
  const QR = await import('qrcode');
  const link = /^https?:/.test(url) ? url : 'https://' + url;
  const q = QR.create(link, { errorCorrectionLevel: 'M' });
  const n = q.modules.size, S = 24, B = style === 'guzeleser' ? 1 : 1;
  const c = canvas((n + B * 2) * S, (n + B * 2) * S); const g = c.getContext('2d')!;
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  const at = (r: number, k: number) => q.modules.get(r, k);
  const finder = (r: number, k: number) => (r < 7 && k < 7) || (r < 7 && k >= n - 7) || (r >= n - 7 && k < 7);
  const NAV = style === 'guzeleser' ? '#0A355B' : color;
  g.fillStyle = NAV;
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) {
    if (!at(r, k)) continue;
    const x = (k + B) * S, y = (r + B) * S;
    if (style === 'guzeleser' && !finder(r, k)) { g.beginPath(); g.arc(x + S / 2, y + S / 2, S / 2 - 2, 0, Math.PI * 2); g.fill(); }
    else if (style !== 'guzeleser') g.fillRect(x, y, S, S);
  }
  if (style === 'guzeleser') {
    const rr = (x: number, y: number, w: number, rad: number, col: string) => {
      g.fillStyle = col; g.beginPath(); g.roundRect(x, y, w, w, rad); g.fill();
    };
    for (const [r, k] of [[0, 0], [0, n - 7], [n - 7, 0]]) {
      const x = (k + B) * S, y = (r + B) * S;
      rr(x, y, 7 * S, S * 1.6, NAV); rr(x + S, y + S, 5 * S, S * 1.1, '#fff'); rr(x + 2 * S, y + 2 * S, 3 * S, S * 0.8, '#8B1938');
    }
  }
  return c.toDataURL('image/png');
}

export const blobToDataURL = (b: Blob) => new Promise<string>((res, rej) => {
  const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(b);
});

export async function dataURLToBlob(u: string) { return (await fetch(u)).blob(); }
