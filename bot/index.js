'use strict';
const fs = require('fs');
const path = require('path');

const BOT_TOKEN = process.env.BOT_TOKEN || '';
if (!BOT_TOKEN) { console.error('BOT_TOKEN ortam değişkeni gerekli. Örn: BOT_TOKEN=123:ABC node bot/index.js'); process.exit(1); }
const API = 'https://api.telegram.org/bot' + BOT_TOKEN;
const DATA = path.join(__dirname, 'data.json');
const DAY_MS = 86400e3;

const store = (() => { try { return JSON.parse(fs.readFileSync(DATA, 'utf8')); } catch (e) { return { users: {} }; } })();
function save() { fs.writeFileSync(DATA, JSON.stringify(store, null, 2)); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
function user(chatId) { if (!store.users[chatId]) store.users[chatId] = { todos: [], hats: [], state: null }; return store.users[chatId]; }

async function api(method, body) {
  const res = await fetch(API + '/' + method, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
  if (!res || !res.ok) return null;
  return res.json();
}
const send = (cid, text, kb) => api('sendMessage', { chat_id: cid, text, parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: kb });
const editKb = (cid, msgId, text) => api('editMessageText', { chat_id: cid, message_id: msgId, text, parse_mode: 'HTML', disable_web_page_preview: true });

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function fmtDT(iso) { if (!iso) return '—'; const d = new Date(iso + 'T00:00:00'); if (isNaN(d)) return esc(iso); return d.toLocaleDateString('tr-TR'); }
function fmtAgo(epoch) {
  const ms = epoch - Date.now();
  if (ms <= 0) return '🟥 SÜRESİ GEÇTİ';
  if (ms < 3600e3) return '⏱ ' + Math.floor(ms / 60000) + ' dk sonra';
  if (ms < DAY_MS) return '⏰ ' + Math.floor(ms / 3600e3) + ' sa sonra';
  const days = Math.floor(ms / DAY_MS);
  return `📅 ${days} gün sonra (${new Date(epoch).toLocaleDateString('tr-TR')})`;
}
function parseWhen(s) {
  const m = String(s || '').trim().match(/^(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{2,4})\s*(?:(\d{1,2})[.:](\d{2}))?$/);
  if (!m) return null;
  let year = +m[3]; if (year < 100) year += 2000;
  const d = new Date(year, +m[2] - 1, +m[1], +(m[4] || 9), +(m[5] || 0));
  return isNaN(d.getTime()) ? null : d.getTime();
}
const dueFrom = (s) => { const t = parseWhen(s); return t === null ? null : t; };

function mainMenu() {
  return { inline_keyboard: [
    [{ text: '➕ Görev Ekle', callback_data: 'add' }, { text: '📋 Listele', callback_data: 'list' }],
    [{ text: '🔔 Hatırlatma Ekle', callback_data: 'hat_add' }, { text: '🔔 Hatırlatmalar', callback_data: 'hat_list' }],
    [{ text: '──ℹ ── Yardım', callback_data: 'help' }],
  ] };
}
const MENU_TEXT = '📌 <b>Görev ve Hatırlatma Botu</b>\n\nGörev ekle, listele, hatırlatma kur.\nKomutlar: /yeni, /liste, /hatirlat, /basla';

function todoListKB(list, prefix) {
  return list.length === 0 ? undefined : {
    inline_keyboard: list.map((t) => ([{ text: `${t.done ? '✅' : '⬜'} ${esc(t.name)}`, callback_data: 'x:' + prefix + ':' + t.id }])).concat([{ text: '◀ Menü', callback_data: 'menu' }]),
  };
}

/* ---------- Reminder loop ---------- */
let lastTick = Date.now();
function checkReminders() {
  const now = Date.now();
  for (const [cid, u] of Object.entries(store.users)) {
    for (const h of u.hats) {
      if (!h.fired && h.at <= now) {
        h.fired = true;
        const when = h.at - now <= 0 ? 'Şimdi' : fmtAgo(h.at);
        send(cid, '🔔 <b>' + esc(h.name) + '</b>\n' + when + '\n──────────\n' + (h.note ? ('<i>' + esc(h.note) + '</i>') : ''));
      }
    }
  }
  save();
}
setInterval(checkReminders, 30000);
setInterval(() => { if (Date.now() - lastTick > 240e3) { lastTick = Date.now(); checkReminders(); } }, DAY_MS);

/* ---------- Callback handling ---------- */
async function onCallback(upd) {
  const cid = upd.callback_query.message.chat.id;
  const msgId = upd.callback_query.message.message_id;
  const d = upd.callback_query.data;
  const u = user(cid);
  if (d === 'menu' || d === 'help') { editKb(cid, msgId, d === 'menu' ? MENU_TEXT : helpText()); return; }
  if (d === 'add') { u.state = { step: 'name', kind: 'todo' }; save(); await send(cid, '➕ Yeni görev\n<b>Görev adı:</b>'); return; }
  if (d === 'hat_add') { u.state = { step: 'name', kind: 'hat' }; save(); await send(cid, '🔔 Yeni hatırlatma\n<b>Başlık:</b>'); return; }
  if (d.startsWith('x:')) {
    const [, kind, id] = d.split(':');
    const arr = kind === 't' ? u.todos : u.hats;
    const it = arr.find((x) => x.id === id);
    if (it && kind === 't') it.done = !it.done;
    if (it && kind === 'h') it.fired = false;
    save();
    const prefix = kind === 't' ? 't' : 'h';
    await editKb(cid, msgId, kind === 't'
      ? '<b>📋 Görevlerim</b>\n──────────\n' + (u.todos.length ? u.todos.map((t, i) => `${i + 1}. ${t.done ? '✅' : '⬜'} ${esc(t.name)} — ${fmtAgo(t.at)}`).join('\n') : 'Kayıt yok.')
      : '<b>🔔 Hatırlatmalar</b>\n──────────\n' + (u.hats.length ? u.hats.map((t, i) => `${i + 1}. ${esc(t.name)} — ${t.fired ? 'tetiklendi' : fmtAgo(t.at)}`).join('\n') : 'Kayıt yok.'));
    return;
  }
  if (d.startsWith('del:')) {
    const [, kind, id] = d.split(':');
    const arr = kind === 't' ? u.todos : u.hats;
    const idx = arr.findIndex((x) => x.id === id);
    if (idx >= 0) { arr.splice(idx, 1); save(); }
    await send(cid, '🗑 Silindi.');
    if (kind === 't') await send(cid, '<b>📋 Görevlerim</b>\n──────────\n' + (u.todos.length ? u.todos.map((t, i) => `${i + 1}. ${t.done ? '✅' : '⬜'} ${esc(t.name)} — ${fmtAgo(t.at)}`).join('\n') : 'Kayıt yok.'), todoListKB(u.todos, 't'));
    if (kind === 'h') await send(cid, '<b>🔔 Hatırlatmalar</b>\n──────────\n' + (u.hats.length ? u.hats.map((t, i) => `${i + 1}. ${esc(t.name)} — ${t.fired ? 'tetiklendi' : fmtAgo(t.at)}`).join('\n') : 'Kayıt yok.'), todoListKB(u.hats, 'h'));
  }
}
function helpText() {
  return 'ℹ️ <b>Nasıl kullanılır?</b>\n\n' +
    '• <b>Görev</b>: ad + tarih (GG.AA.YYYY) ver, zamanı gelince hatırlatır.\n' +
    '• <b>Hatırlatma</b>: tek seferlik hatırlatma kurar.\n' +
    '• <b>Listele</b>: aktif/tamamlanan görevler.\n\n' +
    '<i>Örnek tarih: 25.12.2026 10:30</i>\n\nKomutlar: /yeni /liste /hatirlat /basla';
}

/* ---------- Message handling (flow) ---------- */
async function onMessage(upd) {
  const cid = upd.message.chat.id;
  const text = (upd.message.text || '').trim();
  const u = user(cid);

  if (!u.state && text === '/basla') { u.state = null; save(); await send(cid, MENU_TEXT, mainMenu()); return; }
  if (!u.state && (text === '/menu' || text === '/yardim')) { await send(cid, MENU_TEXT, mainMenu()); return; }
  if (!u.state && text === '/liste') { await send(cid, '<b>📋 Görevlerim</b>\n──────────\n' + (u.todos.length ? u.todos.map((t, i) => `${i + 1}. ${t.done ? '✅' : '⬜'} ${esc(t.name)} — ${fmtAgo(t.at)}`).join('\n') : 'Kayıt yok.'), todoListKB(u.todos, 't')); return; }
  if (!u.state && text === '/hatirlatlar') { await send(cid, '<b>🔔 Hatırlatmalar</b>\n──────────\n' + (u.hats.length ? u.hats.map((t, i) => `${i + 1}. ${esc(t.name)} — ${t.fired ? 'tetiklendi' : fmtAgo(t.at)}`).join('\n') : 'Kayıt yok.'), todoListKB(u.hats, 'h')); return; }

  if (!u.state && (text.startsWith('/yeni') || text.startsWith('/hatirlat'))) {
    const kind = text.startsWith('/yeni') ? 'todo' : 'hat';
    const rest = text.replace(/^\S+/, '').trim();
    if (rest) {
      const parts = rest.split('|').map((s) => s.trim());
      const name = parts[0] || '';
      const when = parts[1] || '';
      if (name && when) {
        const at = dueFrom(when); if (!at) return send(cid, '⚠️ Tarih formatı hatalı. Örn: 25.12.2026 10:30');
        if (kind === 'todo') u.todos.push({ id: uid(), name, at, done: false });
        else u.hats.push({ id: uid(), name, at, fired: false, note: '' });
        save(); return send(cid, '✅ Eklendi: <b>' + esc(name) + '</b> → ' + fmtAgo(at));
      }
    }
    u.state = { step: 'name', kind }; save(); return send(cid, kind === 'todo' ? '➕ Yeni görev\n<b>Görev adı:</b>' : '🔔 Yeni hatırlatma\n<b>Başlık:</b>');
  }

  if (u.state) {
    const s = u.state;
    const step = s.step;
    const val = text;

    if (step === 'name') {
      if (!val) return send(cid, 'Boş olamaz, tekrar girin:');
      s.name = val; s.step = 'when'; save();
      return send(cid, (s.kind === 'todo' ? '📝 <b>' + esc(val) + '</b>\nSon tarih (GG.AA.YYYY [Sa:dk]):' : '🔔 <b>' + esc(val) + '</b>\nHatırlatma zamanı (GG.AA.YYYY [Sa:dk]):'), undefined);
    }
    if (step === 'when') {
      const at = dueFrom(val);
      if (!at) return send(cid, '⚠️ Tarih formatı şöyle olmalı: 25.12.2026 10:30 — tekrar yazın (örn: <b>25.12.2026 10:30</b>)');
      if (s.kind === 'todo') u.todos.push({ id: uid(), name: s.name, at, done: false });
      else u.hats.push({ id: uid(), name: s.name, at, fired: false, note: '' });
      u.state = null; save();
      await send(cid, '✅ Kaydedildi\n<b>' + esc(s.name) + '</b>\n' + fmtAgo(at));
      return send(cid, MENU_TEXT, mainMenu());
    }
    if (val === '/iptal') { u.state = null; save(); return send(cid, 'İptal edildi. /basla'); }
  }

  await send(cid, MENU_TEXT, mainMenu());
}

/* ---------- Polling ---------- */
let offset = 0;
async function poll() {
  try {
    const res = await fetch(API + '/getUpdates?timeout=50&offset=' + offset).catch(() => null);
    if (!res || !res.ok) return;
    const j = await res.json();
    if (!j.ok || !j.result || !j.result.length) return;
    for (const upd of j.result) {
      offset = Math.max(offset, upd.update_id + 1);
      try {
        if (upd.callback_query) await onCallback(upd);
        else if (upd.message && upd.message.text) await onMessage(upd);
      } catch (e) { try { send(upd.message ? upd.message.chat.id : upd.callback_query.message.chat.id, '⚠️ İşlem sırasında hata: ' + String(e.message || e)); } catch (_) {} }
    }
  } catch (e) { /* ağ hatası, yinele */ }
}
setInterval(poll, 1500);
poll();
console.log('Bot çalışıyor → @' + BOT_TOKEN.split(':')[0]);
console.log('Durdurmak için Ctrl+C');