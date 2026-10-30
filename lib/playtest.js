/* AvastFall Playtest – ส่วนเซิร์ฟเวอร์ของเกมทดลองเล่น (ย้ายมาจาก server.js ของ AvastFallTCGsim เดิม ไม่แก้ตรรกะ)
   - POST /api/feedback        รับข้อเสนอแนะจากผู้เล่น (สาธารณะ)
   - GET  /recommece           หน้าสำหรับเจ้าของไว้อ่านข้อเสนอแนะทั้งหมด (/recommend ใช้ได้เหมือนกัน)
   - GET  /api/feedback        ข้อมูลดิบ JSON (ต้องใส่ key ถ้าตั้ง ADMIN_KEY)
   - /api/room/*               ห้องออนไลน์เล่นกับเพื่อน (SSE + POST)

   ใช้เป็น middleware ของ Express: app.use(playtest.middleware)  (ต้องวางก่อน compression / express.json
   เพราะ SSE ห้ามถูกบีบอัด และ body ของห้องใหญ่กว่าที่ express.json รับ)

   ตั้งค่าด้วย environment variable
     ADMIN_KEY   รหัสเข้าดูหน้า /recommece?key=...  ถ้าเว้นว่างทุกคนที่รู้ลิงก์ดูได้ (แต่ลบไม่ได้)
                 (แยกจาก ADMIN_PASSWORD ของ /admin เพราะ key นี้ไปอยู่ใน URL)
     DATA_DIR    โฟลเดอร์เก็บข้อมูล (ค่าเริ่มต้น ./data) เก็บ feedback.json ตรงนี้
     RESEND_API_KEY / NOTIFY_EMAIL / MAIL_FROM   อีเมลสำเนาข้อเสนอแนะ */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const FILE = path.join(DATA_DIR, 'feedback.json');
const CATS = { suggest: 'ข้อเสนอแนะ', bug: 'พบข้อผิดพลาด', card: 'เรื่องการ์ด/เอฟเฟกต์', rule: 'เรื่องกติกา', other: 'อื่น ๆ' };
const MAX_ITEMS = 5000;
const NOTIFY_TO = process.env.NOTIFY_EMAIL || 'saknarinnumber8@gmail.com';   // อีเมลที่รับสำเนาทุกครั้ง
const RESEND_KEY = process.env.RESEND_API_KEY || '';                        // คีย์จาก resend.com
const MAIL_FROM = process.env.MAIL_FROM || 'AvastFall Feedback <onboarding@resend.dev>';

/* ---------------------------------------------------------------- storage */
let items = [];
try { items = JSON.parse(fs.readFileSync(FILE, 'utf8')); if (!Array.isArray(items)) items = []; } catch (e) { items = []; }
function save() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(items, null, 1));
  fs.renameSync(tmp, FILE);
}

/* ---------------------------------------------------------------- helpers */
const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const clip = (v, n) => String(v ?? '').replace(/\r/g, '').trim().slice(0, n);
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const isAdmin = (u, req) => !ADMIN_KEY || same(u.searchParams.get('key') || req.headers['x-admin-key'] || '', ADMIN_KEY);
const canDelete = (u, req) => !!ADMIN_KEY && isAdmin(u, req);
const ipOf = req => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
const hits = new Map();   // ip -> เวลาที่ส่งล่าสุด (กันสแปม 5 ครั้ง / 10 นาที)
function limited(ip) {
  const now = Date.now(), arr = (hits.get(ip) || []).filter(t => now - t < 600000);
  if (arr.length >= 5) { hits.set(ip, arr); return true; }
  arr.push(now); hits.set(ip, arr); return false;
}
function body(req, max = 8192) {
  return new Promise((res, rej) => {
    let n = 0; const ch = [];
    req.on('data', c => { n += c.length; if (n > max) { rej(new Error('too large')); req.destroy(); } else ch.push(c); });
    req.on('end', () => res(Buffer.concat(ch).toString('utf8')));
    req.on('error', rej);
  });
}
const send = (res, code, type, text, extra = {}) => { res.writeHead(code, Object.assign({ 'content-type': type, 'cache-control': 'no-store' }, extra)); res.end(text); };
const json = (res, code, obj, extra) => send(res, code, 'application/json; charset=utf-8', JSON.stringify(obj), extra);

