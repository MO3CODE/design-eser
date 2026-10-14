import { BASE, guard, keyFrom } from '@/lib/server/radox';

export const runtime = 'nodejs';
export const maxDuration = 300;

// وكيل /chat/completions — المتصفح ما يشوف المفتاح لو محطوط بالبيئة
export async function POST(req: Request) {
  const g = guard(req); if (g) return g;
  const key = keyFrom(req);
  if (!key) return Response.json({ error: { message: 'ما فيه مفتاح RadoxAI — حطه من الإعدادات', code: 'no_key' } }, { status: 401 });
  const body = await req.json();
  const allowed = ['model', 'messages', 'max_tokens', 'temperature', 'top_p', 'response_format', 'stop', 'seed'];
  const clean = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));
  const r = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...clean, stream: false }),
  });
  const headers = new Headers({ 'Content-Type': 'application/json' });
  for (const h of ['retry-after', 'x-ratelimit-remaining', 'x-ratelimit-remaining-tokens']) {
    const v = r.headers.get(h); if (v) headers.set(h, v);
  }
  return new Response(await r.text(), { status: r.status, headers });
}
