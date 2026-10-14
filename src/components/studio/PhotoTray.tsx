'use client';
import { useRef, useState } from 'react';
import { ImagePlus, ScanEye, X, Scissors, ChevronDown, ChevronUp } from 'lucide-react';
import { useProject } from '@/lib/project';
import { addPhotos, analyzePhotos, removePhoto } from '@/lib/actions';
import { cutoutProgress } from '@/lib/photo/image';
import { Spinner } from '../ui';
import { useEffect } from 'react';

export function PhotoTray() {
  const { project, selected, updateItem } = useProject();
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState('');
  const [open, setOpen] = useState(true);
  const [dl, setDl] = useState<{ pct: number; device: string } | null>(null);

  useEffect(() => {
    const l = (pct: number, device: string) => setDl(pct >= 100 ? null : { pct, device });
    cutoutProgress.listeners.add(l);
    return () => { cutoutProgress.listeners.delete(l); };
  }, []);

  if (!project) return null;
  const it = project.items.find(i => i.id === selected);
  const add = async (files: File[]) => { setBusy('add'); await addPhotos(files); setBusy(''); };
  const undesc = project.photos.filter(p => !p.desc).length;

  return (
    <div className={`shrink-0 border-t border-line bg-surface transition ${drag ? 'bg-accent-soft/50' : ''}`}
      onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); add([...e.dataTransfer.files]); }}>
      <input ref={ref} type="file" accept="image/*" multiple hidden onChange={e => { add([...(e.target.files || [])]); e.target.value = ''; }} />
      <div className="h-10 px-3 flex items-center gap-2">
        <button className="icon-btn size-7" onClick={() => setOpen(o => !o)} aria-label="طي">{open ? <ChevronDown size={15} /> : <ChevronUp size={15} />}</button>
        <span className="text-sm font-semibold">الصور</span>
        <span className="text-xs text-muted">{project.photos.length}</span>
        {dl && <span className="text-[11px] text-accent flex items-center gap-1.5"><Spinner size={11} /> تحميل موديل القص BiRefNet ({dl.device}) {dl.pct}%</span>}
        <span className="flex-1" />
        {it && <span className="text-[11px] text-muted hidden md:inline">اضغط صورة لربطها بالمنشور #{it.n}</span>}
        <button className="btn btn-ghost btn-sm" disabled={!undesc || !!busy} onClick={async () => { setBusy('ai'); await analyzePhotos(); setBusy(''); }} title="وصف كل صورة مرة وحدة بموديل رؤية رخيص">
          {busy === 'ai' ? <Spinner size={14} /> : <ScanEye size={15} />} تحليل{undesc ? ` (${undesc})` : ''}
        </button>
        <button className="btn btn-outline btn-sm" onClick={() => ref.current?.click()} disabled={busy === 'add'}>{busy === 'add' ? <Spinner size={14} /> : <ImagePlus size={15} />} إضافة</button>
      </div>
      {open && (
        <div className="px-3 pb-3 flex gap-2 overflow-x-auto scroll-thin">
          {project.photos.length === 0 && (
            <button onClick={() => ref.current?.click()} className="h-20 flex-1 min-w-60 rounded-lg border-2 border-dashed border-line-2 text-xs text-ink-2 hover:border-accent hover:text-accent transition">
              اسحب الصور الميدانية هنا — أو اضغط للاختيار
            </button>
          )}
          {project.photos.map(p => {
            const on = !!it?.photoIds.includes(p.id);
            return (
              <div key={p.id} className="relative shrink-0 group">
                <button onClick={() => it && updateItem(it.id, cur => ({ photoIds: on ? cur.photoIds.filter(x => x !== p.id) : [...cur.photoIds, p.id] }))}
                  title={p.desc ? `${p.desc.summary}\nأشخاص: ${p.desc.people}` : p.name}
                  className={`block h-20 rounded-lg overflow-hidden ring-2 transition ${on ? 'ring-accent' : 'ring-transparent hover:ring-line-2'}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.thumb} alt={p.name} className="h-full w-auto max-w-40 object-cover" />
                </button>
                <div className="absolute bottom-1 right-1 flex gap-1 pointer-events-none">
                  {p.desc && <span className="chip bg-black/60 text-white px-1.5"><ScanEye size={10} /></span>}
                  {p.cut && <span className="chip bg-black/60 text-white px-1.5"><Scissors size={10} /></span>}
                </div>
                <button className="absolute top-1 left-1 size-5 rounded-full bg-black/60 text-white grid place-items-center opacity-0 group-hover:opacity-100 transition" onClick={() => removePhoto(p.id)} aria-label="حذف"><X size={11} /></button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
