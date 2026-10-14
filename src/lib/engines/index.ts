'use client';
// طبقة المحركات: تبني طلب الـAI لكل عنصر، وتحوّل الـspec الناتج لمهام رسم (نفس مدخلات render.js بالمهارة).
import { blobUrl, blobs, uid, useSettings } from '../store';
import { cutoutGuzeleser, makeQR, prepInvestors } from '../photo/image';
import type { Complexity } from '../ai/router';
import type { EngineId, Photo, PlanItem, Project } from '../types';
import { GUZELESER_DOC, INVESTORS_DOC, OUTPUT_CONTRACT } from './docs';

export interface RenderJob {
  engine: EngineId;
  size?: string;
  index?: number;
  spec: Record<string, any>;
  photo?: Record<string, any> | null;
  qr?: string | null;
}
export interface Output { key: string; label: string; job: RenderJob; W: number; H: number }

export interface EngineMeta {
  id: EngineId;
  name: string;
  sub: string;
  lang: 'tr' | 'ar';
  accent: string;
  accent2: string;
  logo: string;            // معاينة الشعار (من الأصول المسحوبة)
  scale: 2 | 3;            // دقة التصدير الافتراضية بالمهارة
  kinds: string[];
}

export const ENGINES: Record<EngineId, EngineMeta> = {
  guzeleser: {
    id: 'guzeleser', name: 'Güzel Eser', sub: 'منشورات الجمعية — بوست 4:5 + ستوري 9:16 (تركي)', lang: 'tr',
    accent: '#0A355B', accent2: '#8B1938', logo: '/engines/guzeleser/assets/logo/logo_color_h.png', scale: 2,
    kinds: ['post', 'story'],
  },
  'investors-gate': {
    id: 'investors-gate', name: 'بوابة المستثمر', sub: 'منشور مفرد · كاروسيل · ستوري أخبار · غلاف ريل (عربي)', lang: 'ar',
    accent: '#A29265', accent2: '#26272A', logo: '/engines/investors-gate/assets/logo/stacked_color.svg', scale: 3,
    kinds: ['post', 'carousel', 'story', 'reel_cover', 'poster'],
  },
};

export const SIZES: Record<string, [number, number]> = {
  post: [1080, 1350], story: [1080, 1920], tall: [1080, 1920], square: [1080, 1080], wide: [1920, 1080],
};

// ───── قائمة الصور للموديل (معرّفات قصيرة + وصف نصي محفوظ — بدل إرسال الصور كل مرة) ─────
export function photoAliases(project: Project, item: PlanItem) {
  const pool = item.photoIds.length ? item.photoIds : project.photos.map(p => p.id);
  const list = pool.map((id, i) => ({ alias: 'P' + (i + 1), photo: project.photos.find(p => p.id === id)! })).filter(x => x.photo);
  const text = list.length
    ? list.map(({ alias, photo: p }) => {
      const d = p.desc;
      const o = p.w > p.h * 1.15 ? 'أفقية' : p.h > p.w * 1.15 ? 'طولية' : 'مربعة';
      return `- ${alias}: ${d ? `${d.summary} · أشخاص: ${d.people} · ${d.cutout_ok ? 'تصلح للقص' : 'الأفضل كاملة'}${d.issues?.length ? ' · ⚠ ' + d.issues.join('، ') : ''}` : p.name} (${o} ${p.w}×${p.h})`;
    }).join('\n')
    : '(لا توجد صور — صمّم بدون صورة أو اذكر بالملاحظات أي صورة مطلوبة)';
  return { list, text };
}

async function fetchJSON<T>(u: string): Promise<T | null> {
  try { const r = await fetch(u); return r.ok ? await r.json() : null; } catch { return null; }
}
async function fetchText(u: string) {
  try { const r = await fetch(u); return r.ok ? await r.text() : ''; } catch { return ''; }
}
const stripPaths = (o: any): any => JSON.parse(JSON.stringify(o, (k, v) =>
  (['src', 'dir', 'out_dir', 'name', 'caption', 'hashtags'].includes(k) ? undefined : v)));

