'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Wand2, Download, Undo2, RefreshCw, AlertTriangle, CheckCircle2, Cpu, ShieldAlert } from 'lucide-react';
import { useProject } from '@/lib/project';
import { useSettings, useUsage } from '@/lib/store';
import { attachHost } from '@/lib/render/host';
import { buildSpecPrompt, type Output } from '@/lib/engines';
import { designOne, exportOne, outputsOf, undo, refresh } from '@/lib/actions';
import { route, estTokens } from '@/lib/ai/router';
import { cost } from '@/lib/ai/models';
import { Spinner, fmtCost } from '../ui';

type Host = Awaited<ReturnType<typeof attachHost>>;

export function Canvas() {
  const { project, selected, busy } = useProject();
  const it = project?.items.find(i => i.id === selected) || null;
  const frameRef = useRef<HTMLIFrameElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [host, setHost] = useState<Host | null>(null);
  const [outs, setOuts] = useState<Output[]>([]);
  const [cur, setCur] = useState(0);
  const [qc, setQc] = useState<any>(null);
  const [rendering, setRendering] = useState(false);
  const [err, setErr] = useState('');
  const [box, setBox] = useState({ w: 600, h: 600 });
  const ver = useRef(0);
  const rver = useRef(0);

  useEffect(() => { if (frameRef.current) attachHost(frameRef.current).then(setHost).catch(e => setErr(String(e.message))); }, []);
  useLayoutEffect(() => {
    const el = boxRef.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el); return () => ro.disconnect();
  }, []);

  // spec تغيّر → جهّز المخرجات
  const specKey = it?.spec ? JSON.stringify(it.spec) : '';
  const photosKey = project?.photos.map(p => p.id + (p.cut ? 'c' : '')).join() || '';
  useEffect(() => {
    if (!it?.spec) { setOuts([]); return; }
    const v = ++ver.current;
    setErr('');
    outputsOf(it.id).then(o => { if (v === ver.current) { setOuts(o); setCur(c => Math.min(c, Math.max(0, o.length - 1))); } })
      .catch(e => v === ver.current && setErr(String(e.message)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [it?.id, specKey, photosKey]);

  useEffect(() => { setCur(0); }, [it?.id]);

  // ارسم المخرج المختار
  const o = outs[cur];
  useEffect(() => {
    if (!host || !o) return;
    const v = ++rver.current;
    setRendering(true);
    host.render(o.job).then(r => { if (v === rver.current) { setQc(r.qc); setErr(''); } })
      .catch(e => v === rver.current && setErr(String(e.message)))
      .finally(() => v === rver.current && setRendering(false));
  }, [host, o]);

  const W = o?.W || 1080, H = o?.H || 1350;
  const k = Math.max(0.05, Math.min((box.w - 48) / W, (box.h - 48) / H));
  const stage = it ? busy[it.id] : undefined;
  const warns: string[] = qc ? [...(qc.errors || []).map((x: string) => '❌ ' + x), ...(qc.warn || []), ...(qc.warnings || [])] : [];

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="h-12 px-3 flex items-center gap-2 border-b border-line bg-surface/70 backdrop-blur shrink-0">
        <div className="flex gap-1 overflow-x-auto scroll-thin flex-1 min-w-0">
          {outs.map((x, i) => (
            <button key={x.key} onClick={() => setCur(i)}
              className={`h-7 px-2.5 rounded-md text-xs font-medium whitespace-nowrap transition ${i === cur ? 'bg-brand text-brand-ink' : 'text-ink-2 hover:bg-surface-2'}`}>{x.label}</button>
          ))}
        </div>
        {it?.spec && <>
          <button className="icon-btn" title="تراجع" disabled={!it.history.length || !!stage} onClick={() => undo(it.id)}><Undo2 size={16} /></button>
          <button className="icon-btn" title="إعادة الرسم" disabled={!!stage} onClick={() => refresh(it.id)}><RefreshCw size={15} /></button>
          <button className="btn btn-outline btn-sm" disabled={!o || !!stage} onClick={() => o && exportOne(o, `${it.n}_${it.title}`)}><Download size={14} /> PNG</button>
        </>}
      </div>

      <div ref={boxRef} className="flex-1 min-h-0 relative grid place-items-center overflow-hidden"
        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--ink) 9%, transparent) 1px, transparent 0)', backgroundSize: '18px 18px' }}>
        <div className={`relative rounded-[6px] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,.18)] transition-opacity ${o ? 'opacity-100' : 'opacity-0 pointer-events-none absolute'}`}
          style={{ width: W * k, height: H * k }}>
          <iframe ref={frameRef} src="/render-host.html" title="معاينة" scrolling="no"
            style={{ width: W, height: H, border: 0, transform: `scale(${k})`, transformOrigin: '0 0', position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }} />
          {(rendering || stage) && <div className="absolute inset-0 bg-black/10 grid place-items-center"><span className="card px-3 py-1.5 text-xs flex items-center gap-2 shadow-card"><Spinner size={13} /> {stage || 'رسم…'}</span></div>}
        </div>
        {!it && <Empty title="اختر منشور من الخطة" sub="أو ارفع خطة جديدة من اللوحة الجانبية" />}
        {it && !it.spec && <DesignPrompt />}
        {err && <div className="absolute bottom-3 inset-x-3 card border-err/40 bg-err-soft text-err text-xs px-3 py-2 flex gap-2"><ShieldAlert size={14} className="shrink-0" />{err}</div>}
      </div>

      {it?.spec && (
        <div className="shrink-0 border-t border-line bg-surface px-3 py-2 flex items-start gap-3 text-xs max-h-28 overflow-y-auto scroll-thin">
          {warns.length ? (
            <div className="flex-1 space-y-1">
              <div className="font-medium text-warn flex items-center gap-1.5"><AlertTriangle size={13} /> فحص المحرك ({warns.length})</div>
              {warns.map((w, i) => <div key={i} className="text-ink-2 leading-relaxed">• {w}</div>)}
            </div>
          ) : <div className="flex-1 text-ok flex items-center gap-1.5"><CheckCircle2 size={13} /> فحص المحرك نظيف</div>}
          {it.model && <span className="chip bg-surface-2 border border-line text-ink-2 shrink-0 h-6"><Cpu size={11} /><span className="mono" dir="ltr">{it.model}</span></span>}
        </div>
      )}
    </div>
  );
}