/* ---------------------------------------------------------------- อีเมลสำเนา (Resend HTTP API เพราะ Render ฟรีบล็อก SMTP) */
async function sendMail(subject, html) {
  if (!RESEND_KEY) return { ok: false, error: 'ยังไม่ได้ตั้ง RESEND_API_KEY' };
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'authorization': 'Bearer ' + RESEND_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ from: MAIL_FROM, to: [NOTIFY_TO], subject, html })
    });
    const text = await r.text();
    if (!r.ok) { console.error('ส่งอีเมลไม่สำเร็จ', r.status, text); return { ok: false, status: r.status, error: text }; }
    console.log('ส่งอีเมลสำเร็จ ->', NOTIFY_TO, text);
    return { ok: true, status: r.status, to: NOTIFY_TO, from: MAIL_FROM, resend: text };
  } catch (err) { console.error('ส่งอีเมลไม่สำเร็จ', err.message); return { ok: false, error: err.message }; }
}
async function notify(it) {
  if (!RESEND_KEY) { console.warn('ยังไม่ได้ตั้ง RESEND_API_KEY จึงไม่ส่งอีเมล'); return; }
  const cat = CATS[it.category] || it.category;
  const ctx = Object.entries(it.context || {}).map(([k, v]) => esc(k) + ': ' + esc(v)).join(' · ');
  await sendMail('[AvastFall] ' + cat + ' - ' + it.text.slice(0, 50).replace(/\n/g, ' '),
    '<p><b>' + esc(cat) + '</b> · จาก: ' + esc(it.name || 'ไม่ระบุชื่อ') + (it.contact ? ' · ติดต่อ: ' + esc(it.contact) : '') + '</p><p style="white-space:pre-wrap">' + esc(it.text) + '</p><p style="color:#888">' + ctx + '</p>');
}

