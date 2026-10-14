// اتصال RadoxAI من السيرفر — المفتاح من البيئة أو من هيدر الإعدادات (x-radox-key). ما ينطبع ولا ينحفظ.
export const BASE = (process.env.RADOX_BASE_URL || 'https://radoxai.com/v1').replace(/\/+$/, '');

export function keyFrom(req: Request): string | null {
  return req.headers.get('x-radox-key')?.trim() || process.env.RADOX_API_KEY?.trim() || null;
}

/** لو APP_PASSWORD موجود بالبيئة — كل طلب لازم يحمل x-app-pass (عشان الموقع المنشور ما يصير بوابة مفتوحة لمفتاحك) */
export function guard(req: Request): Response | null {
  const pass = process.env.APP_PASSWORD;
  if (pass && req.headers.get('x-app-pass') !== pass)
    return Response.json({ error: { message: 'كلمة مرور الموقع غير صحيحة', code: 'app_auth' } }, { status: 401 });
  return null;
}