// ───── بناء طلب الـspec ─────
export async function buildSpecPrompt(engine: EngineId, item: PlanItem, project: Project, extra = '') {
  const { budget } = useSettings.getState().settings;
  const { text: photos } = photoAliases(project, item);
  const slidesGuess = engine === 'investors-gate' && item.kind === 'carousel'
    ? Math.max(2, (item.content.match(/(?:شريحة|سلايد|slide)\s*[0-9٠-٩]*/gi) || []).length || 5) : 1;
  const complexity: Complexity = { slides: slidesGuess, chars: item.content.length + (item.caption?.length || 0) };

  let system = '';
  if (engine === 'guzeleser') {
    system = `${GUZELESER_DOC}\n\n${OUTPUT_CONTRACT}`;
  } else {
    const brand = await fetchJSON<any>('/engines/investors-gate/brand.json');
    const facts = brand ? `\n\n## الهوية (brand.json)\nالأرقام المسموحة: ${JSON.stringify(brand.stats)}\nالهاشتاقات: ${JSON.stringify(brand.hashtags)}` : '';
    // مثال معتمد واحد مطابق للنوع (بدون مسارات) — يُثبّت الأسلوب. يُحذف بالوضع الاقتصادي.
    let example = '';
    if (budget !== 'eco') {
      const ex = await fetchJSON<any>(`/engines/investors-gate/examples/${item.kind === 'carousel' ? 'approved_carousel_clean' : item.kind === 'story' ? 'approved_news_story' : 'approved_concept_single'}.json`);
      if (ex) example = `\n\n## مثال معتمد من العميل (للأسلوب فقط — لا تنسخ نصه)\n${JSON.stringify(stripPaths(ex)).slice(0, 5000)}`;
    }
    // وضع الجودة: سجل الذوق الحي من المهارة (المعتمد والمرفوض)
    let taste = '';
    if (budget === 'quality') {
      const t = await fetchText('/engines/investors-gate/references/taste-log.md');
      if (t) taste = `\n\n## سجل ذوق العميل (حي من المهارة)\n${t.slice(0, 9000)}`;
    }
    system = `${INVESTORS_DOC}${facts}${example}${taste}\n\n${OUTPUT_CONTRACT}`;
  }

  const user = [
    `## العنصر #${item.n} — النوع المطلوب: ${item.kind}${item.platform ? ` · المنصة: ${item.platform}` : ''}${item.date ? ` · التاريخ: ${item.date}` : ''}`,
    `### العنوان\n${item.title}`,
    `### المحتوى للتصميم (حرفي)\n${item.content}`,
    item.caption ? `### الكابشن\n${item.caption}` : '',
    item.price ? `### السعر\n${item.price}` : '',
    item.notes ? `### ملاحظات المصمم (التزم بها)\n${item.notes}` : '',
    project.brief ? `### توجيه عام للمشروع\n${project.brief}` : '',
    `### الصور المتاحة\n${photos}`,
    extra ? `### طلب إضافي\n${extra}` : '',
  ].filter(Boolean).join('\n\n');
  return { system, user, complexity };
}

export function validateSpec(engine: EngineId, data: unknown): string | null {
  const s = (data as any)?.spec;
  if (!s || typeof s !== 'object') return 'ناقص spec';
  if (engine === 'guzeleser') {
    if (!Array.isArray(s.title) || !s.title.length) return 'title لازم مصفوفة أسطر';
    if (s.theme && !['light', 'clean', 'navy'].includes(s.theme)) return 'theme غير معروف';
    const second = ['price', 'prices', 'features', 'stats', 'date'].filter(k => s[k]);
    if (second.length > 1) return `أكثر من عنصر ثاني (${second.join('+')}) — واحد فقط`;
  } else {
    if (!Array.isArray(s.slides) || !s.slides.length) return 'slides لازم مصفوفة';
    if (s.slides.some((x: any) => x.footbar)) return 'footbar مرفوض';
  }
  return null;
}

/** P1 → معرّف الصورة الحقيقي */
export function resolveAliases(spec: any, project: Project, item: PlanItem) {
  const { list } = photoAliases(project, item);
  const map = Object.fromEntries(list.map(x => [x.alias, x.photo.id]));
  const fix = (ph: any) => {
    if (!ph || typeof ph !== 'object') return;
    for (const k of ['ref', 'src']) if (typeof ph[k] === 'string' && map[ph[k].toUpperCase()]) { ph.photoId = map[ph[k].toUpperCase()]; delete ph[k]; }
  };
  fix(spec.photo);
  for (const sl of spec.slides || []) {
    fix(sl.photo); fix(sl.bg_photo); fix(sl.hero?.photo);
    for (const sec of sl.sections || []) fix(sec.photo);
  }
  return spec;
}

// ───── تجهيز الصور (كاش بالذاكرة + IndexedDB) ─────
const memo = new Map<string, Promise<any>>();
let localPrep: boolean | null = null;
export function setLocalPrep(v: boolean) { localPrep = v; }

