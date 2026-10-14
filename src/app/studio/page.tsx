'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Wand2, Download, LayoutList, Eye, SlidersHorizontal } from 'lucide-react';
import { Header } from '@/components/Header';
import { Toaster, toast, Spinner } from '@/components/ui';
import { PlanPanel } from '@/components/studio/PlanPanel';
import { Canvas } from '@/components/studio/Canvas';
import { Inspector } from '@/components/studio/Inspector';
import { PhotoTray } from '@/components/studio/PhotoTray';
import { useProject } from '@/lib/project';
import { loadProject } from '@/lib/store';
import * as engines from '@/lib/engines';

const { ENGINES } = engines;
import * as actions from '@/lib/actions';

const { designMany, exportItems, setToaster } = actions;

export default function StudioPage() {
  return <Suspense fallback={<div className="h-dvh grid place-items-center"><Spinner size={24} /></div>}><Studio /></Suspense>;
}

function Studio() {
  const id = useSearchParams().get('id');
  const router = useRouter();
  const { project, set, patch, checked, busy } = useProject();
  const [tab, setTab] = useState<'plan' | 'canvas' | 'inspect'>('plan');
  const [exporting, setExporting] = useState('');

  useEffect(() => {
    setToaster(toast);
    // أدوات تشخيص بوضع التطوير فقط
    if (process.env.NODE_ENV === 'development') Object.assign(window, { __de: { useProject, actions, engines } });
  }, []);
  useEffect(() => {
    if (!id) { router.replace('/'); return; }
    loadProject(id).then(p => { if (p) set(p); else router.replace('/'); });
    return () => set(null);
  }, [id, router, set]);

  if (!project) return <div className="h-dvh grid place-items-center"><Spinner size={24} /></div>;
  const eng = ENGINES[project.engine];
  const designable = project.items.filter(i => checked.has(i.id));
  const ready = project.items.filter(i => i.spec);
  const working = Object.keys(busy).length;

  const exportAll = async () => {
    setExporting('…');
    try { await exportItems((designable.length ? designable : ready).filter(i => i.spec).map(i => i.id), setExporting); }
    catch (e) { toast(String((e as Error).message), 'err'); }
    setExporting('');
  };

  return (
    <div className="h-dvh flex flex-col overflow-hidden">
      <Header>
        <span className="hidden md:inline-block w-px h-6 bg-line mx-1" />
        <span className="chip h-6 px-2.5 text-xs shrink-0" style={{ background: eng.accent2, color: '#fff' }}>{eng.name}</span>
        <input className="bg-transparent font-semibold text-sm min-w-0 flex-1 max-w-72 outline-none rounded px-1.5 py-1 hover:bg-surface-2 focus:bg-surface-2"
          value={project.name} onChange={e => patch({ name: e.target.value })} aria-label="اسم المشروع" />
        {working > 0 && <span className="text-xs text-ink-2 flex items-center gap-1.5 shrink-0"><Spinner size={13} /> {working} قيد العمل</span>}
        <div className="flex-1" />
        <button className="btn btn-accent btn-sm" disabled={!designable.length || working > 0} onClick={() => designMany(designable.map(i => i.id))}>
          <Wand2 size={15} /> صمّم المحدد{designable.length ? ` (${designable.length})` : ''}
        </button>
        <button className="btn btn-outline btn-sm" disabled={!ready.length || !!exporting} onClick={exportAll} title="ZIP بالدقة الكاملة + الكابشن">
          {exporting ? <Spinner size={14} /> : <Download size={15} />}
          <span className="hidden lg:inline max-w-48 truncate">{exporting && exporting !== '…' ? exporting : 'تصدير ZIP'}</span>
        </button>
      </Header>

      {/* جوال/تابلت: تبويبات */}
      <nav className="lg:hidden flex border-b border-line bg-surface">
        {([['plan', 'الخطة', LayoutList], ['canvas', 'المعاينة', Eye], ['inspect', 'التحكم', SlidersHorizontal]] as const).map(([k, l, I]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 h-11 text-sm flex items-center justify-center gap-1.5 border-b-2 ${tab === k ? 'border-accent text-ink font-medium' : 'border-transparent text-ink-2'}`}><I size={15} />{l}</button>
        ))}
      </nav>

      <div className="flex-1 min-h-0 grid lg:grid-cols-[minmax(300px,340px)_1fr_minmax(320px,380px)]">
        <aside className={`${tab === 'plan' ? 'flex' : 'hidden'} lg:flex flex-col min-h-0 border-l border-line bg-surface`}><PlanPanel onOpen={() => setTab('canvas')} /></aside>
        <section className={`${tab === 'canvas' ? 'flex' : 'hidden'} lg:flex flex-col min-h-0 bg-canvas`}><Canvas /></section>
        <aside className={`${tab === 'inspect' ? 'flex' : 'hidden'} lg:flex flex-col min-h-0 border-r border-line bg-surface`}><Inspector /></aside>
      </div>
      <PhotoTray />
      <Toaster />
    </div>
  );
}
