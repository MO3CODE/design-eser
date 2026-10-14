'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileSpreadsheet, Wand2, Images, Download, Plus, Trash2, ArrowLeft, FolderOpen } from 'lucide-react';
import { Header } from '@/components/Header';
import { Toaster, toast } from '@/components/ui';
import { useStatus } from '@/components/status';
import { ENGINES } from '@/lib/engines';
import { deleteProject, listProjects, loadProject, saveProject, uid } from '@/lib/store';
import type { EngineId, Project } from '@/lib/types';

export default function Home() {
  const router = useRouter();
  const status = useStatus(s => s.status);
  const [projects, setProjects] = useState<Awaited<ReturnType<typeof listProjects>>>([]);
  const [engine, setEngine] = useState<EngineId>('guzeleser');
  const [name, setName] = useState('');

  useEffect(() => { listProjects().then(setProjects); }, []);

  const create = async () => {
    const p: Project = {
      id: uid(), name: name.trim() || `خطة ${new Date().toLocaleDateString('ar')}`, engine,
      createdAt: Date.now(), updatedAt: Date.now(), items: [], photos: [],
    };
    await saveProject(p);
    router.push(`/studio?id=${p.id}`);
  };
  const remove = async (id: string) => {
    if (!confirm('حذف المشروع وصوره نهائياً؟')) return;
    const p = await loadProject(id);
    if (p) await deleteProject(p);
    setProjects(await listProjects());
    toast('انحذف المشروع', 'ok');
  };
  const synced = status ? Object.keys(status.engines) : null;

  return (
    <div className="min-h-dvh flex flex-col">
      <Header />
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <section className="grid lg:grid-cols-[1.1fr_1fr] gap-10 items-start">
          <div>
            <p className="text-accent font-medium text-sm mb-3">استوديو التصميم الذكي</p>
            <h1 className="text-3xl sm:text-[42px] font-bold leading-[1.25] tracking-tight">
              ارفع الخطة،<br />والتصاميم تطلع <span className="text-accent">بنفس آلية مهاراتك</span>.
            </h1>
            <p className="text-ink-2 mt-4 leading-loose max-w-xl">
              نفس قوالب المهارات ونفس قواعدها وفحوصاتها — الذكاء الاصطناعي يحوّل كل منشور بالخطة لمواصفات، والمحرك يرسمه
              بالبكسل زي ما ترسمه المهارة. والموجّه يختار أرخص موديل يكفي لكل خطوة.
            </p>
            <ol className="mt-8 grid sm:grid-cols-2 gap-3">
              {[
                { i: FileSpreadsheet, t: 'ارفع الخطة', d: 'Excel/CSV بدون أي توكن، أو Word/نص يقرأه موديل رخيص' },
                { i: Images, t: 'أضف الصور', d: 'قص الأشخاص بـ BiRefNet — أو بالمهارة محلياً (فوتوشوب)' },
                { i: Wand2, t: 'صمّم بضغطة', d: 'منشور، كاروسيل، ستوري — مع فحص المحرك ونقد بصري' },
                { i: Download, t: 'صدّر بالدقة الكاملة', d: 'PNG ‏2×/3× + الكابشن والـspec بملف ZIP' },
              ].map(({ i: I, t, d }, k) => (
                <li key={t} className="card p-4 flex gap-3">
                  <span className="size-9 shrink-0 rounded-lg bg-accent-soft text-accent grid place-items-center"><I size={18} /></span>
                  <div><div className="font-semibold text-sm"><span className="text-muted mono">{k + 1}.</span> {t}</div><div className="text-xs text-ink-2 mt-1 leading-relaxed">{d}</div></div>
                </li>
              ))}
            </ol>
          </div>

          <div className="card shadow-card p-5 sm:p-6">
            <h2 className="font-semibold mb-4">مشروع جديد</h2>
            <label className="label">الهوية / المحرك</label>
            <div className="grid gap-2.5">
              {Object.values(ENGINES).map(e => {
                const missing = synced && !synced.includes(e.id);
                return (
                  <button key={e.id} onClick={() => setEngine(e.id)}
                    className={`text-start rounded-xl border p-3.5 flex items-center gap-3.5 transition ${engine === e.id ? 'border-accent ring-2 ring-accent/20 bg-accent-soft/40' : 'border-line hover:border-line-2'}`}>
                    <span className="size-12 shrink-0 rounded-lg grid place-items-center overflow-hidden" style={{ background: e.accent2 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={e.id === 'guzeleser' ? '/engines/guzeleser/assets/logo/emblem_white.png' : '/engines/investors-gate/assets/logo/symbol_white.svg'} alt="" className="w-8 h-8 object-contain" onError={ev => (ev.currentTarget.style.display = 'none')} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="font-semibold block">{e.name}</span>
                      <span className="text-xs text-ink-2 block mt-0.5">{e.sub}</span>
                      {missing && <span className="chip bg-warn-soft text-warn mt-1">غير مسحوب — شغّل npm run sync</span>}
                    </span>
                    <span className="flex gap-1">
                      <span className="size-3 rounded-full" style={{ background: e.accent }} />
                      <span className="size-3 rounded-full" style={{ background: e.accent2 }} />
                    </span>
                  </button>
                );
              })}
            </div>
            <label className="label mt-4">اسم المشروع</label>
            <input className="input" placeholder="مثال: خطة نوفمبر — حملة الشتاء" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && create()} />
            <button className="btn btn-primary w-full mt-4 h-10" onClick={create}><Plus size={16} /> ابدأ المشروع</button>
          </div>
        </section>

        <section className="mt-14">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2"><FolderOpen size={18} className="text-ink-2" /> مشاريعك</h2>
            <span className="text-xs text-muted">محفوظة بمتصفحك (IndexedDB)</span>
          </div>
          {projects.length === 0 ? (
            <div className="card border-dashed p-10 text-center text-sm text-muted">ما فيه مشاريع بعد — ابدأ أول مشروع من فوق.</div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {projects.map(p => {
                const done = p.items.filter(i => i.status === 'ready').length;
                const thumbs = p.items.filter(i => i.thumb).slice(0, 4);
                return (
                  <div key={p.id} className="card p-4 group hover:shadow-card transition">
                    <button className="w-full text-start" onClick={() => router.push(`/studio?id=${p.id}`)}>
                      <div className="h-24 rounded-lg bg-canvas mb-3 flex gap-1.5 p-1.5 overflow-hidden">
                        {thumbs.length ? thumbs.map(t => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={t.id} src={t.thumb} alt="" className="h-full rounded object-cover" />
                        )) : <span className="m-auto text-xs text-muted">بدون تصاميم</span>}
                      </div>
                      <div className="font-semibold truncate">{p.name}</div>
                      <div className="text-xs text-ink-2 mt-1 flex items-center gap-2">
                        <span>{ENGINES[p.engine]?.name}</span><span className="text-line-2">•</span>
                        <span>{done}/{p.items.length} مصمم</span><span className="text-line-2">•</span>
                        <span>{new Date(p.updatedAt).toLocaleDateString('ar')}</span>
                      </div>
                      {p.items.length > 0 && (
                        <div className="h-1 rounded-full bg-surface-2 mt-3 overflow-hidden"><div className="h-full bg-ok" style={{ width: `${(done / p.items.length) * 100}%` }} /></div>
                      )}
                    </button>
                    <div className="flex justify-between mt-3">
                      <button className="btn btn-ghost btn-sm text-err opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={() => remove(p.id)}><Trash2 size={14} /> حذف</button>
                      <button className="btn btn-outline btn-sm" onClick={() => router.push(`/studio?id=${p.id}`)}>فتح <ArrowLeft size={14} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
      <Toaster />
    </div>
  );
}
