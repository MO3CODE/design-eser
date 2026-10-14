'use client';
// خط الإنتاج: وصف الصور (مرة وحدة) ← بناء spec لكل عنصر ← تعديل بأمر ← نقد بصري.
import { callAI } from './ai/client';
import { blobs } from './store';
import { visionThumb } from './photo/image';
import { buildSpecPrompt, resolveAliases, validateSpec } from './engines';
import { GUZELESER_DOC, INVESTORS_DOC } from './engines/docs';
import type { EngineId, Photo, PhotoDesc, PlanItem, Project } from './types';

/** RFC 7396 — رقعة دمج: null يحذف، المصفوفات تُستبدل */
export function mergePatch(target: any, patch: any): any {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return patch;
  const out = target && typeof target === 'object' && !Array.isArray(target) ? { ...target } : {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete out[k];
    else out[k] = mergePatch(out[k], v);
  }
  return out;
}

const DESCRIBE_SYS = `أنت مدير فني يفرز صور لتصاميم سوشال ميديا. لكل صورة (بالترتيب) أعطِ وصف قصير بالعربي يساعد على اختيارها لتصميم.
cutout_ok = هل الأشخاص/العنصر الرئيسي واضحين ومنفصلين بحيث يصلح قصهم من الخلفية.
issues: مشاكل مثل (شعار جهة أخرى ظاهر، مشوشة، مقطوعة، صادمة، دقة منخفضة، تبدو مولّدة بالذكاء الاصطناعي).
أرجع JSON فقط: {"photos":[{"summary":"","people":0,"subjects":[""],"orientation":"portrait|landscape|square","cutout_ok":true,"mood":"","issues":[]}]}`;

/** وصف الصور بدفعات (6 صور/طلب، 448px) — الوصف ينحفظ ويُرسل كنص بعدين بدل الصور */
export async function describePhotos(photos: Photo[], onEach: (id: string, d: PhotoDesc) => void, onProgress?: (s: string) => void) {
  const todo = photos.filter(p => !p.desc);
  for (let i = 0; i < todo.length; i += 6) {
    const batch = todo.slice(i, i + 6);
    onProgress?.(`تحليل الصور ${Math.min(i + 6, todo.length)}/${todo.length}`);
    const images = await Promise.all(batch.map(async p => visionThumb((await blobs.get(p.key))!)));
    const r = await callAI<{ photos: PhotoDesc[] }>({
      task: 'describe', system: DESCRIBE_SYS, json: true, images, complexity: { images: images.length },
      user: `عدد الصور: ${batch.length}. أسماء الملفات بالترتيب: ${batch.map(p => p.name).join(' | ')}`,
      validate: d => Array.isArray((d as any)?.photos) && (d as any).photos.length === batch.length ? null : 'عدد الأوصاف لا يطابق الصور',
    });
    r.data.photos.forEach((d, j) => onEach(batch[j].id, d));
  }
}

export async function designItem(engine: EngineId, item: PlanItem, project: Project, extra = '') {
  const { system, user, complexity } = await buildSpecPrompt(engine, item, project, extra);
  const r = await callAI<{ spec: any; notes?: string }>({
    task: 'spec', system, user, json: true, complexity,
    validate: d => validateSpec(engine, d),
    noCache: !!extra,
  });
  const spec = resolveAliases(r.data.spec, project, item);
  return { spec, notes: r.data.notes || '', model: r.model, cost: r.cost, cached: r.cached };
}

const docFor = (e: EngineId) => (e === 'guzeleser' ? GUZELESER_DOC : INVESTORS_DOC);

const EDIT_RULES = `أنت تعدّل ملف مواصفات تصميم (spec JSON) لمحرك رسم. نفّذ طلب المستخدم بأقل تغيير ممكن.
أرجع JSON فقط: {"patch": <JSON Merge Patch (RFC 7396) على الـspec الحالي — فقط الحقول المتغيرة؛ null يحذف حقل؛ المصفوفات تُكتب كاملة>, "notes":"سطر يشرح التعديل"}.
لا تغيّر النص الحرفي إلا لو طُلب. حافظ على photoId كما هو.`;

export async function editItem(engine: EngineId, item: PlanItem, instruction: string) {
  const r = await callAI<{ patch: any; notes?: string }>({
    task: 'edit', json: true,
    system: `${EDIT_RULES}\n\n${docFor(engine)}`,
    user: `## الـspec الحالي\n${JSON.stringify(item.spec)}\n\n## الطلب\n${instruction}`,
    complexity: { chars: JSON.stringify(item.spec).length },
    validate: d => ((d as any)?.patch && typeof (d as any).patch === 'object' ? null : 'ناقص patch'),
    noCache: true,
  });
  return { spec: mergePatch(item.spec, r.data.patch), notes: r.data.notes || '', model: r.model };
}

const CRITIQUE_SYS = `أنت مدير فني صارم لوكالة تصميم. تشوف تصميم سوشال ميديا مرسوم + الـspec اللي ولّده.
قيّم: التسلسل البصري، الزحمة/الفراغ الميت، تغطية الوجوه، التباين، سلامة اللغة، الالتزام بالهوية والقواعد.
أرجع JSON فقط: {"score":0-100,"issues":["…"],"patch":<JSON Merge Patch يصلح أهم المشاكل أو {} لو ممتاز>,"notes":"سطر"}.`;

export async function critiqueItem(engine: EngineId, item: PlanItem, image: string, qc: unknown) {
  const r = await callAI<{ score: number; issues: string[]; patch: any; notes?: string }>({
    task: 'critique', json: true, images: [image],
    system: `${CRITIQUE_SYS}\n\n${docFor(engine)}`,
    user: `## الـspec\n${JSON.stringify(item.spec)}\n\n## تقرير الفحص الآلي من المحرك\n${JSON.stringify(qc ?? {}).slice(0, 2500)}`,
    validate: d => (typeof (d as any)?.score === 'number' ? null : 'ناقص score'),
    noCache: true,
  });
  return r.data;
}
