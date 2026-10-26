/* ระบบเปิดซอง (BT01) — หน้า /packs.html
   - ดึงการ์ดของชุดจาก /api/cards?deck=BT01 (เพิ่มการ์ดผ่าน /admin แล้วเข้าซองให้เอง)
   - สุ่มด้วย crypto.getRandomValues · คอลเลกชันเก็บใน localStorage ('af-collection-v1')
   - ปรับกติกาซองที่ PACK ด้านล่าง */
'use strict';
const PACK = {
  deck: 'BT01',
  size: 8,                         // จำนวนการ์ดต่อซอง
  commonSlots: 7,                  // ช่อง Common (rarity C)
  // ช่องสุดท้าย (Rare slot): น้ำหนักการสุ่มของแต่ละ rarity — ถ้า rarity ไหนไม่มีการ์ดในชุด จะถูกข้ามอัตโนมัติ
  rareSlot: { R: 84, SR: 14, SSR: 2 },
  noDupInPack: true                // ในซองเดียวกันไม่ให้ใบซ้ำ (ถ้ามีการ์ดให้เลือกพอ)
};
const KEY = 'af-collection-v1';
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const BACK = '/assets/card-back.jpg';

/* ---------- สุ่ม ---------- */
function rnd(n) {                  // จำนวนเต็ม 0..n-1 ไม่เอนเอียง
  const a = new Uint32Array(1), lim = Math.floor(0x100000000 / n) * n;
  do crypto.getRandomValues(a); while (a[0] >= lim);
  return a[0] % n;
}
function pickWeighted(map) {
  const e = Object.entries(map), t = e.reduce((s, [, w]) => s + w, 0);
  let r = rnd(t * 1000) / 1000;
  for (const [k, w] of e) { if ((r -= w) < 0) return k; }
  return e[e.length - 1][0];
}
function pick(list, taken) {
  let pool = list;
  if (PACK.noDupInPack) { const f = list.filter(c => !taken.has(c.id)); if (f.length) pool = f; }
  const c = pool[rnd(pool.length)]; taken.add(c.id); return c;
}
function openPack(cards) {
  const by = {}; cards.forEach(c => (by[c.rarity] = by[c.rarity] || []).push(c));
  const commons = by.C && by.C.length ? by.C : cards;
  const taken = new Set(), out = [];
  for (let i = 0; i < Math.min(PACK.commonSlots, PACK.size); i++) out.push(pick(commons, taken));
  const w = {}; for (const [k, v] of Object.entries(PACK.rareSlot)) if (by[k] && by[k].length) w[k] = v;
  while (out.length < PACK.size) {
    const r = Object.keys(w).length ? pickWeighted(w) : 'C';
    out.push(pick(by[r] || commons, taken));
  }
  // เรียงให้ใบหายากอยู่ท้าย (เปิดทีหลังสุด)
  const rank = { C: 0, R: 1, SR: 2, SSR: 3 };
  return out.sort((a, b) => (rank[a.rarity] || 0) - (rank[b.rarity] || 0));
}

/* ---------- คอลเลกชัน ---------- */
const col = {
  data: { owned: {}, packs: 0 },
  load() { try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.owned) this.data = d; } catch (e) { } },
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { } },
  add(cards) {
    const fresh = new Set();
    cards.forEach(c => { if (!this.data.owned[c.id]) fresh.add(c.id); this.data.owned[c.id] = (this.data.owned[c.id] || 0) + 1; });
    this.data.packs++; this.save(); return fresh;
  },
  reset() { this.data = { owned: {}, packs: 0 }; this.save(); }
};

/* ---------- state / โหลดการ์ด ---------- */
const S = { cards: [], status: 'loading', view: 'open', pack: null, fresh: new Set() };
const img = c => c.image || ('/images/' + c.id + '.jpg');
async function load() {
  try {
    const r = await fetch('/api/cards?deck=' + PACK.deck + '&limit=500'); if (!r.ok) throw 0;
    const j = await r.json(); S.cards = j.data || [];
    S.status = S.cards.length ? 'ok' : 'empty';
  } catch (e) { S.status = 'err'; }
  render();
}

