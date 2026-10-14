'use client';
import { create } from 'zustand';
import { saveProject } from './store';
import type { Photo, PlanItem, Project } from './types';

interface ProjectState {
  project: Project | null;
  selected: string | null;       // العنصر المفتوح
  checked: Set<string>;          // عناصر محددة للتصميم الجماعي
  busy: Record<string, string>;  // itemId → مرحلة العمل الحالية
  set: (p: Project | null) => void;
  patch: (p: Partial<Project>) => void;
  updateItem: (id: string, p: Partial<PlanItem> | ((it: PlanItem) => Partial<PlanItem>)) => void;
  updatePhoto: (p: Photo) => void;
  select: (id: string | null) => void;
  toggle: (id: string, on?: boolean) => void;
  setChecked: (ids: string[]) => void;
  setBusy: (id: string, stage: string | null) => void;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function autosave(p: Project | null) {
  if (!p) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveProject(p); }, 400);
}

export const useProject = create<ProjectState>((set, get) => ({
  project: null, selected: null, checked: new Set(), busy: {},
  set: project => set({ project, selected: project?.items[0]?.id ?? null, checked: new Set(), busy: {} }),
  patch: p => { const project = { ...get().project!, ...p }; set({ project }); autosave(project); },
  updateItem: (id, p) => {
    const cur = get().project; if (!cur) return;
    const items = cur.items.map(it => (it.id === id ? { ...it, ...(typeof p === 'function' ? p(it) : p) } : it));
    const project = { ...cur, items }; set({ project }); autosave(project);
  },
  updatePhoto: ph => {
    const cur = get().project; if (!cur) return;
    const project = { ...cur, photos: cur.photos.map(x => (x.id === ph.id ? ph : x)) }; set({ project }); autosave(project);
  },
  select: selected => set({ selected }),
  toggle: (id, on) => {
    const checked = new Set(get().checked);
    if (on ?? !checked.has(id)) checked.add(id); else checked.delete(id);
    set({ checked });
  },
  setChecked: ids => set({ checked: new Set(ids) }),
  setBusy: (id, stage) => {
    const busy = { ...get().busy };
    if (stage) busy[id] = stage; else delete busy[id];
    set({ busy });
  },
}));

export const currentItem = () => {
  const { project, selected } = useProject.getState();
  return project?.items.find(i => i.id === selected) || null;
};
