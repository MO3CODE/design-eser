// موجّه الموديلات الذكي — يختار أرخص موديل يقدر يسوي المهمة صح، ويصعّد بس لما يفشل.
//
// الفكرة: كل مهمة لها «درجة» أساسية، والتعقيد (كاروسيل، نص طويل، محاولة فاشلة) يرفعها،
// ووضع الميزانية (اقتصادي/متوازن/جودة) يزيحها. كل درجة لها قائمة موديلات بالترتيب — نختار أول متاح يدعم المطلوب.

import { CATALOG, type Cap, type ModelInfo } from './models';

export type Task =
  | 'extract'    // خطة نص حر ← عناصر منظمة
  | 'describe'   // وصف الصور (رؤية) — مرة وحدة لكل صورة وينحفظ
  | 'spec'       // عنصر من الخطة ← مواصفات التصميم (JSON المحرك)
  | 'edit'       // تعديل بأمر («قصّر العنوان») ← رقعة JSON صغيرة
  | 'copy'       // كتابة نص إعلاني ناقص
  | 'critique';  // نقد التصميم المرسوم (رؤية) + اقتراح رقعة

export type Budget = 'eco' | 'balanced' | 'quality';

export const TASK_LABEL: Record<Task, string> = {
  extract: 'قراءة الخطة', describe: 'تحليل الصور', spec: 'بناء التصميم',
  edit: 'تعديل بأمر', copy: 'كتابة النص', critique: 'نقد التصميم',
};

// الدرجات: 0 رخيص جداً · 1 رخيص بالرؤية · 2 متوسط قوي · 3 قوي · 4 الأعلى
export const TIERS: string[][] = [
  ['deepseek-v4-flash-0731', 'gpt-5.6-luna', 'qwen3.8-27b'],
  ['gpt-5.6-luna', 'deepseek-v4-pro-0813', 'seed-2.1-turbo'],
  ['gemini-3.7-flash', 'deepseek-v4-pro-0813', 'kimi-k2.6', 'glm-5.3'],
  ['claude-sonnet-5', 'gpt-5.6-terra', 'gemini-3.1-pro'],
  ['claude-opus-5.5', 'gpt-5.6-sol', 'kimi-k3'],
];

interface TaskProfile { tier: number; needs: Cap[]; maxTokens: number; temperature: number; why: string }

export const PROFILES: Record<Task, TaskProfile> = {
  extract:  { tier: 0, needs: ['json'], maxTokens: 7000, temperature: 0.1, why: 'استخراج منظم — ما يحتاج إبداع' },
  describe: { tier: 1, needs: ['vision'], maxTokens: 1800, temperature: 0.2, why: 'رؤية رخيصة، والوصف ينحفظ ويتكرر استخدامه كنص' },
  spec:     { tier: 2, needs: ['json'], maxTokens: 6000, temperature: 0.5, why: 'يلتزم بمخطط المحرك ويكتب نص بليغ' },
  edit:     { tier: 0, needs: ['json'], maxTokens: 3000, temperature: 0.2, why: 'رقعة صغيرة على تصميم موجود' },
  copy:     { tier: 2, needs: [], maxTokens: 2500, temperature: 0.8, why: 'صياغة تسويقية بلغة سليمة' },
  critique: { tier: 2, needs: ['vision', 'json'], maxTokens: 3000, temperature: 0.3, why: 'عين مصمم على الصورة المرسومة' },
};

export interface Complexity {
  slides?: number;       // عدد الشرائح
  chars?: number;        // طول المحتوى
  attempt?: number;      // رقم المحاولة (0 = أول مرة)
  images?: number;       // صور مرسلة
  strict?: boolean;      // نص حرفي/قواعد صارمة
}

export interface RouteChoice {
  model: ModelInfo;
  tier: number;
  reason: string;
  maxTokens: number;
  temperature: number;
}

export function scoreBump(task: Task, c: Complexity = {}): { bump: number; notes: string[] } {
  const notes: string[] = [];
  let bump = 0;
  if (task === 'spec' || task === 'copy') {
    if ((c.slides || 1) >= 5) { bump++; notes.push(`${c.slides} شرائح`); }
    if ((c.chars || 0) > 1400) { bump++; notes.push('محتوى طويل'); }
  }
  if (task === 'extract' && (c.chars || 0) > 30_000) { bump++; notes.push('خطة ضخمة'); }
  if (c.attempt) { bump += c.attempt; notes.push(`تصعيد بعد ${c.attempt} محاولة`); }
  return { bump, notes };
}

export function route(
  task: Task,
  c: Complexity = {},
  opts: { budget?: Budget; overrides?: Partial<Record<Task, string>>; available?: ModelInfo[] } = {},
): RouteChoice {
  const P = PROFILES[task];
  const list = opts.available?.length ? opts.available : CATALOG;
  const pick = (id: string) => list.find(m => m.id === id);
  const fits = (m: ModelInfo) => P.needs.every(n => n === 'json' ? true : m.caps.includes(n));

  // تجاوز يدوي من الإعدادات (يبقى إلا لو المحاولة الأولى فشلت)
  const ov = opts.overrides?.[task];
  if (ov && !c.attempt) {
    const m = pick(ov);
    if (m && fits(m)) return { model: m, tier: -1, reason: 'اختيارك اليدوي من الإعدادات', maxTokens: P.maxTokens, temperature: P.temperature };
  }

  const shift = opts.budget === 'eco' ? -1 : opts.budget === 'quality' ? 1 : 0;
  const { bump, notes } = scoreBump(task, c);
  let tier = Math.max(0, Math.min(TIERS.length - 1, P.tier + shift + bump));
  // إذا الدرجة ما فيها موديل يدعم المطلوب (مثلاً رؤية بالدرجة 0) نطلع درجة
  for (let t = tier; t < TIERS.length; t++) {
    const m = TIERS[t].map(pick).find((x): x is ModelInfo => !!x && fits(x));
    if (m) {
      const why = [P.why, ...notes, opts.budget && opts.budget !== 'balanced' ? `وضع ${opts.budget === 'eco' ? 'اقتصادي' : 'جودة'}` : '']
        .filter(Boolean).join(' · ');
      return { model: m, tier: t, reason: why, maxTokens: P.maxTokens + (c.slides && c.slides > 3 ? 800 * (c.slides - 3) : 0), temperature: P.temperature };
    }
    tier = t;
  }
  const fallback = list.find(fits) || list[0];
  return { model: fallback, tier: -1, reason: 'احتياطي', maxTokens: P.maxTokens, temperature: P.temperature };
}

/** تقدير التوكن بدون مكتبة: العربي/التركي أثقل من الإنجليزي */
export function estTokens(s: string): number {
  let ar = 0;
  for (const ch of s) if (ch >= '؀' && ch <= 'ۿ') ar++;
  return Math.ceil(ar / 2.2 + (s.length - ar) / 3.6);
}
