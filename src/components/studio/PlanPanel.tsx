'use client';
import { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, ClipboardPaste, Plus, Image as ImageIcon, AlertCircle, CheckCircle2, Clock, Layers, Smartphone, Square, Film, LayoutPanelTop } from 'lucide-react';
import { useProject } from '@/lib/project';
import { importPlan, addManualItem } from '@/lib/actions';
import { Spinner } from '../ui';
import type { PlanItem } from '@/lib/types';

const KIND: Record<string, { l: string; I: typeof Square }> = {
  post: { l: 'منشور', I: Square }, carousel: { l: 'كاروسيل', I: Layers }, story: { l: 'ستوري', I: Smartphone },
  reel_cover: { l: 'غلاف ريل', I: Film }, poster: { l: 'بوستر', I: LayoutPanelTop },
};
const ACCEPT = '.xlsx,.xls,.csv,.ods,.docx,.txt,.md,.json';

export function PlanPanel({ onOpen }: { onOpen: () => void }) {
  const { project, selected, select, checked, toggle, setChecked, busy } = useProject();
  const fileRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [paste, setPaste] = useState('');
  const [showPaste, setShowPaste] = useState(false);
  const [loading, setLoading] = useState(false);
  if (!project) return null;
  const items = project.items;

  const load = async (f: File | string) => {
    setLoading(true);
    try { await importPlan(f); setShowPaste(false); setPaste(''); }
    finally { setLoading(false); }
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files?.[0]; if (f) load(f);
  };
  const allChecked = items.length > 0 && items.every(i => checked.has(i.id));

  const Drop = (
    <div onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop}
      className={`rounded-xl border-2 border-dashed transition p-5 text-center ${drag ? 'border-accent bg-accent-soft/50' : 'border-line-2'}`}>
      <div className="size-11 rounded-xl bg-accent-soft text-accent grid place-items-center mx-auto mb-3">{loading ? <Spinner size={20} /> : <FileSpreadsheet size={22} />}</div>
      <div className="font-semibold text-sm">ارفع خطة المحتوى</div>
      <div className="text-xs text-ink-2 mt-1 leading-relaxed">Excel · CSV · Word · نص — الإكسل ينقرأ بدون أي توكن</div>
      <div className="flex gap-2 justify-center mt-4">
        <button className="btn btn-primary btn-sm" onClick={() => fileRef.current?.click()} disabled={loading}><Upload size={14} /> اختر ملف</button>
        <button className="btn btn-outline btn-sm" onClick={() => setShowPaste(v => !v)}><ClipboardPaste size={14} /> لصق نص</button>
      </div>
      {showPaste && (
        <div className="mt-3 text-start">
          <textarea className="textarea h-36 text-xs" placeholder="الصق الخطة هنا (منشورات، عناوين، محتوى، كابشن…)" value={paste} onChange={e => setPaste(e.target.value)} />
          <button className="btn btn-accent btn-sm w-full mt-2" disabled={!paste.trim() || loading} onClick={() => load(paste)}>استخراج المنشورات (موديل رخيص)</button>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col min-h-0 h-full">
      <input ref={fileRef} type="file" accept={ACCEPT} hidden onChange={e => { const f = e.target.files?.[0]; if (f) load(f); e.target.value = ''; }} />
      <div className="px-4 h-12 flex items-center gap-2 border-b border-line shrink-0">
        <h2 className="font-semibold text-sm flex-1">الخطة {items.length > 0 && <span className="text-muted font-normal">· {items.length} منشور</span>}</h2>
        {items.length > 0 && <>
          <button className="icon-btn" title="إضافة ملف خطة آخر" onClick={() => fileRef.current?.click()}><Upload size={16} /></button>
          <button className="icon-btn" title="منشور يدوي" onClick={addManualItem}><Plus size={16} /></button>
        </>}
      </div>

      {items.length === 0 ? (
        <div className="p-4 space-y-3 overflow-y-auto scroll-thin">
          {Drop}
          <button className="btn btn-ghost btn-sm w-full" onClick={addManualItem}><Plus size={14} /> أو أضف منشور يدوي</button>
          <div className="text-[11px] text-muted leading-relaxed bg-surface-2 rounded-lg p-3">
            الأعمدة المعروفة: العنوان · المحتوى للتصميم · الكابشن · النوع (منشور/كاروسيل/ستوري) · التاريخ · المنصة · ملاحظات المصمم · السعر.
            تقويم بوابة المستثمر الأصلي ينقرأ كما هو.
          </div>
        </div>
      ) : (
        <>
          <label className="px-4 py-2 flex items-center gap-2 text-xs text-ink-2 border-b border-line shrink-0 cursor-pointer select-none">
            <input type="checkbox" className="size-3.5 accent-[var(--accent)]" checked={allChecked} onChange={e => setChecked(e.target.checked ? items.map(i => i.id) : [])} />
            تحديد الكل
            <span className="flex-1" />
            {checked.size > 0 && <span>{checked.size} محدد</span>}
            <button className="text-accent hover:underline" onClick={e => { e.preventDefault(); setChecked(items.filter(i => !i.spec).map(i => i.id)); }}>غير المصممة</button>
          </label>
          <ul className="flex-1 overflow-y-auto scroll-thin p-2 space-y-1">
            {items.map(it => (
              <Row key={it.id} it={it} active={it.id === selected} checked={checked.has(it.id)} stage={busy[it.id]}
                onSelect={() => { select(it.id); onOpen(); }} onCheck={v => toggle(it.id, v)} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Row({ it, active, checked, stage, onSelect, onCheck }:
  { it: PlanItem; active: boolean; checked: boolean; stage?: string; onSelect: () => void; onCheck: (v: boolean) => void }) {
  const K = KIND[it.kind] || KIND.post;
  return (
    <li className={`rounded-lg flex items-center gap-2.5 p-2 cursor-pointer transition ${active ? 'bg-accent-soft/60 ring-1 ring-accent/30' : 'hover:bg-surface-2'}`} onClick={onSelect}>
      <input type="checkbox" className="size-3.5 shrink-0 accent-[var(--accent)]" checked={checked} onClick={e => e.stopPropagation()} onChange={e => onCheck(e.target.checked)} />
      <div className="w-11 h-14 shrink-0 rounded-md bg-canvas overflow-hidden grid place-items-center relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {it.thumb ? <img src={it.thumb} alt="" className="w-full h-full object-cover" /> : <K.I size={16} className="text-muted" />}
        {stage && <div className="absolute inset-0 shimmer opacity-70" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium truncate"><span className="text-muted mono text-xs">{it.n}.</span> {it.title || 'بدون عنوان'}</div>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <span className="chip bg-surface-2 text-ink-2 border border-line"><K.I size={10} />{K.l}</span>
          {it.photoIds.length > 0 && <span className="chip bg-surface-2 text-ink-2 border border-line"><ImageIcon size={10} />{it.photoIds.length}</span>}
          <StatusChip it={it} stage={stage} />
        </div>
      </div>
    </li>
  );
}

function StatusChip({ it, stage }: { it: PlanItem; stage?: string }) {
  if (stage) return <span className="chip bg-accent-soft text-accent max-w-40 truncate"><Spinner size={10} />{stage}</span>;
  if (it.status === 'queued') return <span className="chip bg-surface-2 text-ink-2"><Clock size={10} />بالانتظار</span>;
  if (it.status === 'error') return <span className="chip bg-err-soft text-err" title={it.error}><AlertCircle size={10} />خطأ</span>;
  if (it.spec) {
    const warns = countWarn(it.qc);
    return warns ? <span className="chip bg-warn-soft text-warn"><AlertCircle size={10} />{warns} ملاحظة</span>
      : <span className="chip bg-ok-soft text-ok"><CheckCircle2 size={10} />جاهز</span>;
  }
  return null;
}

export function countWarn(qc?: Record<string, any>) {
  if (!qc) return 0;
  return Object.values(qc).reduce((a: number, q: any) => a + (q?.warn?.length || 0) + (q?.warnings?.length || 0) + (q?.errors?.length || 0), 0);
}
