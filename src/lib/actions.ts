'use client';
// أوامر الاستوديو — كل اللي تسويه الأزرار يمر من هنا.
import { useProject } from './project';
import { blobs, uid, useSettings } from './store';
import { parsePlanFile, extractWithAI } from './plan/parse';
import { ingest, visionThumb } from './photo/image';
import { prepare, type Output } from './engines';
import { designItem, editItem, critiqueItem, describePhotos, mergePatch } from './pipeline';
import { renderToBlob, thumbnail, renderQC } from './render/host';
import type { PlanItem, Photo } from './types';

export type Toast = (msg: string, kind?: 'ok' | 'err' | 'info') => void;
let toast: Toast = () => {};
export const setToaster = (t: Toast) => { toast = t; };

const S = () => useProject.getState();
const proj = () => S().project!;
const item = (id: string) => proj().items.find(i => i.id === id)!;

export async function importPlan(input: File | string, mode: 'replace' | 'append' = 'append') {
  const p = proj();
  const items: PlanItem[] = typeof input === 'string'
    ? await extractWithAI(input, s => toast(s, 'info'))
    : await parsePlanFile(input, p.engine, s => toast(s, 'info'));
  if (!items.length) { toast('ما لقيت منشورات بالخطة — تأكد من الأعمدة (العنوان/المحتوى) أو الصق النص', 'err'); return; }
  const base = mode === 'append' ? p.items : [];
  const merged = [...base, ...items.map((it, i) => ({ ...it, n: base.length + i + 1 }))];
  S().patch({ items: merged, source: typeof input === 'string' ? 'نص ملصوق' : input.name });
  S().select(items[0].id);
  toast(`انقرأت الخطة: ${items.length} منشور${typeof input !== 'string' && /\.(xlsx|xls|csv)$/i.test(input.name) ? ' (بدون AI — صفر توكن)' : ''}`, 'ok');
}

export function addManualItem() {
  const p = proj();
  const it: PlanItem = { id: uid(), n: p.items.length + 1, title: 'منشور جديد', content: '', kind: 'post', photoIds: [], status: 'idle', history: [] };
  S().patch({ items: [...p.items, it] });
  S().select(it.id);
}

export function removeItem(id: string) {
  S().patch({ items: proj().items.filter(i => i.id !== id).map((it, i) => ({ ...it, n: i + 1 })) });
  if (S().selected === id) S().select(proj().items[0]?.id ?? null);
}

export async function addPhotos(files: File[], assignTo?: string) {
  const added: Photo[] = [];
  for (const f of files) {
    if (!f.type.startsWith('image/')) continue;
    try {
      const r = await ingest(f);
      const key = uid(); await blobs.put(key, r.blob);
      added.push({ id: uid(), name: f.name, key, w: r.w, h: r.h, thumb: r.thumb });
    } catch (e) { toast(`ما قدرت أقرأ ${f.name}`, 'err'); }
  }
  if (!added.length) return;
  S().patch({ photos: [...proj().photos, ...added] });
  if (assignTo) S().updateItem(assignTo, it => ({ photoIds: [...it.photoIds, ...added.map(a => a.id)] }));
  toast(`أضفت ${added.length} صورة`, 'ok');
}

export function removePhoto(id: string) {
  const p = proj();
  const ph = p.photos.find(x => x.id === id);
  if (ph) { blobs.del(ph.key); if (ph.cut) blobs.del(ph.cut.key); }
  S().patch({ photos: p.photos.filter(x => x.id !== id), items: p.items.map(it => ({ ...it, photoIds: it.photoIds.filter(x => x !== id) })) });
}

export async function analyzePhotos() {
  const p = proj();
  const todo = p.photos.filter(x => !x.desc);
  if (!todo.length) { toast('كل الصور محلّلة', 'info'); return; }
  try {
    await describePhotos(todo, (id, desc) => {
      const ph = proj().photos.find(x => x.id === id); if (ph) S().updatePhoto({ ...ph, desc });
    }, s => toast(s, 'info'));
    toast('تم تحليل الصور — الأوصاف محفوظة وتُستخدم كنص (توفير توكن)', 'ok');
  } catch (e) { toast(String((e as Error).message), 'err'); }
}

/** يجهّز مخرجات العنصر (قص/تدريج/QR) */
export async function outputsOf(id: string): Promise<Output[]> {
  const it = item(id);
  if (!it?.spec) return [];
  const before = S().busy[id] || null;   // نرجّع حالة العمل زي ما كانت (المعاينة ما تملك الحالة)
  let touched = false;
  try {
    return await prepare(proj().engine, it, {
      project: proj(),
      onPhoto: ph => S().updatePhoto(ph),
      onStage: s => { touched = true; S().setBusy(id, s); },
    });
  } finally {
    if (touched) S().setBusy(id, before);
  }
}

/** بعد أي تغيير بالـspec: مصغّرة + فحص المحرك */
export async function refresh(id: string) {
  try {
    S().setBusy(id, 'رسم المعاينة…');
    const outs = await outputsOf(id);
    if (!outs.length) return;
    const qc: Record<string, unknown> = {};
    for (const o of outs.slice(0, 6)) qc[o.key] = await renderQC(o);
    const thumb = await thumbnail(outs[0]);
    S().updateItem(id, { thumb, qc, status: 'ready', error: undefined });
  } catch (e) {
    S().updateItem(id, { status: 'error', error: String((e as Error).message) });
  } finally { S().setBusy(id, null); }
}

