import type { Task } from './ai/router';

export type EngineId = 'guzeleser' | 'investors-gate';

/** عنصر من الخطة = منشور واحد (أو كاروسيل) */
export interface PlanItem {
  id: string;
  n: number;                    // ترتيبه بالخطة
  title: string;
  content: string;              // المحتوى للتصميم (حرفي من الخطة)
  caption?: string;
  kind: string;                 // post · carousel · story · reel_cover · poster · ...
  date?: string;
  platform?: string;
  notes?: string;               // ملاحظات المصمم
  price?: string;
  raw?: Record<string, string>; // صف الإكسل الأصلي
  photoIds: string[];           // صور مختارة لهذا العنصر
  status: 'idle' | 'queued' | 'designing' | 'ready' | 'error';
  error?: string;
  spec?: Record<string, unknown>;
  history: Record<string, unknown>[];  // نسخ سابقة للتراجع
  qc?: Record<string, unknown>;
  thumb?: string;               // معاينة صغيرة (dataURL)
  model?: string;               // آخر موديل صمّمه
  aiNotes?: string;             // ملاحظة الموديل عن قراراته/النواقص
}

export interface PhotoCut {
  key: string;                  // مفتاح الـblob بالتخزين (PNG شفاف)
  info: Record<string, unknown>; // نفس info.json بالمهارة (cut, top_profile, cx, faces, touches_*)
  engine: string;               // local-skill · browser-birefnet
  check?: string;               // cut_check (dataURL)
}

export interface Photo {
  id: string;
  name: string;
  key: string;                  // blob الأصلي
  w: number; h: number;
  thumb: string;                // dataURL ~360px
  desc?: PhotoDesc;             // وصف الرؤية (ينحفظ ويُعاد استخدامه كنص — يوفر توكن)
  cut?: PhotoCut;
}

export interface PhotoDesc {
  summary: string;
  people: number;
  subjects: string[];
  orientation: 'portrait' | 'landscape' | 'square';
  cutout_ok: boolean;
  mood?: string;
  issues?: string[];
}

export interface Project {
  id: string;
  name: string;
  engine: EngineId;
  createdAt: number;
  updatedAt: number;
  source?: string;              // اسم ملف الخطة
  brief?: string;               // توجيه عام للمشروع
  items: PlanItem[];
  photos: Photo[];
}

export interface UsageEntry {
  id: string;
  at: number;
  task: Task;
  model: string;
  tier: number;
  reason: string;
  pin: number;
  pout: number;
  cost: number;
  cached: boolean;
  ok: boolean;
  ms: number;
  note?: string;
}