function Empty({ title, sub }: { title: string; sub: string }) {
  return <div className="absolute inset-0 grid place-items-center text-center p-6"><div><div className="font-semibold">{title}</div><div className="text-sm text-ink-2 mt-1">{sub}</div></div></div>;
}

function DesignPrompt() {
  const { project, selected, busy } = useProject();
  const it = project?.items.find(i => i.id === selected)!;
  const { settings } = useSettings();
  const models = useUsage(s => s.models);
  const [est, setEst] = useState<{ model: string; cost: number; reason: string } | null>(null);
  useEffect(() => {
    let live = true;
    buildSpecPrompt(project!.engine, it, project!).then(({ system, user, complexity }) => {
      const r = route('spec', complexity, { budget: settings.budget, overrides: settings.overrides, available: models });
      const tin = estTokens(system + user), tout = 1800 + (complexity.slides || 1) * 500;
      if (live) setEst({ model: r.model.id, cost: cost(r.model, tin, tout), reason: r.reason });
    });
    return () => { live = false; };
  }, [it, project, settings.budget, settings.overrides, models]);
  const stage = busy[it.id];
  return (
    <div className="absolute inset-0 grid place-items-center p-6">
      <div className="card shadow-card max-w-md w-full p-5">
        <div className="text-xs text-muted mb-1">منشور #{it.n}</div>
        <div className="font-semibold leading-relaxed">{it.title}</div>
        <p className="text-sm text-ink-2 mt-2 whitespace-pre-line line-clamp-6 leading-relaxed">{it.content}</p>
        {it.status === 'error' && <div className="mt-3 text-xs text-err bg-err-soft rounded-lg p-2.5">{it.error}</div>}
        <button className="btn btn-accent w-full mt-4 h-10" disabled={!!stage} onClick={() => designOne(it.id)}>
          {stage ? <><Spinner size={15} /> {stage}</> : <><Wand2 size={16} /> صمّم هذا المنشور</>}
        </button>
        {est && <div className="text-[11px] text-muted mt-2.5 text-center leading-relaxed">
          الموديل: <span className="mono" dir="ltr">{est.model}</span> · تقدير ≈ {fmtCost(est.cost)}<br />{est.reason}
        </div>}
      </div>
    </div>
  );
}
