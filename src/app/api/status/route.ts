import fs from 'node:fs';
import { enginesIndex, findChrome, pythonOk } from '@/lib/server/env';

export const runtime = 'nodejs';

// حالة البيئة: المحركات المسحوبة، كروم للتصدير، بايثون المهارات للقص المحلي، مفتاح السيرفر
export async function GET() {
  const idx = enginesIndex();
  const engines = Object.fromEntries(Object.entries(idx?.engines || {}).map(([k, v]) => [k, {
    version: v.version, skill: v.skill, local: fs.existsSync(v.skill_dir),
  }]));
  const local = Object.values(engines).some(e => e.local);
  return Response.json({
    synced_at: idx?.synced_at || null,
    engines,
    chrome: !!findChrome(),
    localPrep: local ? await pythonOk() : false,
    serverKey: !!process.env.RADOX_API_KEY,
    appPass: !!process.env.APP_PASSWORD,
  });
}
