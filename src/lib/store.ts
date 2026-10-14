'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { get as idbGet, set as idbSet, del as idbDel, keys as idbKeys } from 'idb-keyval';
import type { Budget, Task } from './ai/router';
import type { ModelInfo } from './ai/models';
import type { Project, UsageEntry } from './types';

export interface Settings {
  apiKey: string;
  appPass: string;
  budget: Budget;
  overrides: Partial<Record<Task, string>>;
  concurrency: number;
  useCache: boolean;
  exportScale: 0 | 1 | 2 | 3;   // 0 = حسب المحرك (2× Güzel Eser · 3× بوابة المستثمر)
  preferServer: boolean;         // تصدير بكروم السيرفر (نفس دقة المهارة) لو متاح
}

interface SettingsState {
  settings: Settings;
  setSettings: (p: Partial<Settings>) => void;
}

export const useSettings = create<SettingsState>()(persist(
  set => ({
    settings: { apiKey: '', appPass: '', budget: 'balanced', overrides: {}, concurrency: 2, useCache: true, exportScale: 0, preferServer: true },
    setSettings: p => set(s => ({ settings: { ...s.settings, ...p } })),
  }),
  { name: 'de-settings' },
));

interface UsageState {
  log: UsageEntry[];
  models: ModelInfo[];
  add: (e: UsageEntry) => void;
  clear: () => void;
  setModels: (m: ModelInfo[]) => void;
}

export const useUsage = create<UsageState>()(persist(
  set => ({
    log: [], models: [],
    add: e => set(s => ({ log: [e, ...s.log].slice(0, 500) })),
    clear: () => set({ log: [] }),
    setModels: models => set({ models }),
  }),
  { name: 'de-usage', partialize: s => ({ log: s.log }) },
));

// ───── المشاريع (IndexedDB — الصور تكون كبيرة) ─────
export const blobs = {
  put: (key: string, b: Blob) => idbSet('blob:' + key, b),
  get: (key: string) => idbGet<Blob>('blob:' + key),
  del: (key: string) => idbDel('blob:' + key),
};

const urlCache = new Map<string, string>();
/** رابط blob: للصورة (يتخزن عشان ما نسوي روابط جديدة كل رسم) */
export async function blobUrl(key: string): Promise<string | null> {
  if (urlCache.has(key)) return urlCache.get(key)!;
  const b = await blobs.get(key);
  if (!b) return null;
  const u = URL.createObjectURL(b);
  urlCache.set(key, u);
  return u;
}

export async function listProjects(): Promise<Pick<Project, 'id' | 'name' | 'engine' | 'updatedAt' | 'items'>[]> {
  const ks = (await idbKeys()).filter(k => typeof k === 'string' && k.startsWith('project:')) as string[];
  const all = await Promise.all(ks.map(k => idbGet<Project>(k)));
  return all.filter((p): p is Project => !!p).sort((a, b) => b.updatedAt - a.updatedAt);
}
export const loadProject = (id: string) => idbGet<Project>('project:' + id);
export const saveProject = (p: Project) => idbSet('project:' + p.id, { ...p, updatedAt: Date.now() });
export async function deleteProject(p: Project) {
  for (const ph of p.photos) { await blobs.del(ph.key); if (ph.cut) await blobs.del(ph.cut.key); }
  await idbDel('project:' + p.id);
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
