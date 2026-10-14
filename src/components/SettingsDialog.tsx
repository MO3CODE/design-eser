'use client';
import { useState } from 'react';
import { keys as idbKeys, del as idbDel } from 'idb-keyval';
import { KeyRound, Route, Zap, Server, Check, X, Trash2 } from 'lucide-react';
import { useSettings, useUsage } from '@/lib/store';
import { CATALOG } from '@/lib/ai/models';
import { route, PROFILES, TASK_LABEL, type Task, type Budget } from '@/lib/ai/router';
import { refreshModels } from '@/lib/ai/client';
import { useStatus } from './status';
import { Modal, Segmented, Spinner, toast } from './ui';

const TASKS: Task[] = ['extract', 'describe', 'spec', 'edit', 'critique'];

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, setSettings } = useSettings();
  const models = useUsage(s => s.models);
  const status = useStatus(s => s.status);
  const [testing, setTesting] = useState(false);
  const list = models.length ? models : CATALOG;

  const test = async () => {
    setTesting(true);
    const n = await refreshModels();
    setTesting(false);
    toast(n ? `الاتصال شغال ✓ — ${n} موديل متاح بحسابك` : 'فشل الاتصال — تأكد من المفتاح', n ? 'ok' : 'err');
  };
  const clearCache = async () => {
    const ks = (await idbKeys()).filter(k => typeof k === 'string' && k.startsWith('ai:'));
    await Promise.all(ks.map(k => idbDel(k)));
    toast(`انمسح كاش الردود (${ks.length})`, 'ok');
  };

  return (
    <Modal open={open} onClose={onClose} title="الإعدادات" wide>
      <div className="space-y-7">
        <section>
          <h3 className="font-semibold text-sm flex items-center gap-2 mb-3"><KeyRound size={16} className="text-accent" /> اتصال RadoxAI</h3>
          <div className="grid sm:grid-cols-[1fr_auto] gap-2">
            <input className="input mono" type="password" dir="ltr" placeholder={status?.serverKey ? 'المفتاح محطوط بالسيرفر (.env) — اتركه فاضي' : 'cc_…'}
              value={settings.apiKey} onChange={e => setSettings({ apiKey: e.target.value.trim() })} autoComplete="off" />
            <button className="btn btn-outline" onClick={test} disabled={testing}>{testing ? <Spinner /> : <Zap size={15} />} اختبار</button>
          </div>
          <p className="text-xs text-muted mt-2 leading-relaxed">
            المفتاح ينحفظ بمتصفحك فقط ويمر عبر سيرفر الموقع لـ <span dir="ltr">radoxai.com/v1</span> — ما ينكشف للصفحات.
            للنشر على سيرفر عام حطه بـ <span className="mono">RADOX_API_KEY</span> مع <span className="mono">APP_PASSWORD</span>.
          </p>
          {status?.appPass && (
            <div className="mt-3">
              <label className="label">كلمة مرور الموقع</label>
              <input className="input" type="password" value={settings.appPass} onChange={e => setSettings({ appPass: e.target.value })} />
            </div>
          )}
        </section>

        <section>
          <h3 className="font-semibold text-sm flex items-center gap-2 mb-1"><Route size={16} className="text-accent" /> التنقل الذكي بين الموديلات</h3>
          <p className="text-xs text-muted mb-3 leading-relaxed">
            كل مهمة تبدأ بأرخص موديل يقدر يسويها صح، ويرتفع بس لما يكون المحتوى معقد (كاروسيل طويل) أو يفشل الرد بالتحقق.
            قراءة Excel ما تستهلك أي توكن، ووصف الصور ينحسب مرة وحدة ويُعاد استخدامه كنص.
          </p>
          <Segmented<Budget> value={settings.budget} onChange={budget => setSettings({ budget })} options={[
            { value: 'eco', label: 'اقتصادي', title: 'درجة أقل لكل مهمة + بدون أمثلة' },
            { value: 'balanced', label: 'متوازن', title: 'الافتراضي' },
            { value: 'quality', label: 'جودة', title: 'درجة أعلى + سجل ذوق العميل الحي' },
          ]} />
          <div className="mt-4 card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-xs text-ink-2">
                <tr><th className="text-start font-medium px-3 py-2">المهمة</th><th className="text-start font-medium px-3 py-2">الاختيار التلقائي</th><th className="text-start font-medium px-3 py-2">تثبيت يدوي</th></tr>
              </thead>
              <tbody>
                {TASKS.map(t => {
                  const auto = route(t, {}, { budget: settings.budget, available: models });
                  const needs = PROFILES[t].needs.filter(n => n !== 'json');
                  return (
                    <tr key={t} className="border-t border-line">
                      <td className="px-3 py-2.5 font-medium whitespace-nowrap">{TASK_LABEL[t]}</td>
                      <td className="px-3 py-2.5">
                        <div className="mono text-xs" dir="ltr" style={{ textAlign: 'right' }}>{auto.model.id}</div>
                        <div className="text-[11px] text-muted">${auto.model.in}/M · {PROFILES[t].why}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <select className="input h-8 text-xs" value={settings.overrides[t] || ''}
                          onChange={e => setSettings({ overrides: { ...settings.overrides, [t]: e.target.value || undefined } })}>
                          <option value="">تلقائي</option>
                          {list.filter(m => needs.every(n => m.caps.includes(n))).map(m => (
                            <option key={m.id} value={m.id}>{m.name} — ${m.in}/M</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 grid sm:grid-cols-2 gap-4">
            <label className="flex items-center justify-between gap-3 card px-3 py-2.5">
              <span className="text-sm">كاش الردود <span className="block text-[11px] text-muted">نفس الطلب = صفر توكن</span></span>
              <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={settings.useCache} onChange={e => setSettings({ useCache: e.target.checked })} />
            </label>
            <label className="flex items-center justify-between gap-3 card px-3 py-2.5">
              <span className="text-sm">تصاميم بالتوازي <span className="block text-[11px] text-muted">طلبات بنفس الوقت</span></span>
              <select className="input h-8 w-20" value={settings.concurrency} onChange={e => setSettings({ concurrency: +e.target.value })}>
                {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </div>
          <button className="btn btn-ghost btn-sm mt-2 text-err" onClick={clearCache}><Trash2 size={14} /> مسح كاش الردود</button>
        </section>

        <section>
          <h3 className="font-semibold text-sm flex items-center gap-2 mb-3"><Server size={16} className="text-accent" /> التصدير والبيئة</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">دقة التصدير</label>
              <Segmented<string> value={String(settings.exportScale)} onChange={v => setSettings({ exportScale: +v as 0 | 1 | 2 | 3 })} options={[
                { value: '0', label: 'حسب المهارة' }, { value: '1', label: '1×' }, { value: '2', label: '2×' }, { value: '3', label: '3×' },
              ]} size="sm" />
              <p className="text-[11px] text-muted mt-1.5">Güzel Eser 2× (2160×2700) · بوابة المستثمر 3× (3240×4050)</p>
            </div>
            <label className="flex items-center justify-between gap-3 card px-3 py-2.5 h-fit">
              <span className="text-sm">التصدير بكروم السيرفر <span className="block text-[11px] text-muted">نفس render.js بالمهارة — أدق</span></span>
              <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={settings.preferServer} onChange={e => setSettings({ preferServer: e.target.checked })} />
            </label>
          </div>
          <ul className="mt-4 grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
            <Env ok={!!status && Object.keys(status.engines).length > 0} label={`المحركات مسحوبة من المهارات${status?.synced_at ? ' · ' + new Date(status.synced_at).toLocaleString('ar') : ''}`} />
            <Env ok={!!status?.chrome} label="كروم للتصدير بالسيرفر" />
            <Env ok={!!status?.localPrep} label="قص المهارة المحلي (فوتوشوب + BiRefNet)" soft="وإلا BiRefNet بالمتصفح" />
            <Env ok={!!status?.serverKey || !!settings.apiKey} label="مفتاح API" />
          </ul>
        </section>
      </div>
    </Modal>
  );
}

function Env({ ok, label, soft }: { ok: boolean; label: string; soft?: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className={`size-5 rounded-full grid place-items-center ${ok ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn'}`}>{ok ? <Check size={12} /> : <X size={12} />}</span>
      <span className={ok ? '' : 'text-ink-2'}>{label}{!ok && soft ? <span className="text-muted"> — {soft}</span> : null}</span>
    </li>
  );
}
