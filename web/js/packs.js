/* ระบบเปิดซอง — หน้า /packs.html
   - หน้าแรก = เลือกชุด (Booster: รหัสขึ้นต้น BT) → เปิดซอง/คอลเลกชันของชุดนั้น · ปุ่ม "← เลือกชุด" ย้อนกลับได้ทุกเมื่อ
   - ดึงการ์ดของชุดจาก /api/cards?deck=XXX — เพิ่มการ์ดผ่าน /admin แล้ว "เข้าซองให้เอง" (รวมใบ SR/SSR/UR ที่เพิ่มทีหลัง)
   - สุ่มด้วย crypto.getRandomValues · คอลเลกชันเก็บใน localStorage ('af-collection-v1')
   - ปรับกติกาซองที่ PACK_DEFAULT (ทุกชุด) หรือ PACKS (เฉพาะบางชุด) ด้านล่าง */
'use strict';
const PACK_DEFAULT = {
  size: 8,                         // จำนวนการ์ดต่อซอง
  commonSlots: 7,                  // ช่อง Common (rarity C) · ที่เหลือ (size - commonSlots) = ช่อง Rare
  // ช่อง Rare: น้ำหนักการสุ่มของแต่ละ rarity — rarity ที่ "ไม่มีการ์ดในชุด" จะถูกข้ามอัตโนมัติ (น้ำหนักที่เหลือถูกนำมาคิดสัดส่วนใหม่)
  // ดังนั้นพอเพิ่มการ์ด SSR เข้าชุด ก็จะมีโอกาสออกในซองทันที โดยไม่ต้องแก้โค้ด
  rareSlot: { R: 88, SR: 12, SSR: 3, UR: 1 },
  unknownWeight: 1,                // rarity แปลก ๆ ที่ไม่อยู่ในตารางด้านบน (เช่น SP) ก็เข้าซองด้วยน้ำหนักนี้
  noDupInPack: true                // ในซองเดียวกันไม่ให้ใบซ้ำ (ถ้ามีการ์ดให้เลือกพอ)
};
// ตั้งค่าเฉพาะชุด เช่น  BT02: { size: 10, commonSlots: 8, rareSlot: { R: 80, SR: 20 } }   ·   ปิดชุดนี้จากหน้าเลือกซอง:  BT09: { enabled: false }
const PACKS = {};
const cfgOf = deck => Object.assign({}, PACK_DEFAULT, PACKS[deck] || {});
const isPackSet = id => (PACKS[id] && PACKS[id].enabled !== undefined) ? PACKS[id].enabled : /^BT/i.test(id);
const RANK = ['C', 'R', 'SR', 'SSR', 'UR'];
const rar = c => String(c.rarity || 'C').trim().toUpperCase();
const rarClass = c => rar(c).replace(/[^A-Z0-9]/g, '');
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
function pick(list, taken, dup) {
  let pool = list;
  if (dup) { const f = list.filter(c => !taken.has(c.id)); if (f.length) pool = f; }
  const c = pool[rnd(pool.length)]; taken.add(c.id); return c;
}
function openPack(cards, deck) {
  const P = cfgOf(deck), by = {};
  cards.forEach(c => (by[rar(c)] = by[rar(c)] || []).push(c));
  const commons = by.C && by.C.length ? by.C : cards;
  const taken = new Set(), out = [];
  for (let i = 0; i < Math.min(P.commonSlots, P.size); i++) out.push(pick(commons, taken, P.noDupInPack));
  const w = {};
  for (const k of Object.keys(by)) if (k !== 'C') w[k] = P.rareSlot[k] !== undefined ? P.rareSlot[k] : P.unknownWeight;
  while (out.length < P.size) {
    const r = Object.keys(w).length ? pickWeighted(w) : 'C';
    out.push(pick(by[r] || commons, taken, P.noDupInPack));
  }
  // เรียงให้ใบหายากอยู่ท้าย (เปิดทีหลังสุด) · rarity นอกตาราง RANK อยู่หลัง R
  const rk = c => { const i = RANK.indexOf(rar(c)); return i < 0 ? 1.5 : i; };
  return out.sort((a, b) => rk(a) - rk(b));
}

/* ---------- คอลเลกชัน (รวมทุกชุดในที่เดียว นับแยกตามชุดจากรหัสการ์ด) ---------- */
const inDeck = (id, deck) => id.toLowerCase().startsWith(deck.toLowerCase() + '-');
const col = {
  data: { owned: {}, packs: 0, packsBy: {} },
  load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (d && d.owned) { this.data = d; if (!d.packsBy) d.packsBy = d.packs ? { BT01: d.packs } : {}; }   // ข้อมูลเก่า: ก่อนมีหลายชุด มีแต่ BT01
    } catch (e) { }
  },
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { } },
  add(cards, deck) {
    const fresh = new Set();
    cards.forEach(c => { if (!this.data.owned[c.id]) fresh.add(c.id); this.data.owned[c.id] = (this.data.owned[c.id] || 0) + 1; });
    this.data.packs++; this.data.packsBy[deck] = (this.data.packsBy[deck] || 0) + 1; this.save(); return fresh;
  },
  ownedIn(deck) { return Object.keys(this.data.owned).filter(id => inDeck(id, deck)); },
  packsIn(deck) { return this.data.packsBy[deck] || 0; },
  reset(deck) {                    // ล้างเฉพาะชุดนี้
    this.ownedIn(deck).forEach(id => delete this.data.owned[id]);
    this.data.packs = Math.max(0, this.data.packs - this.packsIn(deck)); delete this.data.packsBy[deck]; this.save();
  }
};

