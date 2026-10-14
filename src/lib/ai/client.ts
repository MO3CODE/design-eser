'use client';
// استدعاء RadoxAI عبر /api/ai مع: توجيه ذكي، كاش للردود، تصعيد عند الفشل، وتسجيل الاستهلاك والتكلفة.
import { get as idbGet, set as idbSet } from 'idb-keyval';
import { useSettings, useUsage, uid } from '../store';
import { cost, fromApi } from './models';
import { route, type Complexity, type Task } from './router';

export interface AIRequest {
  task: Task;
  system: string;
  user: string;
  images?: string[];                 // dataURL مصغّرة
  json?: boolean;
  complexity?: Complexity;
  validate?: (parsed: unknown) => string | null;   // يرجع سبب الرفض أو null
  noCache?: boolean;
}

export interface AIResult<T = unknown> {
  text: string;
  data: T;
  model: string;
  cached: boolean;
  cost: number;
}

export class AIError extends Error {
  constructor(message: string, public code?: string, public status?: number) { super(message); }
}

function headers(): HeadersInit {
  const s = useSettings.getState().settings;
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (s.apiKey) h['x-radox-key'] = s.apiKey;
  if (s.appPass) h['x-app-pass'] = s.appPass;
  return h;
}

/** يحدّث قائمة الموديلات الحية (أسعار/قدرات) — لو فشل نكمل بالكتالوج الثابت */
export async function refreshModels(): Promise<number> {
  try {
    const r = await fetch('/api/models', { headers: headers() });
    if (!r.ok) return 0;
    const list = fromApi(await r.json());
    if (list.length) useUsage.getState().setModels(list);
    return list.length;
  } catch { return 0; }
}

async function sha(s: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

/** يطلع JSON من رد الموديل حتى لو لفّه بـ ```json أو كتب كلام قبله */
export function parseJSON(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try { return JSON.parse(t); } catch { /* نكمل */ }
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
  throw new Error('الرد مو JSON');
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function callAI<T = unknown>(req: AIRequest): Promise<AIResult<T>> {
  const { settings } = useSettings.getState();
  const usage = useUsage.getState();
  const key = await sha(JSON.stringify([req.task, req.system, req.user, req.images?.map(i => i.length + i.slice(-64))]));

  // 1) الكاش: نفس الطلب بالضبط = صفر توكن
  if (settings.useCache && !req.noCache) {
    const hit = await idbGet<{ text: string; model: string }>('ai:' + key);
    if (hit) {
      const data = (req.json ? parseJSON(hit.text) : hit.text) as T;
      if (!req.validate || !req.validate(data)) {
        usage.add({ id: uid(), at: Date.now(), task: req.task, model: hit.model, tier: -1, reason: 'من الكاش', pin: 0, pout: 0, cost: 0, cached: true, ok: true, ms: 0 });
        return { text: hit.text, data, model: hit.model, cached: true, cost: 0 };
      }
    }
  }

  let lastErr: unknown = null;
  let waits = 0;   // انتظارات حد المعدل (429) — ما تُحسب كمحاولة فاشلة
  for (let attempt = 0; attempt < 3; attempt++) {
    const choice = route(req.task, { ...req.complexity, attempt: attempt + (req.complexity?.attempt || 0) },
      { budget: settings.budget, overrides: settings.overrides, available: usage.models });
    const content = req.images?.length
      ? [{ type: 'text', text: req.user }, ...req.images.map(url => ({ type: 'image_url', image_url: { url } }))]
      : req.user;
    const body = {
      model: choice.model.id,
      messages: [{ role: 'system', content: req.system }, { role: 'user', content }],
      max_tokens: choice.maxTokens,
      temperature: choice.temperature,
      ...(req.json ? { response_format: { type: 'json_object' } } : {}),
    };
    const t0 = performance.now();
    let r: Response;
    try {
      r = await fetch('/api/ai', { method: 'POST', headers: headers(), body: JSON.stringify(body) });
    } catch (e) { lastErr = e; await sleep(800); continue; }
    const raw = await r.text();
    let j: Record<string, any> = {};
    try { j = JSON.parse(raw); } catch { /* */ }
    const ms = Math.round(performance.now() - t0);

    if (!r.ok) {
      const msg = j?.error?.message || raw.slice(0, 200) || `HTTP ${r.status}`;
      usage.add({ id: uid(), at: Date.now(), task: req.task, model: choice.model.id, tier: choice.tier, reason: choice.reason, pin: 0, pout: 0, cost: 0, cached: false, ok: false, ms, note: msg });
      if (r.status === 401 || r.status === 402 || r.status === 403) throw new AIError(
        r.status === 402 ? 'الرصيد خلص بحساب RadoxAI (402)' : msg, j?.error?.code, r.status);
      if (r.status === 429 && waits++ < 4) { await sleep(Math.min(60, Number(r.headers.get('retry-after')) || 5) * 1000); attempt--; continue; }
      lastErr = new AIError(msg, j?.error?.code, r.status);
      continue;   // 422/5xx → تصعيد لموديل ثاني
    }

    const text: string = j?.choices?.[0]?.message?.content ?? '';
    const pin = j?.usage?.prompt_tokens || 0, pout = j?.usage?.completion_tokens || 0;
    const c = cost(choice.model, pin, pout);
    const base = { id: uid(), at: Date.now(), task: req.task, model: choice.model.id, tier: choice.tier, reason: choice.reason, pin, pout, cost: c, cached: false, ms };

    let data: unknown = text;
    let bad: string | null = null;
    if (!text.trim()) bad = j?.choices?.[0]?.finish_reason === 'length' ? 'انقطع الرد (max_tokens)' : 'رد فاضي';
    else if (req.json) { try { data = parseJSON(text); } catch { bad = 'JSON غير صالح'; } }
    if (!bad && req.validate) bad = req.validate(data);
    usage.add({ ...base, ok: !bad, note: bad || undefined });
    if (bad) { lastErr = new AIError(`${choice.model.name}: ${bad}`); continue; }   // ← تصعيد

    if (settings.useCache) await idbSet('ai:' + key, { text, model: choice.model.id });
    return { text, data: data as T, model: choice.model.id, cached: false, cost: c };
  }
  throw lastErr instanceof Error ? lastErr : new AIError('فشل الطلب');
}