/* ---------------------------------------------------------------- หน้า /recommece */
function page(u, req) {
  const key = u.searchParams.get('key') || '';
  const q = key ? `key=${encodeURIComponent(key)}&` : '';
  const cat = u.searchParams.get('cat') || '';
  const list = items.filter(i => !cat || i.category === cat).slice().reverse();
  const del = canDelete(u, req);
  const counts = {}; for (const i of items) counts[i.category] = (counts[i.category] || 0) + 1;
  const fmt = t => new Date(t).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' });
  const chips = [['', 'ทั้งหมด', items.length], ...Object.entries(CATS).map(([k, v]) => [k, v, counts[k] || 0])]
    .map(([k, v, n]) => `<a class="chip ${cat === k ? 'on' : ''}" href="/recommece?${q}${k ? 'cat=' + k : ''}">${esc(v)} <b>${n}</b></a>`).join('');
  const cards = list.map(i => `<article class="fb">
    <header><span class="tag ${esc(i.category)}">${esc(CATS[i.category] || i.category)}</span><time>${esc(fmt(i.at))}</time>
    <span class="who">${esc(i.name || 'ไม่ระบุชื่อ')}${i.contact ? ' · ' + esc(i.contact) : ''}</span></header>
    <p>${esc(i.text)}</p>
    ${i.context && Object.keys(i.context).length ? `<small>${Object.entries(i.context).map(([k, v]) => esc(k) + ': ' + esc(v)).join(' · ')}</small>` : ''}
    ${del ? `<form method="post" action="/recommece/delete?${q}" onsubmit="return confirm('ลบข้อความนี้?')"><input type="hidden" name="id" value="${esc(i.id)}"><button>ลบ</button></form>` : ''}
  </article>`).join('') || '<p class="empty">ยังไม่มีข้อเสนอแนะ</p>';
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>ข้อเสนอแนะจากผู้ทดลองเล่น</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Mali:wght@600;700&family=Noto+Sans+Thai:wght@400;500;600&display=swap">
<style>
:root{--paper:#f7f6f0;--panel:#fff;--ink:#173646;--ink2:#5a7280;--coral:#e4604a;--soft:#d9e0dc}
@media (prefers-color-scheme:dark){:root{--paper:#11181c;--panel:#1a252b;--ink:#e8f0f2;--ink2:#9bb2bc;--coral:#f27d66;--soft:#2a3a42}}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.6 'Noto Sans Thai',Tahoma,sans-serif;padding:16px}
.wrap{max-width:860px;margin:0 auto}h1{font:700 26px 'Mali','Noto Sans Thai',sans-serif;margin:8px 0}
.top{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between}
a{color:var(--coral)}.muted{color:var(--ink2)}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}
.chip{border:2px solid var(--ink);border-radius:99px;padding:2px 12px;text-decoration:none;color:var(--ink);background:var(--panel);font-weight:500}
.chip.on{background:var(--ink);color:var(--paper)}
.fb{background:var(--panel);border:2px solid var(--ink);border-radius:12px;padding:12px 14px;margin:12px 0;box-shadow:3px 3px 0 var(--ink)}
.fb header{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;font-size:13px;color:var(--ink2)}
.tag{background:var(--coral);color:#fff;border-radius:6px;padding:0 8px;font-weight:600}.tag.bug{background:#c0392b}.tag.card{background:#2d8f83}.tag.rule{background:#b98a00}.tag.other{background:#6b7f8a}
.fb p{margin:8px 0;white-space:pre-wrap;word-break:break-word}.fb small{color:var(--ink2)}
.fb form{margin-top:6px}.fb button{border:2px solid var(--ink);background:var(--panel);color:var(--ink);border-radius:8px;padding:2px 12px;cursor:pointer}
.empty{padding:30px;text-align:center;color:var(--ink2)}
</style></head><body><div class="wrap">
<div class="top"><h1>ข้อเสนอแนะจากผู้ทดลองเล่น</h1><span><a href="/">← กลับหน้าเกม</a> · <a href="/api/feedback?${q}download=1">ดาวน์โหลด JSON</a></span></div>
<p class="muted">ทั้งหมด ${items.length} รายการ · เรียงจากใหม่ไปเก่า${ADMIN_KEY ? '' : ' · ยังไม่ได้ตั้ง ADMIN_KEY ทุกคนที่รู้ลิงก์นี้เปิดอ่านได้ และลบไม่ได้'}</p>
<div class="chips">${chips}</div>${cards}</div></body></html>`;
}

/* ---------------------------------------------------------------- ห้องออนไลน์ (เล่นกับเพื่อน)
   เซิร์ฟเวอร์ไม่รู้กติกาเกม ทำหน้าที่แค่ส่งต่อ "ตัวเลือกที่ผู้เล่นกด" ระหว่างสองฝั่ง (SSE + POST)
   ทั้งสองเบราว์เซอร์รัน engine เดียวกันด้วย seed เดียวกัน (lockstep) ห้องเก็บในหน่วยความจำ รีสตาร์ตแล้วหาย */
const rooms = new Map();
const CODE_CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_ROOMS = 300;
function newCode() { for (let t = 0; t < 50; t++) { let c = ''; for (let i = 0; i < 5; i++) c += CODE_CH[crypto.randomInt(CODE_CH.length)]; if (!rooms.has(c)) return c; } return null; }
const mkPlayer = () => ({ token: crypto.randomBytes(12).toString('hex'), out: [], seq: 0, res: null, lastN: 0, ready: null, online: false });
function push(room, i, obj) {
  const p = room.pl[i]; if (!p) return;
  const id = ++p.seq, data = JSON.stringify(obj);
  p.out.push({ id, data }); if (p.out.length > 4000) p.out.shift();
  if (p.res) { try { p.res.write('id: ' + id + '\ndata: ' + data + '\n\n'); } catch (e) { } }
}
const roomOf = (code, pid, token) => {
  const r = rooms.get(String(code || '').toUpperCase()); pid = +pid;
  if (!r || (pid !== 0 && pid !== 1) || !r.pl[pid] || !same(token || '', r.pl[pid].token)) return null;
  r.at = Date.now(); return r;
};
setInterval(() => {
  const now = Date.now();
  for (const [c, r] of rooms) {
    for (const p of r.pl) if (p && p.res) { try { p.res.write(': ping\n\n'); } catch (e) { } }
    const anyOn = r.pl.some(p => p && p.online);
    if (now - r.at > 3 * 3600e3 || (!anyOn && now - r.at > 15 * 60e3)) { for (const p of r.pl) if (p && p.res) { try { p.res.end(); } catch (e) { } } rooms.delete(c); }
  }
}, 15000).unref();

async function roomRoute(u, req, res) {
  const path_ = u.pathname;
  if (path_ === '/api/room/create' && req.method === 'POST') {
    if (rooms.size >= MAX_ROOMS) return json(res, 503, { ok: false, error: 'ห้องเต็มชั่วคราว ลองใหม่ภายหลัง' });
    const code = newCode(); if (!code) return json(res, 503, { ok: false, error: 'สร้างห้องไม่ได้' });
    const room = { code, at: Date.now(), pl: [mkPlayer(), null], started: false };
    rooms.set(code, room);
    return json(res, 200, { ok: true, code, pid: 0, token: room.pl[0].token });
  }
  if (path_ === '/api/room/join' && req.method === 'POST') {
    let d; try { d = JSON.parse(await body(req)); } catch (e) { return json(res, 400, { ok: false, error: 'ข้อมูลไม่ถูกต้อง' }); }
    const room = rooms.get(String(d.code || '').trim().toUpperCase());
    if (!room) return json(res, 404, { ok: false, error: 'ไม่พบห้องนี้ (ตรวจรหัสอีกครั้ง)' });
    if (room.pl[1]) return json(res, 409, { ok: false, error: 'ห้องนี้มีผู้เล่นครบสองคนแล้ว' });
    room.pl[1] = mkPlayer(); room.at = Date.now();
    return json(res, 200, { ok: true, code: room.code, pid: 1, token: room.pl[1].token });
  }
  if (path_ === '/api/room/events' && req.method === 'GET') {
    const room = roomOf(u.searchParams.get('code'), u.searchParams.get('pid'), u.searchParams.get('token'));
    if (!room) return send(res, 404, 'text/plain; charset=utf-8', 'ไม่พบห้อง');
    const me = +u.searchParams.get('pid'), you = 1 - me, p = room.pl[me];
    res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache, no-transform', 'connection': 'keep-alive', 'x-accel-buffering': 'no' });
    res.write('retry: 2000\n\n');
    const last = +(req.headers['last-event-id'] || u.searchParams.get('last') || 0) || 0;
    for (const m of p.out) if (m.id > last) res.write('id: ' + m.id + '\ndata: ' + m.data + '\n\n');
    if (p.res && p.res !== res) { try { p.res.end(); } catch (e) { } }
    p.res = res; p.online = true;
    push(room, you, { t: 'peer', online: true });
    push(room, me, { t: 'peer', online: !!(room.pl[you] && room.pl[you].online) });
    req.on('close', () => {
      if (p.res !== res) return;
      p.res = null; p.online = false; room.at = Date.now();
      push(room, you, { t: 'peer', online: false });
    });
    return;
  }
  if (path_ === '/api/room/send' && req.method === 'POST') {
    let d; try { d = JSON.parse(await body(req, 24576)); } catch (e) { return json(res, 400, { ok: false, error: 'ข้อมูลไม่ถูกต้อง' }); }
    const room = roomOf(d.code, d.pid, d.token);
    if (!room) return json(res, 404, { ok: false, error: 'ไม่พบห้อง' });
    const me = +d.pid, you = 1 - me, p = room.pl[me], m = d.msg || {};
    if (m.t === 'ready') {
      if (!room.pl[you]) return json(res, 409, { ok: false, error: 'ยังไม่มีเพื่อนเข้าห้อง' });
      if (!m.deck || typeof m.deck !== 'object') return json(res, 400, { ok: false, error: 'ไม่มีเด็ค' });
      p.ready = { deck: m.deck, hash: clip(m.hash, 40), name: clip(m.name, 16) };
      const q = room.pl[you];
      if (q.ready && !room.started) {
        room.started = true;
        const msg = { t: 'start', seed: crypto.randomInt(2 ** 31), first: crypto.randomInt(2), decks: [], hashes: [], names: [] };
        for (const i of [0, 1]) { msg.decks[i] = room.pl[i].ready.deck; msg.hashes[i] = room.pl[i].ready.hash; msg.names[i] = room.pl[i].ready.name || ('ผู้เล่น ' + (i + 1)); }
        if (msg.names[0] === msg.names[1]) msg.names[1] += ' (2)';
        push(room, 0, msg); push(room, 1, msg);
      } else if (!room.started) push(room, you, { t: 'peerready' });
    } else if (m.t === 'move') {
      if (!room.started) return json(res, 409, { ok: false, error: 'เกมยังไม่เริ่ม' });
      const n = +m.n || 0;
      if (n <= p.lastN) return json(res, 200, { ok: true, dup: true });   // ส่งซ้ำ (ลองใหม่หลังเน็ตหลุด)
      p.lastN = n;
      push(room, you, { t: 'move', k: clip(m.k, 12), v: m.v });
    } else if (m.t === 'leave') {
      push(room, you, { t: 'leave' });
    } else return json(res, 400, { ok: false, error: 'คำสั่งไม่ถูกต้อง' });
    return json(res, 200, { ok: true });
  }
  return false;
}

/* ---------------------------------------------------------------- routes */
const OWN = u => u.pathname === '/api/feedback' || u.pathname === '/recommece' || u.pathname === '/recommece/delete' || u.pathname === '/recommend' || u.pathname === '/recommece/test-mail' || u.pathname.startsWith('/api/room/');
async function handle(req, res) {
  const u = new URL(req.url, 'http://x');
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST, OPTIONS' };
  if (u.pathname === '/api/feedback') {
    if (req.method === 'OPTIONS') return send(res, 204, 'text/plain', '', cors);
    if (req.method === 'POST') {
      let d; try { d = JSON.parse(await body(req)); } catch (e) { return json(res, 400, { ok: false, error: 'ข้อมูลไม่ถูกต้อง' }, cors); }
      if (d && d.website) return json(res, 200, { ok: true }, cors);          // honeypot: บอทกรอกช่องที่ซ่อนไว้
      const text = clip(d.text, 1500);
      if (text.length < 3) return json(res, 400, { ok: false, error: 'กรุณาพิมพ์ข้อความอย่างน้อย 3 ตัวอักษร' }, cors);
      if (limited(ipOf(req))) return json(res, 429, { ok: false, error: 'ส่งบ่อยเกินไป รอสักครู่แล้วลองใหม่' }, cors);
      const ctx = {}; if (d.context && typeof d.context === 'object') for (const k of Object.keys(d.context).slice(0, 6)) ctx[clip(k, 20)] = clip(d.context[k], 120);
      const item = { id: crypto.randomBytes(6).toString('hex'), at: Date.now(), category: CATS[d.category] ? d.category : 'suggest', text, name: clip(d.name, 60), contact: clip(d.contact, 100), context: ctx };
      items.push(item);
      if (items.length > MAX_ITEMS) items = items.slice(-MAX_ITEMS);
      try { save(); } catch (e) { console.error('save failed', e.message); return json(res, 500, { ok: false, error: 'บันทึกไม่สำเร็จ' }, cors); }
      notify(item);   // ส่งสำเนาอีเมลเบื้องหลัง ไม่รอผล
      return json(res, 200, { ok: true }, cors);
    }
    if (req.method === 'GET') {
      if (!isAdmin(u, req)) return json(res, 401, { ok: false, error: 'ต้องใส่ key' });
      return json(res, 200, items, u.searchParams.get('download') ? { 'content-disposition': 'attachment; filename="feedback.json"' } : {});
    }
    return send(res, 405, 'text/plain', 'method not allowed');
  }
  if (u.pathname === '/recommece/test-mail') {   // ทดสอบส่งอีเมล: เปิด /recommece/test-mail?key=ADMIN_KEY (ต้องตั้ง ADMIN_KEY)
    if (!canDelete(u, req)) return json(res, 403, { ok: false, error: 'ต้องตั้ง ADMIN_KEY และใส่ key ให้ถูก' });
    return json(res, 200, await sendMail('[AvastFall] ทดสอบส่งอีเมล', '<p>ถ้าอ่านข้อความนี้ได้ แปลว่าระบบส่งอีเมลทำงานแล้ว ✅</p>'));
  }
  if (u.pathname === '/recommece' || u.pathname === '/recommend') {
    if (!isAdmin(u, req)) return send(res, 401, 'text/html; charset=utf-8', '<!doctype html><meta charset="utf-8"><title>ต้องใส่รหัส</title><p style="font:16px sans-serif;padding:24px">ต้องใส่รหัสเข้าดู เปิดด้วย <code>/recommece?key=รหัสของคุณ</code></p>');
    return send(res, 200, 'text/html; charset=utf-8', page(u, req));
  }
  if (u.pathname === '/recommece/delete' && req.method === 'POST') {
    if (!canDelete(u, req)) return send(res, 403, 'text/plain; charset=utf-8', 'ลบไม่ได้ (ยังไม่ได้ตั้ง ADMIN_KEY หรือรหัสไม่ถูก)');
    const id = new URLSearchParams(await body(req)).get('id');
    items = items.filter(i => i.id !== id); try { save(); } catch (e) { }
    const k = u.searchParams.get('key');
    return send(res, 303, 'text/plain', '', { location: '/recommece' + (k ? '?key=' + encodeURIComponent(k) : '') });
  }
  const r = await roomRoute(u, req, res);
  if (r === false) send(res, 404, 'text/plain', 'not found');
}

/* Express middleware: จัดการเฉพาะเส้นทางของเกมทดลองเล่น ที่เหลือส่งต่อ */
function middleware(req, res, next) {
  let u; try { u = new URL(req.url, 'http://x'); } catch (e) { return next(); }
  if (!OWN(u)) return next();
  handle(req, res).catch(e => { console.error(e); try { if (!res.headersSent) send(res, 500, 'text/plain; charset=utf-8', 'เกิดข้อผิดพลาด'); else res.end(); } catch (_) { } });
}

const stats = () => ({ rooms: rooms.size, playing: [...rooms.values()].filter(r => r.started).length, connected: [...rooms.values()].reduce((n, r) => n + r.pl.filter(p => p && p.online).length, 0) });
module.exports = { stats, middleware, FILE, hasAdminKey: !!ADMIN_KEY };