/* ---------- หน้าจอ ---------- */
function render() {
  $('#colCount').textContent = Object.keys(col.data.owned).length;
  $('#setName').textContent = PACK.deck;
  document.querySelectorAll('.pk-tabs .chip').forEach(b => b.classList.toggle('on', b.dataset.v === S.view));
  $('#vOpen').hidden = S.view !== 'open'; $('#vCol').hidden = S.view !== 'col';
  S.view === 'open' ? renderOpen() : renderCol();
}
function renderOpen() {
  const v = $('#vOpen');
  if (S.status === 'loading') { v.innerHTML = '<p class="msg">กำลังโหลดการ์ด…</p>'; return; }
  if (S.status !== 'ok') { v.innerHTML = '<p class="msg">' + (S.status === 'err' ? 'โหลดการ์ดไม่สำเร็จ ลองรีเฟรชหน้านี้' : 'ยังไม่มีการ์ดชุด ' + PACK.deck) + '</p>'; return; }
  if (!S.pack) {
    const rs = Object.keys(PACK.rareSlot).filter(k => S.cards.some(c => c.rarity === k)).join('/');
    v.innerHTML = '<div class="stage"><div class="pack" id="pack" tabindex="0" role="button" aria-label="ฉีกซอง"><div><b>' + esc(PACK.deck) + '</b><small>BOOSTER PACK</small></div><i>' + PACK.size + ' ใบ</i></div>' +
      '<p class="hint">แตะที่ซองเพื่อฉีก</p>' +
      '<p class="odds">1 ซอง = ' + PACK.commonSlots + ' Common + ' + (PACK.size - PACK.commonSlots) + ' ช่อง Rare (' + rs + ') · ในชุด ' + S.cards.length + ' ใบ · เปิดไปแล้ว ' + col.data.packs + ' ซอง</p></div>';
    const p = $('#pack'), go = () => { p.classList.add('tear'); setTimeout(() => { S.pack = openPack(S.cards); S.fresh = col.add(S.pack); render(); }, 560); };
    p.onclick = go; p.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
    return;
  }
  v.innerHTML = '<div class="stage"><div class="reveal" id="rv">' + S.pack.map((c, i) =>
    '<button class="rc ' + esc(c.rarity) + (S.fresh.has(c.id) ? ' new' : '') + '" data-i="' + i + '" aria-label="การ์ดใบที่ ' + (i + 1) + '"><div class="in">' +
    '<div class="f bk"><img src="' + BACK + '" alt=""></div>' +
    '<div class="f fr"><span class="tag">' + esc(c.rarity) + '</span><img src="' + esc(img(c)) + '" alt="' + esc(c.name) + '" onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{textContent:\'' + esc(c.id) + '\'}))"></div>' +
    '</div></button>').join('') + '</div>' +
    '<p class="hint" id="rh">แตะการ์ดเพื่อพลิก</p>' +
    '<div class="row"><button class="btn" id="flipAll">พลิกทั้งหมด</button><button class="btn pri" id="again" disabled>เปิดซองต่อไป</button></div></div>';
  const cards = [...v.querySelectorAll('.rc')];
  const upd = () => { const all = cards.every(x => x.classList.contains('up')); $('#again').disabled = !all; $('#flipAll').disabled = all; if (all) $('#rh').textContent = 'ได้การ์ดใหม่ ' + S.fresh.size + ' ใบ · เก็บเข้าคอลเลกชันแล้ว'; };
  cards.forEach(b => b.onclick = () => { if (b.classList.contains('up')) { zoom(S.pack[b.dataset.i]); } else { b.classList.add('up'); upd(); } });
  $('#flipAll').onclick = () => cards.forEach((b, i) => setTimeout(() => { b.classList.add('up'); upd(); }, i * 90));
  $('#again').onclick = () => { S.pack = null; S.fresh = new Set(); render(); };
}
function renderCol() {
  const v = $('#vCol'), own = col.data.owned, have = S.cards.filter(c => own[c.id]).length, tot = S.cards.length;
  const extra = Object.keys(own).filter(id => !S.cards.some(c => c.id === id)).length;   // การ์ดที่เคยได้แต่ถูกลบออกจากชุดแล้ว
  if (S.status !== 'ok') { v.innerHTML = '<p class="msg">ยังไม่มีข้อมูลการ์ด</p>'; return; }
  const sum = Object.values(own).reduce((s, n) => s + n, 0);
  v.innerHTML = '<div class="box"><div class="stats"><b>สะสมแล้ว ' + have + ' / ' + tot + ' ใบ</b><div class="bar"><i style="width:' + (tot ? have / tot * 100 : 0) + '%"></i></div>' +
    '<span>รวม ' + sum + ' ใบ · ' + col.data.packs + ' ซอง' + (extra ? ' · +' + extra + ' ใบนอกชุด' : '') + '</span><button class="btn" id="rst">ล้างคอลเลกชัน</button></div>' +
    '<div class="grid">' + S.cards.map(c => '<button class="cc' + (own[c.id] ? '' : ' miss') + '" data-id="' + esc(c.id) + '"><img loading="lazy" src="' + esc(img(c)) + '" alt="' + esc(own[c.id] ? c.name : '?') + '" onerror="this.src=\'' + BACK + '\'">' +
      (own[c.id] ? '<span class="n">×' + own[c.id] + '</span>' : '') + '<span class="id">' + esc(c.id) + '</span></button>').join('') + '</div></div>';
  v.querySelectorAll('.cc').forEach(b => b.onclick = () => { if (own[b.dataset.id]) zoom(S.cards.find(c => c.id === b.dataset.id)); });
  $('#rst').onclick = () => { if (confirm('ล้างคอลเลกชันและจำนวนซองที่เปิดทั้งหมด?')) { col.reset(); render(); } };
}
function zoom(c) { const z = $('#zoom'); z.querySelector('img').src = img(c); z.hidden = false; }
$('#zoom').onclick = () => { $('#zoom').hidden = true; };
document.addEventListener('keydown', e => { if (e.key === 'Escape') $('#zoom').hidden = true; });
document.querySelectorAll('.pk-tabs .chip').forEach(b => b.onclick = () => { S.view = b.dataset.v; render(); });

col.load(); render(); load();
