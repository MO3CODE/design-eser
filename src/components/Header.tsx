'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Settings2, Gauge, Sparkles } from 'lucide-react';
import { useSettings, useUsage } from '@/lib/store';
import { useStatus } from './status';
import { SettingsDialog } from './SettingsDialog';
import { UsageDialog } from './UsageDialog';
import { fmtCost, useMounted } from './ui';

export function Header({ children }: { children?: React.ReactNode }) {
  const mounted = useMounted();
  const [openSettings, setOpenSettings] = useState(false);
  const [openUsage, setOpenUsage] = useState(false);
  const log = useUsage(s => s.log);
  const { settings } = useSettings();
  const { status, load } = useStatus();
  useEffect(() => { if (!status) load(); }, [status, load]);

  const today = useMemo(() => {
    const d0 = new Date(); d0.setHours(0, 0, 0, 0);
    const l = log.filter(e => e.at >= d0.getTime());
    return { cost: l.reduce((a, e) => a + e.cost, 0), calls: l.filter(e => !e.cached).length, hits: l.filter(e => e.cached).length };
  }, [log]);
  const noKey = mounted && !settings.apiKey && status && !status.serverKey;

  return (
    <header className="h-14 shrink-0 border-b border-line bg-surface/80 backdrop-blur sticky top-0 z-30">
      <div className="h-full px-4 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="size-8 rounded-lg bg-brand text-brand-ink grid place-items-center"><Sparkles size={16} /></span>
          <span className="font-semibold tracking-tight hidden sm:inline">Design Eser</span>
        </Link>
        <div className="flex-1 min-w-0 flex items-center gap-2">{children}</div>
        {mounted && (
          <button className="btn btn-ghost btn-sm" onClick={() => setOpenUsage(true)} title="الاستهلاك اليوم">
            <Gauge size={15} />
            <span className="mono text-xs">{fmtCost(today.cost)}</span>
            <span className="text-muted text-xs hidden md:inline">· {today.calls} طلب{today.hits ? ` · ${today.hits} من الكاش` : ''}</span>
          </button>
        )}
        <button className={`btn btn-sm ${noKey ? 'btn-accent' : 'btn-outline'}`} onClick={() => setOpenSettings(true)}>
          <Settings2 size={15} /> <span className="hidden sm:inline">{noKey ? 'أضف مفتاح API' : 'الإعدادات'}</span>
        </button>
      </div>
      <SettingsDialog open={openSettings} onClose={() => setOpenSettings(false)} />
      <UsageDialog open={openUsage} onClose={() => setOpenUsage(false)} />
    </header>
  );
}
