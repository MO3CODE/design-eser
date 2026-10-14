'use client';
import { create } from 'zustand';
import { setLocalPrep } from '@/lib/engines';
import { setServerRender } from '@/lib/render/host';
import { refreshModels } from '@/lib/ai/client';

export interface Status {
  synced_at: string | null;
  engines: Record<string, { version: string; skill: string; local: boolean }>;
  chrome: boolean;
  localPrep: boolean;
  serverKey: boolean;
  appPass: boolean;
}

export const useStatus = create<{ status: Status | null; load: () => Promise<void> }>(set => ({
  status: null,
  load: async () => {
    try {
      const s: Status = await (await fetch('/api/status')).json();
      setLocalPrep(s.localPrep);
      setServerRender(s.chrome);
      set({ status: s });
      refreshModels();
    } catch { /* السيرفر مو جاهز */ }
  },
}));
