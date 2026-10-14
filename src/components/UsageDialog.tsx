'use client';
import { useMemo } from 'react';
import { useUsage } from '@/lib/store';
import { CATALOG, cost } from '@/lib/ai/models';
import { TASK_LABEL } from '@/lib/ai/router';
import { Modal, fmtCost, fmtTok } from './ui';

export function UsageDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { log, clear } = useUsage();
  const sum = useMemo(() => {
    const live = log.filter(e => !e.cached && e.ok);
    const total = live.reduce((a, e) => a + e.cost, 0);
    const tokens = live.reduce((a, e) => a + e.pin + e.pout, 0);
    // كم كان بيكلف لو كل شي راح لـ Claude Opus؟ (مقياس التوفير من التنقل الذكي)
    const opus = CATALOG.find(m => m.id === 'claude-opus-5.5');
    const allTop = live.reduce((a, e) => a + cost(opus, e.pin, e.pout), 0);
    const byModel: Record<string, { n: number; cost: number; tok: number }> = {};
    for (const e of live) {
      const b = (byModel[e.model] ||= { n: 0, cost: 0, tok: 0 });
      b.n++; b.cost += e.cost; b.tok += e.pin + e.pout;
    }
    return { total, tokens, allTop, hits: log.filter(e => e.cached).length, fails: log.filter(e => !e.ok).length, byModel };
  }, [log]);

  return (
    <Modal open={open} onClose={onClose} title="الاستهلاك والتكلفة" wide>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Stat label="التكلفة" value={fmtCost(sum.total)} />
        <Stat label="التوكن" value={fmtTok(sum.tokens)} />
        <Stat label="من الكاش" value={String(sum.hits)} hint="طلبات مجانية" />
        <Stat label="التوفير بالتوجيه" value={sum.allTop > 0 ? `${Math.round((1 - sum.total / sum.allTop) * 100)}%` : '—'} hint="مقابل Opus لكل شي" />
      </div>
      {Object.keys(sum.byModel).length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {Object.entries(sum.byModel).sort((a, b) => b[1].cost - a[1].cost).map(([m, b]) => (
            <span key={m} className="chip bg-surface-2 border border-line h-6 px-2.5"><span className="mono" dir="ltr">{m}</span> · {b.n} · {fmtCost(b.cost)}</span>
          ))}
        </div>
      )}
      <div className="card overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-surface-2 text-ink-2">
            <tr>{['الوقت', 'المهمة', 'الموديل', 'السبب', 'توكن', 'التكلفة'].map(h => <th key={h} className="text-start font-medium px-3 py-2">{h}</th>)}</tr>
          </thead>
          <tbody>
            {log.slice(0, 120).map(e => (
              <tr key={e.id} className={`border-t border-line ${!e.ok ? 'bg-err-soft/50' : ''}`}>
                <td className="px-3 py-2 whitespace-nowrap text-muted">{new Date(e.at).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}</td>
                <td className="px-3 py-2 whitespace-nowrap">{TASK_LABEL[e.task]}</td>
                <td className="px-3 py-2 mono whitespace-nowrap" dir="ltr" style={{ textAlign: 'right' }}>{e.model}</td>
                <td className="px-3 py-2 text-ink-2">{e.cached ? <span className="chip bg-ok-soft text-ok">كاش</span> : e.note ? <span className="text-err">{e.note}</span> : e.reason}</td>
                <td className="px-3 py-2 mono whitespace-nowrap">{e.cached ? '—' : `${fmtTok(e.pin)}/${fmtTok(e.pout)}`}</td>
                <td className="px-3 py-2 mono whitespace-nowrap">{fmtCost(e.cost)}</td>
              </tr>
            ))}
            {!log.length && <tr><td colSpan={6} className="px-3 py-8 text-center text-muted">ما فيه طلبات بعد</td></tr>}
          </tbody>
        </table>
      </div>
      {log.length > 0 && <button className="btn btn-ghost btn-sm mt-3 text-err" onClick={clear}>مسح السجل</button>}
    </Modal>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card px-3.5 py-3">
      <div className="text-xs text-ink-2">{label}</div>
      <div className="text-xl font-semibold mono mt-0.5">{value}</div>
      {hint && <div className="text-[11px] text-muted">{hint}</div>}
    </div>
  );
}