/* ---------- state / โหลดการ์ด ---------- */
const S = { sets: [], setsStatus: 'loading', deck: null, cards: [], status: 'loading', view: 'open', pack: null, fresh: new Set() };
const img = c => c.image || ('/images/' + c.id + '.jpg');
async function loadSets() {
  try {
    const r = await fetch('/api/decks'); if (!r.ok) throw 0;
    const all = ((await r.json()).data || []);
    S.sets = all.filter(d => isPackSet(d.id));
    S.setsStatus = 'ok';
  } catch (e) { S.setsStatus = 'err'; }
  const q = new URLSearchParams(location.search).get('deck');       // เปิดตรงชุดได้: /packs.html?deck=BT01
  if (q && S.sets.some(d => d.id.toLowerCase() === q.toLowerCase())) return chooseSet(S.sets.find(d => d.id.toLowerCase() === q.toLowerCase()).id);
  render();
}
async function chooseSet(id) {
  S.deck = id; S.cards = []; S.status = 'loading'; S.view = 'open'; S.pack = null; S.fresh = new Set(); render();
  try {
    const out = []; let page = 1, pages = 1;
    do {
      const r = await fetch('/api/cards?deck=' + encodeURIComponent(id) + '&limit=500&page=' + page); if (!r.ok) throw 0;
      const j = await r.json(); out.push(...(j.data || [])); pages = j.pages || 1; page++;
    } while (page <= pages);
    if (S.deck !== id) return;                                     // ผู้ใช้กดย้อนกลับไปแล้ว
    S.cards = out; S.status = out.length ? 'ok' : 'empty';
  } catch (e) { if (S.deck !== id) return; S.status = 'err'; }
  render();
}
function backToSets() { S.deck = null; S.cards = []; S.pack = null; S.fresh = new Set(); render(); }