export async function designOne(id: string, extra = '') {
  const it = item(id);
  S().updateItem(id, { status: 'designing', error: undefined });
  S().setBusy(id, 'الذكاء يبني التصميم…');
  try {
    // صور العنصر بدون وصف؟ نحللها أول (مرة وحدة لكل صورة)
    const pool = it.photoIds.length ? it.photoIds : proj().photos.map(p => p.id);
    const undesc = proj().photos.filter(p => pool.includes(p.id) && !p.desc);
    if (undesc.length && pool.length > 1) {
      S().setBusy(id, 'تحليل الصور…');
      await describePhotos(undesc, (pid, desc) => { const ph = proj().photos.find(x => x.id === pid); if (ph) S().updatePhoto({ ...ph, desc }); });
    }
    S().setBusy(id, 'الذكاء يبني التصميم…');
    const r = await designItem(proj().engine, item(id), proj(), extra);
    S().updateItem(id, cur => ({
      spec: r.spec, model: r.model, aiNotes: r.notes,
      history: cur.spec ? [...cur.history, cur.spec].slice(-15) : cur.history,
    } as Partial<PlanItem>));
    if (r.notes) toast(`#${it.n}: ${r.notes}`, 'info');
    await refresh(id);
  } catch (e) {
    S().updateItem(id, { status: 'error', error: String((e as Error).message) });
    toast(`#${it.n}: ${(e as Error).message}`, 'err');
  } finally { S().setBusy(id, null); }
}

export async function designMany(ids: string[]) {
  const n = Math.max(1, useSettings.getState().settings.concurrency);
  ids.forEach(id => S().updateItem(id, { status: 'queued' }));
  const queue = [...ids];
  await Promise.all(Array.from({ length: n }, async () => {
    while (queue.length) { const id = queue.shift()!; await designOne(id); }
  }));
  toast(`خلص تصميم ${ids.length} منشور`, 'ok');
}

export async function setSpec(id: string, spec: Record<string, unknown>, keepHistory = true) {
  S().updateItem(id, cur => ({ spec, history: keepHistory && cur.spec ? [...cur.history, cur.spec].slice(-15) : cur.history }));
  await refresh(id);
}

export async function undo(id: string) {
  const it = item(id);
  if (!it.history.length) return;
  const prev = it.history[it.history.length - 1];
  S().updateItem(id, { spec: prev, history: it.history.slice(0, -1) });
  await refresh(id);
}

export async function aiEdit(id: string, instruction: string) {
  S().setBusy(id, 'تنفيذ التعديل…');
  try {
    const r = await editItem(proj().engine, item(id), instruction);
    await setSpec(id, r.spec);
    toast(r.notes || 'تم التعديل', 'ok');
  } catch (e) { toast(String((e as Error).message), 'err'); }
  finally { S().setBusy(id, null); }
}

export async function aiCritique(id: string, apply = false) {
  S().setBusy(id, 'نقد بعين مصمم…');
  try {
    const outs = await outputsOf(id);
    const o = outs[0];
    const { blob, qc } = await renderToBlob(o, { scale: 0.6, type: 'jpeg' });
    const img = await visionThumb(blob, 720);
    const r = await critiqueItem(proj().engine, item(id), img, qc ?? item(id).qc);
    if (apply && r.patch && Object.keys(r.patch).length) await setSpec(id, mergePatch(item(id).spec, r.patch));
    return r;
  } catch (e) { toast(String((e as Error).message), 'err'); return null; }
  finally { S().setBusy(id, null); }
}

const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_').slice(0, 50);

export async function exportItems(ids: string[], onProgress?: (s: string) => void) {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  let via = '';
  for (const id of ids) {
    const it = item(id);
    if (!it.spec) continue;
    const outs = await outputsOf(id);
    const dir = zip.folder(`${String(it.n).padStart(2, '0')}_${safe(it.title)}`)!;
    for (const o of outs) {
      onProgress?.(`تصدير #${it.n} — ${o.label}`);
      const r = await renderToBlob(o);
      via = r.via;
      dir.file(`${o.key}.png`, r.blob);
    }
    dir.file('spec.json', JSON.stringify(it.spec, null, 1));
    const cap = (it.spec as any).caption || it.caption;
    if (cap) dir.file('caption.txt', cap + ((it.spec as any).hashtags ? '\n\n' + (it.spec as any).hashtags.join(' ') : ''));
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  download(blob, `${safe(proj().name)}.zip`);
  toast(`تم التصدير ${via === 'server' ? '(كروم السيرفر — نفس دقة المهارة)' : '(من المتصفح)'}`, 'ok');
}

export async function exportOne(o: Output, name: string) {
  const r = await renderToBlob(o);
  download(r.blob, `${safe(name)}_${o.key}.png`);
  toast(r.via === 'server' ? 'PNG بدقة المهارة (كروم السيرفر)' : 'PNG من المتصفح', 'ok');
}

export function download(b: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
