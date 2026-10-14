import { BASE, guard, keyFrom } from '@/lib/server/radox';

export const runtime = 'nodejs';
let cache: { at: number; key: string; body: string } | null = null;

// قائمة الموديلات الحية (الأسعار والقدرات) — تتخزن 10 دقائق
export async function GET(req: Request) {
  const g = guard(req); if (g) return g;
  const key = keyFrom(req);
  if (!key) return Response.json({ error: { message: 'no key', code: 'no_key' } }, { status: 401 });
  if (cache && cache.key === key && Date.now() - cache.at < 600_000)
    return new Response(cache.body, { headers: { 'Content-Type': 'application/json' } });
  const r = await fetch(`${BASE}/models`, { headers: { Authorization: `Bearer ${key}` } });
  const body = await r.text();
  if (r.ok) cache = { at: Date.now(), key, body };
  return new Response(body, { status: r.status, headers: { 'Content-Type': 'application/json' } });
}
