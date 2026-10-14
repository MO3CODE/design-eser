// كتالوج موديلات RadoxAI (من radoxai.com/models — أكتوبر 2026). يتحدّث تلقائياً من GET /v1/models لو متاح.
// السعر بالدولار لكل مليون توكن (إدخال/إخراج).

export type Cap = 'reasoning' | 'vision' | 'tools' | 'json' | 'web';

export interface ModelInfo {
  id: string;
  name: string;
  in: number;   // $ / 1M input
  out: number;  // $ / 1M output
  ctx: number;  // tokens
  caps: Cap[];
}

const R: Cap[] = ['reasoning'];
const RV: Cap[] = ['reasoning', 'vision'];
const T: Cap[] = ['tools', 'json'];
const W: Cap[] = ['web'];

export const CATALOG: ModelInfo[] = [
  { id: 'gemma-2-2b', name: 'Gemma 2 2B', in: 0.12, out: 0.23, ctx: 8_000, caps: ['json'] },
  { id: 'deepseek-v4-flash-0731', name: 'DeepSeek V4 Flash', in: 0.12, out: 0.12, ctx: 1_048_576, caps: [...R, ...T] },
  { id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna', in: 0.36, out: 0.36, ctx: 1_050_000, caps: [...RV, ...T] },
  { id: 'deepseek-v4-pro-0813', name: 'DeepSeek V4 Pro', in: 0.55, out: 0.55, ctx: 1_048_576, caps: [...R, ...T] },
  { id: 'qwen3.8-27b', name: 'Qwen3.8 27B', in: 0.57, out: 0.57, ctx: 262_000, caps: [...R, ...T] },
  { id: 'seed-2.1-turbo', name: 'Seed 2.1 Turbo', in: 0.92, out: 0.92, ctx: 262_000, caps: [...RV, ...T] },
  { id: 'seed-2.1-pro', name: 'Seed 2.1 Pro', in: 1.15, out: 1.15, ctx: 262_000, caps: [...RV, ...T] },
  { id: 'kimi-k2.6', name: 'Kimi K2.6', in: 1.22, out: 1.22, ctx: 1_000_000, caps: [...RV, ...T, ...W] },
  { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', in: 1.24, out: 1.24, ctx: 1_048_576, caps: [...RV, ...T, ...W] },
  { id: 'glm-5.3', name: 'GLM-5.3', in: 1.36, out: 1.36, ctx: 1_000_000, caps: [...RV, ...T, ...W] },
  { id: 'qwen3.8-max', name: 'Qwen3.8 Max', in: 1.76, out: 1.76, ctx: 1_000_000, caps: [...RV, ...T, ...W] },
  { id: 'muse-spark-1.1', name: 'Muse Spark 1.1', in: 1.82, out: 1.82, ctx: 1_000_000, caps: [...RV, ...T] },
  { id: 'deepseek-v4-pro-max', name: 'DeepSeek V4 Pro Max', in: 2.05, out: 2.05, ctx: 1_048_576, caps: [...R, ...T] },
  { id: 'grok-4.6', name: 'Grok 4.6', in: 2.81, out: 2.81, ctx: 500_000, caps: [...RV, ...T, ...W] },
  { id: 'claude-sonnet-5', name: 'Claude Sonnet 5', in: 3.32, out: 3.32, ctx: 1_000_000, caps: [...RV, ...T] },
  { id: 'gpt-5.6-terra', name: 'GPT-5.6 Terra', in: 3.58, out: 3.58, ctx: 1_050_000, caps: [...RV, ...T] },
  { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro', in: 4.47, out: 4.47, ctx: 1_048_576, caps: [...RV, ...T, ...W] },
  { id: 'kimi-k3', name: 'Kimi K3', in: 4.98, out: 4.98, ctx: 1_000_000, caps: [...RV, ...T, ...W] },
  { id: 'claude-opus-5.5', name: 'Claude Opus 5.5', in: 8.3, out: 8.3, ctx: 1_000_000, caps: [...RV, ...T] },
  { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol', in: 8.95, out: 8.95, ctx: 1_050_000, caps: [...RV, ...T] },
  { id: 'claude-fable-5.1', name: 'Claude Fable 5.1', in: 16.61, out: 16.61, ctx: 1_000_000, caps: [...RV, ...T] },
];

export const byId = (id: string, list: ModelInfo[] = CATALOG) => list.find(m => m.id === id);

/** يحوّل رد GET /v1/models لكتالوج (السعر هناك لكل 1K) */
export function fromApi(data: unknown): ModelInfo[] {
  const arr = (data as { data?: unknown[] })?.data;
  if (!Array.isArray(arr)) return [];
  return arr.flatMap((m): ModelInfo[] => {
    const o = m as Record<string, unknown>;
    if (typeof o.id !== 'string') return [];
    const p = (o.pricing || {}) as Record<string, number>;
    const caps = (Array.isArray(o.capabilities) ? o.capabilities : []).map(c => (c === 'json_mode' ? 'json' : c === 'web_search' ? 'web' : c)) as Cap[];
    const known = byId(o.id);
    return [{
      id: o.id,
      name: (o.name as string) || known?.name || o.id,
      in: p.input_per_1k != null ? p.input_per_1k * 1000 : known?.in ?? 1,
      out: p.output_per_1k != null ? p.output_per_1k * 1000 : known?.out ?? 1,
      ctx: (o.context_window as number) || known?.ctx || 128_000,
      caps: caps.length ? caps : known?.caps || [],
    }];
  });
}

export const cost = (m: ModelInfo | undefined, pin: number, pout: number) =>
  m ? (pin * m.in + pout * m.out) / 1_000_000 : 0;