async function localSkillPrep(engine: EngineId, photo: Photo, opts: Record<string, unknown>) {
  const b = await blobs.get(photo.key);
  if (!b) throw new Error('الصورة مفقودة');
  const fd = new FormData();
  fd.append('engine', engine); fd.append('opts', JSON.stringify(opts)); fd.append('file', b, photo.name);
  const s = useSettings.getState().settings;
  const r = await fetch('/api/prep', { method: 'POST', body: fd, headers: s.appPass ? { 'x-app-pass': s.appPass } : {} });
  if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || 'فشل القص المحلي');
  return r.json();
}

/** Güzel Eser: قص الأشخاص (المهارة محلياً: فوتوشوب+BiRefNet · وإلا BiRefNet بالمتصفح) */
export async function ensureCut(photo: Photo, onUpdate: (p: Photo) => void): Promise<Photo> {
  if (photo.cut) return photo;
  const k = 'cut:' + photo.id;
  if (!memo.has(k)) memo.set(k, (async () => {
    let next: Photo;
    if (localPrep) {
      try {
        const r = await localSkillPrep('guzeleser', photo, {});
        const png = await (await fetch(r.cut)).blob();
        const key = uid(); await blobs.put(key, png);
        next = { ...photo, cut: { key, info: r.info, engine: 'local-skill: ' + (r.info?.engine || 'prep_photo.py'), check: r.check } };
        onUpdate(next); return next;
      } catch (e) { console.warn('local prep failed, browser fallback', e); }
    }
    const b = await blobs.get(photo.key);
    if (!b) throw new Error('الصورة مفقودة');
    const r = await cutoutGuzeleser(b);
    const key = uid(); await blobs.put(key, r.png);
    next = { ...photo, cut: { key, info: r.info, engine: String(r.info.engine), check: r.check } };
    onUpdate(next); return next;
  })());
  try { return await memo.get(k); } catch (e) { memo.delete(k); throw e; }
}

async function investorsFile(photo: Photo, o: { treat: string; grain: number; cutout: boolean; nocrop?: boolean; crop?: number[] }) {
  const k = `ig:${photo.id}:${o.treat}:${o.grain}:${o.cutout}:${o.nocrop}:${o.crop?.join(',')}`;
  if (!memo.has(k)) memo.set(k, (async () => {
    const cached = await blobs.get(k);
    if (cached) { const bmp = await createImageBitmap(cached); return { url: URL.createObjectURL(cached), aspect: +(bmp.width / bmp.height).toFixed(4) }; }
    let out: Blob, aspect: number;
    if (localPrep) {
      try {
        const r = await localSkillPrep('investors-gate', photo, o);
        out = await (await fetch(r.file)).blob(); aspect = r.info.aspect;
        await blobs.put(k, out);
        return { url: URL.createObjectURL(out), aspect };
      } catch (e) { console.warn('local prep failed, browser fallback', e); }
    }
    const b = await blobs.get(photo.key);
    if (!b) throw new Error('الصورة مفقودة');
    const r = await prepInvestors(b, o);
    out = r.blob; aspect = r.aspect;
    await blobs.put(k, out);
    return { url: URL.createObjectURL(out), aspect };
  })());
  try { return await memo.get(k); } catch (e) { memo.delete(k); throw e; }
}

// ───── investors-gate: دمج preset (نفس build.py → deep_merge) ─────
function deepMerge(base: any, over: any): any {
  if (!base || typeof base !== 'object' || Array.isArray(base) || !over || typeof over !== 'object' || Array.isArray(over))
    return over !== undefined && over !== null ? over : base;
  const out = { ...base };
  for (const [k, v] of Object.entries(over))
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) ? deepMerge(base[k], v) : v;
  return out;
}

let presetsP: Promise<any> | null = null;
export async function applyPreset(spec: any) {
  let s = JSON.parse(JSON.stringify(spec));
  if (s.preset) {
    presetsP ||= fetchJSON('/engines/investors-gate/presets.json');
    const P = (await presetsP)?.[s.preset];
    if (P) {
      s = deepMerge(P.spec || {}, s);
      const sd = P.slide_defaults || {};
      s.slides = (s.slides || []).map((sl: any) => deepMerge(deepMerge(sd['*'] || {}, sd[sl.type] || {}), sl));
    }
  }
  if (s.topline) for (const sl of s.slides || []) if (!sl.topline) sl.topline = s.topline;
  return s;
}

export interface PrepCtx {
  project: Project;
  onPhoto: (p: Photo) => void;    // تحديث صورة بعد القص (يحفظ بالمشروع)
  onStage?: (s: string) => void;
}

