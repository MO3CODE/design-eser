'use client';
// قراءة الخطة: Excel/CSV (بدون AI — صفر توكن) · Word/نص/Markdown (AI رخيص يستخرج العناصر) · JSON جاهز.
import { callAI } from '../ai/client';
import { uid } from '../store';
import type { EngineId, PlanItem } from '../types';

type Field = 'title' | 'content' | 'caption' | 'kind' | 'date' | 'platform' | 'notes' | 'price';

const SYN: Record<Field, string[]> = {
  content: ['المحتوى للتصميم', 'محتوى التصميم', 'نص التصميم', 'المحتوى', 'content', 'design', 'içerik', 'icerik', 'metin', 'النص', 'copy', 'text'],
  title: ['العنوان', 'عنوان', 'title', 'başlık', 'baslik', 'الموضوع', 'topic', 'subject', 'الفكرة', 'konu'],
  caption: ['الكابشن', 'كابشن', 'caption', 'açıklama', 'aciklama', 'وصف المنشور', 'التعليق'],
  kind: ['نوع المحتوى', 'النوع', 'content type', 'type', 'format', 'الشكل', 'tür', 'tur', 'biçim'],
  date: ['تاريخ النشر', 'النشر', 'التاريخ', 'publish', 'date', 'tarih', 'اليوم', 'gün'],
  platform: ['المنصة', 'platform', 'kanal'],
  notes: ['ملاحظات المصمم', 'ملاحظات', 'notes', 'note', 'notlar', 'تعليمات', 'توجيه'],
  price: ['السعر', 'المبلغ', 'price', 'fiyat', 'bedel', 'التكلفة'],
};

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase().replace(/[ً-ْ]/g, '');

export function normKind(s: string): string {
  const t = norm(s);
  if (/carousel|كاروس|كاروسيل|سلايد|شرائح|slide|karusel/.test(t)) return 'carousel';
  if (/story|ستوري|استوري|hikaye/.test(t)) return 'story';
  if (/reel|ريل|ريلز|فيديو|video|thumbnail|ثمبيل|غلاف/.test(t)) return 'reel_cover';
  if (/poster|بوستر|انفوجراف|إنفوجراف|infograph/.test(t)) return 'poster';
  return 'post';
}

function mapHeader(row: unknown[]): Partial<Record<Field, number>> {
  const m: Partial<Record<Field, number>> = {};
  const used = new Set<number>();
  // الأدق أولاً: «المحتوى للتصميم» قبل «المحتوى»
  for (const f of Object.keys(SYN) as Field[]) {
    for (const syn of SYN[f]) {
      const i = row.findIndex((c, j) => !used.has(j) && norm(c) && (norm(c) === norm(syn) || norm(c).includes(norm(syn))));
      if (i >= 0) { m[f] = i; used.add(i); break; }
    }
  }
  return m;
}

function newItem(n: number, p: Partial<PlanItem>): PlanItem {
  return {
    id: uid(), n, title: '', content: '', kind: 'post', photoIds: [], status: 'idle', history: [], ...p,
  };
}

const cellStr = (v: unknown) => v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? '').trim();

export async function parseSheet(file: File, engine: EngineId): Promise<PlanItem[]> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
  const items: PlanItem[] = [];
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: '', raw: true });
    const hi = rows.findIndex(r => r.filter(c => cellStr(c)).length >= 2);
    if (hi < 0) continue;
    const header = rows[hi];
    let map = mapHeader(header);
    // تقويم بوابة المستثمر الأصلي (calendar.py): أعمدة بالترتيب
    if (map.title == null && map.content == null && engine === 'investors-gate' && header.length >= 6)
      map = { kind: 0, platform: 1, title: 3, content: 4, caption: 5, date: 8, notes: 10 };
    if (map.title == null && map.content == null) continue;
    for (const r of rows.slice(hi + 1)) {
      const get = (f: Field) => (map[f] != null ? cellStr(r[map[f]!]) : '');
      const title = get('title'), content = get('content');
      if (!title && !content) continue;
      const raw: Record<string, string> = {};
      header.forEach((h, j) => { const v = cellStr(r[j]); if (cellStr(h) && v) raw[cellStr(h)] = v; });
      items.push(newItem(items.length + 1, {
        title: title || content.split('\n')[0].slice(0, 80), content: content || title,
        caption: get('caption'), kind: normKind(get('kind') || content), date: get('date'),
        platform: get('platform'), notes: get('notes'), price: get('price'), raw,
      }));
    }
    if (items.length) break;   // أول ورقة فيها خطة
  }
  return items;
}

export async function fileToText(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'docx') {
    const mammoth = await import('mammoth');
    const r = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return r.value;
  }
  return file.text();
}

const EXTRACT_SYS = `أنت محلل خطط محتوى سوشال ميديا. حوّل الخطة لعناصر JSON — عنصر لكل منشور/تصميم.
القواعد:
- انقل النص حرفياً (لا تعيد الصياغة ولا تختصر)، فقط افصل الحقول.
- kind واحد من: post, carousel, story, reel_cover, poster. الكاروسيل: احتفظ بفواصل الشرائح كما هي بالمحتوى.
- لو فيه سعر/مبلغ ضعه في price. ملاحظات التصميم/التوجيهات في notes.
- لا تخترع عناصر غير موجودة.
أرجع فقط: {"items":[{"title":"","content":"","caption":"","kind":"post","date":"","platform":"","notes":"","price":""}]}`;

/** خطة نص حر → عناصر (موديل رخيص، مقسّمة لأجزاء لو طويلة) */
export async function extractWithAI(text: string, onProgress?: (s: string) => void): Promise<PlanItem[]> {
  const chunks: string[] = [];
  const paras = text.split(/\n{2,}/);
  let cur = '';
  for (const p of paras) {
    if ((cur + p).length > 14_000 && cur) { chunks.push(cur); cur = ''; }
    cur += p + '\n\n';
  }
  if (cur.trim()) chunks.push(cur);
  const out: PlanItem[] = [];
  for (let i = 0; i < chunks.length; i++) {
    onProgress?.(`قراءة الخطة ${i + 1}/${chunks.length}`);
    const r = await callAI<{ items: Partial<PlanItem>[] }>({
      task: 'extract', system: EXTRACT_SYS, user: chunks[i], json: true,
      complexity: { chars: chunks[i].length },
      validate: d => Array.isArray((d as { items?: unknown })?.items) ? null : 'ناقص items',
    });
    for (const it of r.data.items) {
      if (!it.title && !it.content) continue;
      out.push(newItem(out.length + 1, {
        title: String(it.title || '').trim() || String(it.content || '').slice(0, 80),
        content: String(it.content || it.title || ''), caption: it.caption || '', kind: normKind(it.kind || 'post'),
        date: it.date || '', platform: it.platform || '', notes: it.notes || '', price: it.price || '',
      }));
    }
  }
  return out;
}

export async function parsePlanFile(file: File, engine: EngineId, onProgress?: (s: string) => void): Promise<PlanItem[]> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (['xlsx', 'xls', 'csv', 'ods'].includes(ext)) {
    const items = await parseSheet(file, engine);
    if (items.length) return items;
  }
  if (ext === 'json') {
    const j = JSON.parse(await file.text());
    const arr = Array.isArray(j) ? j : j.items || j.posts || [];
    if (arr.length) return arr.map((it: Partial<PlanItem>, i: number) => newItem(i + 1, {
      ...it, title: it.title || '', content: it.content || it.title || '', kind: normKind(it.kind || 'post'), photoIds: [], history: [],
    }));
  }
  const text = await fileToText(file);
  return extractWithAI(text, onProgress);
}
