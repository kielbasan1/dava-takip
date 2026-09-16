import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

const dom = new JSDOM(html, {
  url: 'http://localhost:8080/index.html',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
});
const { window } = dom;
const { document } = window;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const assert = (name, cond, extra) => results.push({ name, ok: !!cond, extra: extra || '' });

await sleep(100);

assert('seed: kartlar oluştu', document.querySelectorAll('.card').length >= 3, 'kart=' + document.querySelectorAll('.card').length);
assert('panel 3 sekme var', document.querySelectorAll('.tab').length === 4);

document.querySelectorAll('.tab').forEach((b) => { if (b.dataset.tab === 'task') b.click(); });
await sleep(30);
assert('Görevler sekmesi filtreli', document.querySelectorAll('.card').length === 1, 'kart=' + document.querySelectorAll('.card').length);

document.getElementById('addBtn').click();
await sleep(30);
assert('modal açıldı', !document.getElementById('modal').classList.contains('hidden'));

window.document.getElementById('f1').value = 'Test Görevim';
const iso = new Date(Date.now() - 5 * 60000);
const p = (n) => String(n).padStart(2, '0');
window.document.getElementById('f3').value = `${iso.getFullYear()}-${p(iso.getMonth() + 1)}-${p(iso.getDate())}T${p(iso.getHours())}:${p(iso.getMinutes())}`;
document.getElementById('saveBtn').click();
await sleep(30);
assert('görev kaydedildi', document.querySelectorAll('.card').length === 2, 'kart=' + document.querySelectorAll('.card').length);

window.checkReminders();
await sleep(50);
const logItems = document.querySelectorAll('.log-item');
assert('hatırlatma ateşlendi (log)', logItems.length >= 1, 'log=' + logItems.length);
assert('toast gösterildi', document.querySelectorAll('.toast').length >= 1);

assert('countdown geçmiş işaretler', window.countdown(Date.now() - 60000) === 'SÜRESİ GEÇTİ');
assert('urgency overdue döner', window.urgency(Date.now() - 1000) === 'overdue');
assert('urgency critical döner', window.urgency(Date.now() + 60000) === 'critical');

let failed = 0;
for (const r of results) {
  console.log((r.ok ? 'PASS' : 'FAIL') + '  ' + r.name + (r.extra ? '  [' + r.extra + ']' : ''));
  if (!r.ok) failed++;
}
console.log('\n' + (results.length - failed) + '/' + results.length + ' geçti');
process.exit(failed ? 1 : 0);