/** spec → مهام الرسم (كل مقاس/شريحة) */
export async function prepare(engine: EngineId, item: PlanItem, ctx: PrepCtx): Promise<Output[]> {
  const spec = JSON.parse(JSON.stringify(item.spec || {}));
  const photoOf = (id?: string) => ctx.project.photos.find(p => p.id === id);

  if (engine === 'guzeleser') {
    let photo: Record<string, any> | null = null;
    const ph = spec.photo;
    if (ph && typeof ph === 'object') {
      const p = photoOf(ph.photoId);
      if (p) {
        const mode = ph.mode || 'cutout';
        const rest = { ...ph }; delete rest.photoId;
        if (mode === 'cutout') {
          ctx.onStage?.('قص الأشخاص من الصورة…');
          const withCut = await ensureCut(p, ctx.onPhoto);
          photo = { ...rest, mode, full: await blobUrl(withCut.key), cut: await blobUrl(withCut.cut!.key), info: withCut.cut!.info };
        } else {
          photo = { ...rest, mode, full: await blobUrl(p.key), info: { w: p.w, h: p.h } };
        }
      }
    }
    delete spec.photo;
    let qr: string | null = null;
    if (spec.qr) {
      const brand = await fetchJSON<any>('/engines/guzeleser/brand.json');
      qr = await makeQR(spec.cta?.url || brand?.donate_url || 'guzeleser.org/bagis', 'guzeleser');
    }
    const sizes: string[] = spec.sizes || ['post', 'story'];
    return sizes.map(size => ({
      key: size, label: size === 'post' ? 'بوست 4:5' : size === 'story' ? 'ستوري 9:16' : size,
      W: SIZES[size][0], H: SIZES[size][1],
      job: { engine, size, spec, photo, qr },
    }));
  }

  // investors-gate
  const s = await applyPreset(spec);
  const fmt = s.format || (item.kind === 'story' || item.kind === 'reel_cover' ? 'story' : 'post');
  s.format = fmt;
  const slides = s.slides || [];
  const defTreat = (theme: string) => ['noir', 'graphite'].includes(theme) ? 'noir' : theme === 'sepia' ? 'sepia'
    : theme.startsWith('svc_') || theme === 'ivory' ? 'natural' : 'warm';
  const prepPhoto = async (ph: any, dt: string) => {
    if (!ph || !ph.photoId) { if (ph) for (const k of Object.keys(ph)) delete ph[k]; return; }
    const p = photoOf(ph.photoId);
    if (!p) { for (const k of Object.keys(ph)) delete ph[k]; return; }
    const isAlpha = /\.(png|webp)$/i.test(p.name);
    const cut = (ph.cutout ?? ph.area === 'cutout') && !isAlpha || ph.cutout === true;
    ctx.onStage?.(cut ? 'قص الأصل وتدريج الألوان…' : 'تدريج ألوان الصورة…');
    const f = await investorsFile(p, { treat: ph.treat || dt, grain: ph.grain ?? 0.06, cutout: !!cut, crop: ph.crop });
    ph._file = f.url; ph._aspect = f.aspect;
    if (ph.fg) ph._fg = (await investorsFile(p, { treat: ph.treat || dt, grain: ph.grain ?? 0.06, cutout: true, nocrop: true, crop: ph.crop })).url;
  };
  for (const sl of slides) {
    const dt = defTreat(sl.theme || s.theme || 'noir');
    await prepPhoto(sl.photo, dt);
    if (sl.bg_photo) await prepPhoto(sl.bg_photo, sl.bg_photo.treat || 'mono');
    for (const sec of sl.sections || []) if (sec.photo) await prepPhoto(sec.photo, dt);
    if (sl.hero?.photo) await prepPhoto(sl.hero.photo, dt);
    if (sl.photo && !sl.photo._file) delete sl.photo;
    if (sl.bg_photo && !sl.bg_photo._file) delete sl.bg_photo;
    if (sl.device) delete sl.device;   // لقطات المواقع تحتاج المهارة محلياً
    if (typeof sl.qr === 'string') sl._qr = await makeQR(sl.qr, 'plain', '#2B241A');
  }
  const [W, H] = SIZES[fmt] || SIZES.post;
  return slides.map((_: unknown, i: number) => ({
    key: 's' + (i + 1), label: slides.length > 1 ? `شريحة ${i + 1}` : fmt === 'story' ? 'ستوري 9:16' : 'منشور 4:5',
    W, H, job: { engine, index: i, spec: s },
  }));
}
