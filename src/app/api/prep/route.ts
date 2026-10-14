import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { enginesIndex, PY, run } from '@/lib/server/env';
import { guard } from '@/lib/server/radox';

export const runtime = 'nodejs';
export const maxDuration = 300;

const dataUrl = (p: string, mime: string) => `data:${mime};base64,${fs.readFileSync(p).toString('base64')}`;

// القص المحلي بسكربت المهارة نفسه (فوتوشوب Remove Background + BiRefNet + defringe + YuNet) — أعلى جودة.
// يشتغل بس على الجهاز اللي فيه المهارات؛ الموقع يرجع تلقائياً لـ BiRefNet بالمتصفح لو فشل.
export async function POST(req: Request) {
  const g = guard(req); if (g) return g;
  const fd = await req.formData();
  const engine = String(fd.get('engine'));
  const opts = JSON.parse(String(fd.get('opts') || '{}'));
  const file = fd.get('file') as File | null;
  const idx = enginesIndex();
  const skillDir = idx?.engines?.[engine]?.skill_dir;
  if (!file || !skillDir || !fs.existsSync(skillDir)) return Response.json({ error: 'المهارة غير موجودة على هذا الجهاز' }, { status: 404 });

  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'de-prep-'));
  try {
    const ext = path.extname(file.name || '.jpg') || '.jpg';
    const src = path.join(work, 'src' + ext);
    fs.writeFileSync(src, Buffer.from(await file.arrayBuffer()));
    const script = path.join(skillDir, 'scripts', 'prep_photo.py');

    if (engine === 'guzeleser') {
      const out = path.join(work, 'out');
      const args = [script, src, out];
      if (opts.crop) args.push('--crop', String(opts.crop));
      if (opts.engine) args.push('--engine', String(opts.engine));
      const r = await run(PY(), args);
      if (r.code !== 0 || !fs.existsSync(path.join(out, 'cut.png')))
        return Response.json({ error: (r.err || r.out).slice(-600) }, { status: 500 });
      return Response.json({
        cut: dataUrl(path.join(out, 'cut.png'), 'image/png'),
        check: fs.existsSync(path.join(out, 'cut_check.jpg')) ? dataUrl(path.join(out, 'cut_check.jpg'), 'image/jpeg') : null,
        info: JSON.parse(fs.readFileSync(path.join(out, 'info.json'), 'utf8')),
      });
    }

    // investors-gate: prep_photo.py <src> <out> --treat X [--cutout] [--grain g] [--nocrop] [--crop x0,y0,x1,y1]
    const alpha = opts.cutout || /\.(png|webp)$/i.test(ext);
    const out = path.join(work, alpha ? 'out.png' : 'out.jpg');
    const args = [script, src, out, '--treat', String(opts.treat || 'natural'), '--grain', String(opts.grain ?? 0.06)];
    if (opts.cutout) args.push('--cutout');
    if (opts.nocrop) args.push('--nocrop');
    if (opts.crop?.length === 4) args.push('--crop', opts.crop.join(','));
    const r = await run(PY(), args);
    if (r.code !== 0 || !fs.existsSync(out)) return Response.json({ error: (r.err || r.out).slice(-600) }, { status: 500 });
    const info = JSON.parse(r.out.trim().split(/\r?\n/).pop() || '{}');
    return Response.json({ file: dataUrl(out, alpha ? 'image/png' : 'image/jpeg'), info });
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}
