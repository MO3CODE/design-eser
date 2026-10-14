import { findChrome } from '@/lib/server/env';
import { guard } from '@/lib/server/radox';
import type { Browser } from 'puppeteer-core';

export const runtime = 'nodejs';
export const maxDuration = 300;

const SIZES: Record<string, [number, number]> = { post: [1080, 1350], story: [1080, 1920], tall: [1080, 1920], square: [1080, 1080], wide: [1920, 1080] };
let browserP: Promise<Browser> | null = null;

async function browser() {
  if (browserP) {
    const b = await browserP.catch(() => null);
    if (b && b.connected) return b;
  }
  const chrome = findChrome();
  if (!chrome) throw new Error('كروم/إيدج غير موجود على السيرفر');
  const puppeteer = await import('puppeteer-core');
  browserP = puppeteer.launch({
    executablePath: chrome, headless: true,
    args: ['--no-sandbox', '--force-color-profile=srgb', '--hide-scrollbars', '--font-render-hinting=none'],
  });
  return browserP;
}

// تصدير بكروم السيرفر — نفس إعدادات render.js بالمهارة (deviceScaleFactor 2/3، srgb، بدون hinting)
export async function POST(req: Request) {
  const g = guard(req); if (g) return g;
  const { job, scale = 2, format = 'png' } = await req.json();
  const origin = new URL(req.url).origin;
  const key = job.engine === 'investors-gate' ? (job.spec?.format || 'post') : (job.size || 'post');
  const [W, H] = SIZES[key] || SIZES.post;
  let page;
  try {
    const b = await browser();
    page = await b.newPage();
    await page.setViewport({ width: W, height: H, deviceScaleFactor: Math.min(4, Math.max(1, scale)) });
    await page.goto(`${origin}/render-host.html`, { waitUntil: 'load' });
    const res = await page.evaluate(j => (window as any).RenderHost.render(j), job);
    const img = await page.screenshot({
      clip: { x: 0, y: 0, width: W, height: H }, type: format === 'jpeg' ? 'jpeg' : 'png',
      ...(format === 'jpeg' ? { quality: 97 } : {}),
    });
    return new Response(Buffer.from(img), {
      headers: { 'Content-Type': format === 'jpeg' ? 'image/jpeg' : 'image/png', 'x-qc': encodeURIComponent(JSON.stringify(res?.qc || null).slice(0, 4000)) },
    });
  } catch (e) {
    return Response.json({ error: String((e as Error).message || e) }, { status: 500 });
  } finally {
    await page?.close().catch(() => {});
  }
}
