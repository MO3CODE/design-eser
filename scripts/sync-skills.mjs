#!/usr/bin/env node
// يسحب محركات التصميم من مجلد مهارات Claude إلى public/engines/<id>/ — نفس القوالب والخطوط والشعارات والمراجع.
// شغّله بعد أي تطوير للمهارات:  npm run sync
// المجلد: SKILLS_DIR أو %USERPROFILE%\.claude\skills
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
loadEnv(path.join(ROOT, '.env.local'));
loadEnv(path.join(ROOT, '.env'));
const SKILLS = process.env.SKILLS_DIR || path.join(os.homedir(), '.claude', 'skills');
const OUT = path.join(ROOT, 'public', 'engines');

// كل محرك: من وين ينسحب وشو يُنسخ (المجلدات بالكامل، أو ملفات/أنماط محددة)
const ENGINES = [
  {
    id: 'guzeleser', skill: 'guzeleser-post',
    copy: ['templates/post.html', 'brand.json', 'SKILL.md', 'references', 'examples/*.json',
      'assets/fonts', 'assets/icons', 'assets/logo', 'assets/textures'],
  },
  {
    id: 'investors-gate', skill: 'investors-gate',
    copy: ['templates/slide.html', 'brand.json', 'presets.json', 'SKILL.md',
      'references/*.md', 'examples/*.json', 'assets/fonts', 'assets/icons', 'assets/logo', 'assets/textures', 'assets/geo'],
  },
];

function loadEnv(f) {
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]] && m[2]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

function copyEntry(src, dst, entry) {
  const star = entry.indexOf('*');
  if (star >= 0) {   // نمط بسيط: dir/*.ext
    const dir = path.dirname(entry), ext = entry.slice(star + 1);
    const from = path.join(src, dir);
    if (!fs.existsSync(from)) return 0;
    let n = 0;
    for (const f of fs.readdirSync(from)) {
      if (!f.endsWith(ext) || !fs.statSync(path.join(from, f)).isFile()) continue;
      fs.mkdirSync(path.join(dst, dir), { recursive: true });
      fs.copyFileSync(path.join(from, f), path.join(dst, dir, f)); n++;
    }
    return n;
  }
  const from = path.join(src, entry);
  if (!fs.existsSync(from)) { console.warn(`  ⚠ غير موجود: ${entry}`); return 0; }
  if (fs.statSync(from).isDirectory()) {
    fs.cpSync(from, path.join(dst, entry), { recursive: true, filter: s => !/node_modules|__pycache__|[\\/]research[\\/]?/.test(s) });
    return fs.readdirSync(from).length;
  }
  fs.mkdirSync(path.dirname(path.join(dst, entry)), { recursive: true });
  fs.copyFileSync(from, path.join(dst, entry));
  return 1;
}

function hashDir(dir) {
  const h = crypto.createHash('md5');
  const walk = d => { for (const f of fs.readdirSync(d).sort()) {
    const p = path.join(d, f); const s = fs.statSync(p);
    if (s.isDirectory()) walk(p); else h.update(f + s.size + s.mtimeMs);
  } };
  walk(dir); return h.digest('hex').slice(0, 10);
}

console.log(`مجلد المهارات: ${SKILLS}`);
fs.mkdirSync(OUT, { recursive: true });
const index = { synced_at: new Date().toISOString(), engines: {} };
for (const e of ENGINES) {
  const src = path.join(SKILLS, e.skill);
  if (!fs.existsSync(src)) { console.warn(`✗ ${e.id}: المهارة ${e.skill} غير موجودة — تخطيت`); continue; }
  const dst = path.join(OUT, e.id);
  fs.rmSync(dst, { recursive: true, force: true });
  fs.mkdirSync(dst, { recursive: true });
  let n = 0;
  for (const c of e.copy) n += copyEntry(src, dst, c);
  // قائمة الملفات (المتصفح ما يقدر يسرد مجلد — المحرك يحتاج أسماء الشعارات مثلاً)
  const files = [];
  const walk = (d, rel = '') => { for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f), r = rel ? rel + '/' + f : f;
    if (fs.statSync(p).isDirectory()) walk(p, r); else files.push(r);
  } };
  walk(dst);
  fs.writeFileSync(path.join(dst, 'files.json'), JSON.stringify(files));
  index.engines[e.id] = { skill: e.skill, skill_dir: src, version: hashDir(dst) };
  console.log(`✓ ${e.id}  (${n} عنصر) ← ${e.skill}  [${index.engines[e.id].version}]`);
}
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index, null, 1));
console.log('تم. شغّل npm run dev');