/* ---------- หน้าจอ ---------- */
function render() {
  const inSet = !!S.deck;
  $('#setName').textContent = inSet ? S.deck : '';  $('#setName').hidden = !inSet;
  $('#back').hidden = !inSet; $('#tabs').hidden = !inSet;
  $('#vSets').hidden = inSet; $('#vOpen').hidden = !inSet || S.view !== 'open'; $('#vCol').hidden = !inSet || S.view !== 'col';
  document.title = (inSet ? 'เปิดซอง ' + S.deck : 'เปิดซอง') + ' · AvastFall TCG';
  if (!inSet) return renderSets();
  $('#colCount').textContent = col.ownedIn(S.deck).length;
  document.querySelectorAll('#tabs .chip').forEach(b => b.classList.toggle('on', b.dataset.v === S.view));
  S.view === 'open' ? renderOpen() : renderCol();
}
function renderSets() {
  const v = $('#vSets');
  if (S.setsStatus === 'loading') { v.innerHTML = '<p class="msg">กำลังโหลดรายการชุด…</p>'; return; }
  if (S.setsStatus === 'err') { v.innerHTML = '<p class="msg">โหลดรายการชุดไม่สำเร็จ ลองรีเฟรชหน้านี้</p>'; return; }
  if (!S.sets.length) { v.innerHTML = '<p class="msg">ยังไม่มีชุดที่เปิดซองได้</p>'; return; }
  v.innerHTML = '<p class="hint">เลือกชุดที่ต้องการเปิดซอง</p><div class="sets">' + S.sets.map(d => {
    const have = col.ownedIn(d.id).length, n = d.count || 0;
    return '<button class="set" data-id="' + esc(d.id) + '"' + (n ? '' : ' disabled') + '><div class="pack sm"><div><b>' + esc(d.id) + '</b><small>BOOSTER PACK</small></div></div>' +
      '<strong>' + esc(d.name && d.name !== d.id ? d.name : d.id) + '</strong>' +
      '<span class="mut">' + (n ? n + ' ใบในชุด · สะสมแล้ว ' + have + '/' + n : 'ยังไม่มีการ์ด') + ' · เปิดแล้ว ' + col.packsIn(d.id) + ' ซอง</span></button>';
  }).join('') + '</div>';
  v.querySelectorAll('.set').forEach(b => b.onclick = () => chooseSet(b.dataset.id));
}
function renderOpen() {
  const v = $('#vOpen'), P = cfgOf(S.deck);
  if (S.status === 'loading') { v.innerHTML = '<p class="msg">กำลังโหลดการ์ด…</p>'; return; }
  if (S.status !== 'ok') { v.innerHTML = '<p class="msg">' + (S.status === 'err' ? 'โหลดการ์ดไม่สำเร็จ ลองรีเฟรชหน้านี้' : 'ยังไม่มีการ์ดชุด ' + esc(S.deck)) + '</p>'; return; }
  if (!S.pack) {
    const present = [...new Set(S.cards.map(rar))].filter(k => k !== 'C').sort((a, b) => { const i = RANK.indexOf(a), j = RANK.indexOf(b); return (i < 0 ? 9 : i) - (j < 0 ? 9 : j) || a.localeCompare(b); });
    v.innerHTML = '<div class="stage"><div class="pack" id="pack" tabindex="0" role="button" aria-label="ฉีกซอง"><div><b>' + esc(S.deck) + '</b><small>BOOSTER PACK</small></div><i>' + P.size + ' ใบ</i></div>' +
      '<p class="hint">แตะที่ซองเพื่อฉีก</p>' +
      '<p class="odds">1 ซอง = ' + P.commonSlots + ' Common + ' + (P.size - P.commonSlots) + ' ช่อง Rare' + (present.length ? ' (' + present.join('/') + ')' : '') + ' · ในชุด ' + S.cards.length + ' ใบ · เปิดไปแล้ว ' + col.packsIn(S.deck) + ' ซอง</p></div>';
    const p = $('#pack'), go = () => { if (p.classList.contains('tear')) return; p.classList.add('tear'); setTimeout(() => { S.pack = openPack(S.cards, S.deck); S.fresh = col.add(S.pack, S.deck); render(); }, 560); };
    p.onclick = go; p.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
    return;
  }
  v.innerHTML = '<div class="stage"><div class="reveal" id="rv">' + S.pack.map((c, i) =>
    '<button class="rc ' + esc(rarClass(c)) + (S.fresh.has(c.id) ? ' new' : '') + '" data-i="' + i + '" aria-label="การ์ดใบที่ ' + (i + 1) + '"><div class="in">' +
    '<div class="f bk"><img src="' + BACK + '" alt=""></div>' +
    '<div class="f fr"><span class="tag">' + esc(rar(c)) + '</span><img src="' + esc(img(c)) + '" alt="' + esc(c.name) + '" onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{textContent:\'' + esc(c.id) + '\'}))"></div>' +
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
  const extra = col.ownedIn(S.deck).filter(id => !S.cards.some(c => c.id === id)).length;   // การ์ดที่เคยได้แต่ถูกลบออกจากชุดแล้ว
  if (S.status !== 'ok') { v.innerHTML = '<p class="msg">ยังไม่มีข้อมูลการ์ด</p>'; return; }
  const sum = col.ownedIn(S.deck).reduce((s, id) => s + own[id], 0);
  v.innerHTML = '<div class="box"><div class="stats"><b>สะสมแล้ว ' + have + ' / ' + tot + ' ใบ</b><div class="bar"><i style="width:' + (tot ? have / tot * 100 : 0) + '%"></i></div>' +
    '<span>รวม ' + sum + ' ใบ · ' + col.packsIn(S.deck) + ' ซอง' + (extra ? ' · +' + extra + ' ใบนอกชุด' : '') + '</span><button class="btn" id="rst">ล้างคอลเลกชัน ' + esc(S.deck) + '</button></div>' +
    '<div class="grid">' + S.cards.map(c => '<button class="cc' + (own[c.id] ? '' : ' miss') + '" data-id="' + esc(c.id) + '"><img loading="lazy" src="' + esc(img(c)) + '" alt="' + esc(own[c.id] ? c.name : '?') + '" onerror="this.src=\'' + BACK + '\'">' +
      (own[c.id] ? '<span class="n">×' + own[c.id] + '</span>' : '') + '<span class="id">' + esc(c.id) + '</span></button>').join('') + '</div></div>';
  v.querySelectorAll('.cc').forEach(b => b.onclick = () => { if (own[b.dataset.id]) zoom(S.cards.find(c => c.id === b.dataset.id)); });
  $('#rst').onclick = () => { if (confirm('ล้างคอลเลกชันและจำนวนซองของชุด ' + S.deck + ' ทั้งหมด? (ชุดอื่นไม่ถูกแตะ)')) { col.reset(S.deck); render(); } };
}
function zoom(c) { const z = $('#zoom'); z.querySelector('img').src = img(c); z.hidden = false; }
$('#zoom').onclick = () => { $('#zoom').hidden = true; };
document.addEventListener('keydown', e => { if (e.key === 'Escape') $('#zoom').hidden = true; });
document.querySelectorAll('#tabs .chip').forEach(b => b.onclick = () => { S.view = b.dataset.v; render(); });
$('#back').onclick = backToSets;

col.load(); render(); loadSets();
