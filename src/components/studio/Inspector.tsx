'use client';
import { useEffect, useState } from 'react';
import { Sparkles, Send, Eye, Wand2, Trash2, Braces, FileText, Image as ImageIcon, Check, Scissors } from 'lucide-react';
import { useProject } from '@/lib/project';
import { aiEdit, aiCritique, designOne, setSpec, removeItem, refresh } from '@/lib/actions';
import { ensureCut } from '@/lib/engines';
import { Segmented, Spinner, toast } from '../ui';
import type { PlanItem } from '@/lib/types';

type Tab = 'content' | 'ai' | 'photos' | 'json';

const QUICK: Record<string, string[]> = {
  guzeleser: ['اختصر العنوان لسطرين', 'حوّل الثيم للكحلي', 'خلّ النص يسار والشعار بالفوتر', 'كبّر الأشخاص', 'شيل الأيقونات', 'أضف QR للتبرع'],
  'investors-gate': ['حوّل الشريحة الأخيرة لداكنة', 'كبّر الأصل', 'استخدم خط ثمانية التحريري', 'مدّ العنوان بالكشيدة', 'شيل الصندوق الزجاجي'],
};

export function Inspector() {
  const { project, selected, busy } = useProject();
  const it = project?.items.find(i => i.id === selected) || null;
  const [tab, setTab] = useState<Tab>('content');
  if (!project || !it) return <div className="p-6 text-sm text-muted text-center">لا يوجد منشور محدد</div>;
  const stage = busy[it.id];
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 h-12 flex items-center border-b border-line shrink-0">
        <Segmented<Tab> size="sm" value={tab} onChange={setTab} options={[
          { value: 'content', label: <span className="flex items-center gap-1"><FileText size={12} />المحتوى</span> },
          { value: 'ai', label: <span className="flex items-center gap-1"><Sparkles size={12} />تعديل</span> },
          { value: 'photos', label: <span className="flex items-center gap-1"><ImageIcon size={12} />الصور</span> },
          { value: 'json', label: <span className="flex items-center gap-1"><Braces size={12} />Spec</span> },
        ]} />
      </div>
      <div className="flex-1 overflow-y-auto scroll-thin p-4">
        {tab === 'content' && <ContentTab key={it.id} it={it} stage={stage} />}
        {tab === 'ai' && <AITab key={it.id} it={it} engine={project.engine} stage={stage} />}
        {tab === 'photos' && <PhotosTab it={it} />}
        {tab === 'json' && <JsonTab key={it.id + (it.spec ? JSON.stringify(it.spec).length : 0)} it={it} />}
      </div>
    </div>
  );
}

