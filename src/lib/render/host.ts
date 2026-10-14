'use client';
// مدير مضيف الرسم بالمتصفح: iframe على /render-host.html (نفس صفحة السيرفر) + التقاط PNG + تصدير بكروم السيرفر.
import { useSettings } from '../store';
import { blobToDataURL } from '../photo/image';
import type { Output, RenderJob } from '../engines';
import { ENGINES } from '../engines';

type HostAPI = { render: (job: RenderJob) => Promise<{ W: number; H: number; qc: any }>; frame: () => HTMLIFrameElement | null };

export function attachHost(el: HTMLIFrameElement): Promise<HostAPI> {
  return new Promise((resolve, reject) => {
    const ready = () => {
      const w = el.contentWindow as any;
      if (w?.RENDER_HOST_READY) resolve(w.RenderHost as HostAPI);
      else setTimeout(ready, 50);
    };
    if (el.contentDocument?.readyState === 'complete' && (el.contentWindow as any)?.RENDER_HOST_READY) ready();
    else { el.addEventListener('load', ready, { once: true }); setTimeout(() => reject(new Error('render-host ما اشتغل')), 20000); }
  });
}

// مضيف خفي للتصدير والمصغّرات (منفصل عن المعاينة عشان ما تتلخبط)
let hidden: Promise<{ api: HostAPI; el: HTMLIFrameElement }> | null = null;
function hiddenHost() {
  if (hidden) return hidden;
  const el = document.createElement('iframe');
  el.src = '/render-host.html';
  el.setAttribute('aria-hidden', 'true');
  Object.assign(el.style, { position: 'fixed', left: '0', top: '0', width: '1080px', height: '1350px', opacity: '0', pointerEvents: 'none', zIndex: '-1', border: '0' });
  document.body.appendChild(el);
  hidden = attachHost(el).then(api => ({ api, el }));
  return hidden;
}

/** يلتقط إطار الرسم الحالي كصورة (modern-screenshot داخل نفس المتصفح) */
async function capture(host: HostAPI, outer: HTMLIFrameElement, W: number, H: number, scale: number, type: 'png' | 'jpeg' = 'png') {
  const frame = host.frame();
  const doc = frame?.contentDocument;
  if (!doc) throw new Error('ما فيه رسم');
  outer.style.width = W + 'px'; outer.style.height = H + 'px';
  const { domToBlob } = await import('modern-screenshot');
  const node = doc.documentElement;
  return domToBlob(node, {
    width: W, height: H, scale, type: type === 'jpeg' ? 'image/jpeg' : 'image/png', quality: 0.95,
    backgroundColor: null as unknown as string, font: {}, fetch: { requestInit: { cache: 'force-cache' } },
  });
}

/** يحوّل روابط blob: داخل المهمة لـ data: (عشان كروم السيرفر يقدر يقراها) */
async function inlineBlobs(job: RenderJob): Promise<RenderJob> {
  const urls = new Set<string>();
  JSON.stringify(job, (_k, v) => { if (typeof v === 'string' && v.startsWith('blob:')) urls.add(v); return v; });
  const map = new Map<string, string>();
  await Promise.all([...urls].map(async u => map.set(u, await blobToDataURL(await (await fetch(u)).blob()))));
  return JSON.parse(JSON.stringify(job, (_k, v) => (typeof v === 'string' && map.has(v) ? map.get(v) : v)));
}

let serverOk: boolean | null = null;
export function setServerRender(v: boolean) { serverOk = v; }

export async function renderToBlob(o: Output, opts: { scale?: number; type?: 'png' | 'jpeg' } = {}): Promise<{ blob: Blob; via: 'server' | 'browser'; qc?: any }> {
  const s = useSettings.getState().settings;
  const scale = opts.scale || s.exportScale || ENGINES[o.job.engine].scale;
  if (s.preferServer && serverOk) {
    try {
      const job = await inlineBlobs(o.job);
      const r = await fetch('/api/render', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(s.appPass ? { 'x-app-pass': s.appPass } : {}) },
        body: JSON.stringify({ job, scale, format: opts.type || 'png' }),
      });
      if (r.ok) return { blob: await r.blob(), via: 'server' };
      console.warn('server render failed', await r.text());
    } catch (e) { console.warn('server render failed', e); }
  }
  const { api, el } = await hiddenHost();
  const res = await api.render(o.job);
  return { blob: await capture(api, el, res.W, res.H, scale, opts.type), via: 'browser', qc: res.qc };
}

/** مصغّرة لكرت العنصر */
export async function thumbnail(o: Output): Promise<string> {
  const { api, el } = await hiddenHost();
  const res = await api.render(o.job);
  const b = await capture(api, el, res.W, res.H, 0.32, 'jpeg');
  return blobToDataURL(b);
}

export async function renderQC(o: Output) {
  const { api } = await hiddenHost();
  return (await api.render(o.job)).qc;
}