function ContentTab({ it, stage }: { it: PlanItem; stage?: string }) {
  const { updateItem } = useProject();
  const up = (p: Partial<PlanItem>) => updateItem(it.id, p);
  return (
    <div className="space-y-3.5">
      <div>
        <label className="label">العنوان</label>
        <input className="input" value={it.title} onChange={e => up({ title: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className="label">النوع</label>
          <select className="input" value={it.kind} onChange={e => up({ kind: e.target.value })}>
            <option value="post">منشور</option><option value="carousel">كاروسيل</option><option value="story">ستوري</option>
            <option value="reel_cover">غلاف ريل</option><option value="poster">بوستر</option>
          </select>
        </div>
        <div>
          <label className="label">السعر</label>
          <input className="input" value={it.price || ''} onChange={e => up({ price: e.target.value })} placeholder="—" />
        </div>
      </div>
      <div>
        <label className="label">المحتوى للتصميم (حرفي)</label>
        <textarea className="textarea min-h-40" value={it.content} onChange={e => up({ content: e.target.value })} />
      </div>
      <div>
        <label className="label">الكابشن</label>
        <textarea className="textarea min-h-20" value={it.caption || ''} onChange={e => up({ caption: e.target.value })} />
      </div>
      <div>
        <label className="label">ملاحظات المصمم</label>
        <textarea className="textarea min-h-16" value={it.notes || ''} onChange={e => up({ notes: e.target.value })} placeholder="مثال: استخدم صورة الأطفال، ثيم كحلي، بدون سعر" />
      </div>
      <button className="btn btn-accent w-full" disabled={!!stage} onClick={() => designOne(it.id)}>
        {stage ? <Spinner size={15} /> : <Wand2 size={15} />} {it.spec ? 'أعد التصميم من المحتوى' : 'صمّم'}
      </button>
      <button className="btn btn-ghost btn-sm w-full text-err" onClick={() => confirm('حذف المنشور من الخطة؟') && removeItem(it.id)}><Trash2 size={14} /> حذف المنشور</button>
    </div>
  );
}

function AITab({ it, engine, stage }: { it: PlanItem; engine: string; stage?: string }) {
  const [text, setText] = useState('');
  const [crit, setCrit] = useState<{ score: number; issues: string[]; patch: any; notes?: string } | null>(null);
  if (!it.spec) return <div className="text-sm text-muted text-center py-8">صمّم المنشور أولاً، بعدها تقدر تعدّل بالكلام.</div>;
  const send = async (t = text) => { if (!t.trim()) return; setText(''); await aiEdit(it.id, t.trim()); };
  return (
    <div className="space-y-4">
      {it.aiNotes && <div className="text-xs bg-accent-soft/60 rounded-lg p-3 leading-relaxed"><span className="font-medium">ملاحظة الموديل:</span> {it.aiNotes}</div>}
      <div>
        <label className="label">عدّل بالكلام</label>
        <div className="relative">
          <textarea className="textarea min-h-24 pl-11" placeholder="مثال: خلّ كلمة «الأمل» بخط يد، وصغّر السعر" value={text}
            onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(); }} />
          <button className="absolute left-2 bottom-2 size-8 rounded-lg bg-brand text-brand-ink grid place-items-center disabled:opacity-40" disabled={!text.trim() || !!stage} onClick={() => send()} aria-label="إرسال">
            {stage ? <Spinner size={14} /> : <Send size={14} />}
          </button>
        </div>
        <p className="text-[11px] text-muted mt-1.5">يرسل رقعة صغيرة بس (مو التصميم كامل) لموديل رخيص · Ctrl+Enter</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(QUICK[engine] || []).map(q => (
          <button key={q} className="chip h-7 px-2.5 text-xs bg-surface-2 border border-line hover:border-accent hover:text-accent transition" disabled={!!stage} onClick={() => send(q)}>{q}</button>
        ))}
      </div>
      <div className="card p-3.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="font-medium text-sm flex items-center gap-1.5"><Eye size={15} className="text-accent" /> نقد بعين مصمم</div>
            <div className="text-[11px] text-muted mt-0.5">موديل رؤية يشوف الرسم + تقرير المحرك ويقترح إصلاح</div>
          </div>
          <button className="btn btn-outline btn-sm" disabled={!!stage} onClick={async () => setCrit(await aiCritique(it.id))}>{stage ? <Spinner size={14} /> : 'انقد'}</button>
        </div>
        {crit && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className={`text-lg font-bold mono ${crit.score >= 85 ? 'text-ok' : crit.score >= 70 ? 'text-warn' : 'text-err'}`}>{crit.score}</span>
              <span className="text-xs text-ink-2">/100 {crit.notes}</span>
            </div>
            <ul className="text-xs text-ink-2 space-y-1">{crit.issues.map((x, i) => <li key={i}>• {x}</li>)}</ul>
            {crit.patch && Object.keys(crit.patch).length > 0 && (
              <button className="btn btn-accent btn-sm w-full" disabled={!!stage} onClick={async () => {
                const { mergePatch } = await import('@/lib/pipeline');
                await setSpec(it.id, mergePatch(it.spec, crit.patch)); setCrit(null); toast('تم تطبيق الإصلاح', 'ok');
              }}><Check size={14} /> طبّق الإصلاح المقترح</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PhotosTab({ it }: { it: PlanItem }) {
  const { project, updateItem, updatePhoto } = useProject();
  const [cutting, setCutting] = useState('');
  if (!project) return null;
  const used = new Set(collectPhotoIds(it.spec));
  const toggle = (id: string) => updateItem(it.id, cur => ({ photoIds: cur.photoIds.includes(id) ? cur.photoIds.filter(x => x !== id) : [...cur.photoIds, id] }));
  const recut = async (id: string) => {
    const ph = project.photos.find(p => p.id === id); if (!ph) return;
    setCutting(id);
    try { await ensureCut({ ...ph, cut: undefined }, p => updatePhoto(p)); await refresh(it.id); }
    catch (e) { toast(String((e as Error).message), 'err'); }
    setCutting('');
  };
  if (!project.photos.length) return <div className="text-sm text-muted text-center py-8">أضف صور من الشريط السفلي ⬇</div>;
  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-2 leading-relaxed">اختر صور هذا المنشور (لو ما اخترت شي، الموديل يختار من كل صور المشروع حسب أوصافها).</p>
      <div className="grid grid-cols-3 gap-2">
        {project.photos.map(p => {
          const on = it.photoIds.includes(p.id);
          return (
            <button key={p.id} onClick={() => toggle(p.id)} title={p.desc?.summary || p.name}
              className={`relative aspect-square rounded-lg overflow-hidden ring-2 transition ${on ? 'ring-accent' : 'ring-transparent hover:ring-line-2'}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.thumb} alt="" className="w-full h-full object-cover" />
              {on && <span className="absolute top-1 right-1 size-5 rounded-full bg-accent text-white grid place-items-center"><Check size={12} /></span>}
              {used.has(p.id) && <span className="absolute bottom-1 inset-x-1 chip bg-black/60 text-white justify-center">بالتصميم</span>}
            </button>
          );
        })}
      </div>
      {[...used].map(id => {
        const p = project.photos.find(x => x.id === id); if (!p) return null;
        return (
          <div key={id} className="card p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-medium truncate">{p.name}</span>
              <button className="btn btn-ghost btn-sm" disabled={!!cutting} onClick={() => recut(id)}>{cutting === id ? <Spinner size={13} /> : <Scissors size={13} />} أعد القص</button>
            </div>
            {p.cut?.check
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={p.cut.check} alt="فحص القص" className="w-full rounded-md" />
              : <div className="text-[11px] text-muted">القص يصير وقت الرسم</div>}
            {p.cut && <div className="text-[11px] text-muted mt-1.5">المحرك: {p.cut.engine} — راجع الحواف على الأخضر والكحلي</div>}
            {p.desc?.issues?.length ? <div className="text-[11px] text-warn mt-1">⚠ {p.desc.issues.join('، ')}</div> : null}
          </div>
        );
      })}
    </div>
  );
}

function collectPhotoIds(spec: any): string[] {
  const out: string[] = [];
  JSON.stringify(spec || {}, (k, v) => { if (k === 'photoId' && typeof v === 'string') out.push(v); return v; });
  return out;
}

function JsonTab({ it }: { it: PlanItem }) {
  const [txt, setTxt] = useState(() => JSON.stringify(it.spec || {}, null, 2));
  const [bad, setBad] = useState('');
  useEffect(() => { try { JSON.parse(txt); setBad(''); } catch (e) { setBad((e as Error).message); } }, [txt]);
  if (!it.spec) return <div className="text-sm text-muted text-center py-8">لا يوجد spec بعد</div>;
  return (
    <div className="space-y-2 h-full flex flex-col">
      <p className="text-[11px] text-muted">نفس ملف spec.json بالمهارة — تقدر تعدّله يدوياً أو تنسخه لتشغيل build.py محلياً.</p>
      <textarea className="textarea mono text-[11.5px] flex-1 min-h-[420px] leading-snug" dir="ltr" spellCheck={false} value={txt} onChange={e => setTxt(e.target.value)} />
      {bad && <div className="text-[11px] text-err" dir="ltr">{bad}</div>}
      <div className="flex gap-2">
        <button className="btn btn-primary btn-sm flex-1" disabled={!!bad} onClick={() => setSpec(it.id, JSON.parse(txt))}>طبّق</button>
        <button className="btn btn-outline btn-sm" onClick={() => { navigator.clipboard.writeText(txt); toast('انسخ', 'ok'); }}>نسخ</button>
      </div>
    </div>
  );
}
