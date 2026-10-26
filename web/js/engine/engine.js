/* AvastFall TCG – rules engine (pure logic, no DOM). Attaches to AF (globalThis.AF). */
(function (AF) {
'use strict';

class GameOver extends Error { constructor(res) { super('game over'); this.res = res; } }
AF.GameOver = GameOver;

const opp = p => 1 - p;
AF.opp = opp;
/* จุดเสียบของสคริปต์การ์ด: hooks.turnEnd = ฟังก์ชัน async (G, p) ที่ทำงานหลังเหตุการณ์ turnEnd ก่อนโมดิฟายเออร์หมดอายุ */
AF.hooks = AF.hooks || {}; AF.hooks.turnEnd = AF.hooks.turnEnd || [];

/* กติกาคงที่ (ไม่มีตัวเลือกในหน้าตั้งค่า) */
AF.DOMAIN_LIMIT = 3;   // Domain ต่อฝั่ง ฉบับ Revised

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function shuffleArr(arr, rng) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
AF.mulberry32 = mulberry32;

/* ---------------------------------------------------------------- card definitions */
AF.defs = {};
AF.deckInfo = {};
AF.FX = AF.FX || {};
const FXOF = c => AF.FX[c.def.id] || {};

AF.loadData = function (data) {
  AF.deckInfo = data.DECKS;
  AF.defs = {};
  for (const c of data.CARDS) {
    const id = c.deck + '-' + c.no;
    if ((c.key && c.key !== id) || c.variant) continue; // alt-art/variant duplicate of the same card
    const isSpell = c.type === 'Spell';
    const kind = c.type === 'Spell' ? c.sub : c.type; // Avatar Unit Enchant Counter Equipment Domain Ultimate
    const raw = c.cost ?? c.sc;
    AF.defs[id] = {
      id, deck: c.deck, no: c.no, name: c.name, type: c.type, sub: c.sub || null, kind,
      cost: raw ?? 0, noCost: !!(isSpell || c.type === 'Ultimate') && raw == null,
      atk: c.atk ?? 0, def: (c.def ?? c.defense ?? 0), cri: c.cri ?? 0,
      tribe: c.tribe || '', fx: c.fx || [], fl: c.fl || '',
      el: '', els: [], series: (data.DECKS[c.deck] || {}).name || '',
      rarity: c.rarity || '', artist: c.artist || '', image: c.image || ''
    };
    /* ธาตุของการ์ด: elements[] (Avatar 2 สี) > element > ธาตุของเด็ค · ไม่มีเลย = ไม่ระบุธาตุ (จ่ายด้วยธาตุอะไรก็ได้ ใส่เด็คไหนก็ได้) */
    const list = Array.isArray(c.elements) && c.elements.length ? c.elements : [c.element || (data.DECKS[c.deck] || {}).el].filter(Boolean);
    AF.defs[id].els = [...new Set(list)]; AF.defs[id].el = AF.defs[id].els[0] || '';
    AF.defs[id].needsScript = AF.defs[id].fx.some(f => f[0] !== 'COST' && f[1]);
  }
  AF.refreshScriptFlags();
};
AF.refreshScriptFlags = function () {
  for (const id of Object.keys(AF.defs)) {
    const d = AF.defs[id];
    d.scripted = !!(AF.FX && AF.FX[id]);
    d.unscripted = !d.scripted && d.needsScript;
  }
};

/* ---------------------------------------------------------------- deck helpers */
AF.autoDeck = function (series) {
  const ids = Object.keys(AF.defs).filter(i => AF.defs[i].deck === series);
  const avatar = ids.find(i => AF.defs[i].kind === 'Avatar');
  const rest = ids.filter(i => i !== avatar);
  const counts = {};
  const pri = id => { const d = AF.defs[id]; return (d.kind === 'Unit' ? 10 - d.cost * 1.2 : d.kind === 'Ultimate' ? 1 : d.kind === 'Domain' ? 2 : d.kind === 'Equipment' ? 3 : 6); };
  rest.forEach(id => { const d = AF.defs[id]; counts[id] = d.kind === 'Ultimate' ? 2 : d.kind === 'Domain' ? 3 : 3; });
  const sorted = [...rest].sort((a, b) => pri(b) - pri(a));
  let total = () => Object.values(counts).reduce((a, b) => a + b, 0);
  let guard = 0;
  while (total() < 59 && guard++ < 500) { for (const id of sorted) { if (total() >= 59) break; if (counts[id] < 4) counts[id]++; } }
  guard = 0;
  while (total() > 59 && guard++ < 500) { for (const id of [...sorted].reverse()) { if (total() <= 59) break; if (counts[id] > 1) counts[id]--; } }
  return { series, avatar, counts };
};
AF.deckSize = d => 1 + Object.values(d.counts).reduce((a, b) => a + b, 0);
/* Element Deck เริ่มต้น 8 ใบ: Avatar 1 ธาตุ = ธาตุนั้นทั้งหมด · 2 ธาตุ = แบ่งครึ่ง (ธาตุแรกได้ส่วนเกิน) */
AF.defaultEdeck = function (av) {
  const els = (av && av.els && av.els.length) ? av.els : [''];
  const o = {}; els.forEach((e, i) => { o[e] = Math.floor(8 / els.length) + (i < 8 % els.length ? 1 : 0); }); return o;
};
AF.edeckOf = function (d) {
  if (d.edeck && Object.keys(d.edeck).length) return d.edeck;
  return AF.defaultEdeck(AF.defs[d.avatar]);
};
/* กฎจัดเด็ค: Avatar กำหนดธาตุที่ใส่ได้ — การ์ดที่ธาตุทุกสีอยู่ในธาตุของ Avatar หรือการ์ดที่ไม่ระบุธาตุ */
AF.allowedInDeck = function (av, card) {
  if (!card || !card.els || !card.els.length) return true;
  const afx = av && av.id && AF.FX && AF.FX[av.id];   // ข้อยกเว้นบน Avatar เช่น BT01-003 (ใส่การ์ดที่มีคำว่า "ดาบ" ได้ทุกธาตุ)
  if (afx && afx.deckAllowCard && afx.deckAllowCard(card)) return true;
  const da = card.id && AF.FX && AF.FX[card.id] && AF.FX[card.id].deckAllow;   // ข้อยกเว้นบนการ์ด เช่น BT01-006 (Avatar ชื่อ ฮัมบาบา)
  if (da && da(av)) return true;
  const ok = (av && av.els) || [];
  return card.els.every(e => ok.includes(e));
};
AF.validateDeck = function (d) {
  const errs = [];
  const n = AF.deckSize(d);
  if (n !== 60) errs.push('เด็คต้องมี 60 ใบพอดี (รวม Avatar) ตอนนี้ ' + n + ' ใบ');
  const byName = {};
  for (const [id, c] of Object.entries(d.counts)) {
    const df = AF.defs[id];
    if (!df) { errs.push('ไม่พบการ์ด ' + id + ' ในข้อมูลปัจจุบัน'); continue; }
    if (df.kind === 'Avatar') errs.push(df.name + ' เป็น Avatar ใส่ใน Main Deck ไม่ได้');
    byName[df.name] = (byName[df.name] || 0) + c;
    if (d.avatar !== undefined && AF.defs[d.avatar] && !AF.allowedInDeck(AF.defs[d.avatar], df))
      errs.push(df.name + ' (ธาตุ' + df.els.join('/') + ') ใส่ไม่ได้ Avatar เป็นธาตุ' + (AF.defs[d.avatar].els.join('/') || 'ไม่ระบุ'));
  }
  for (const [nm, c] of Object.entries(byName)) if (c > 4) errs.push(nm + ' ใส่ได้ไม่เกิน 4 ใบ (ตอนนี้ ' + c + ')');
  if (d.avatar !== undefined) {
    const av = AF.defs[d.avatar];
    if (!av || av.kind !== 'Avatar') errs.push('ต้องเลือก Avatar 1 ใบ');
    const en = Object.values(AF.edeckOf(d)).reduce((a, b) => a + b, 0);
    if (en !== 8) errs.push('Element Deck ต้องมี 8 ใบพอดี (ตอนนี้ ' + en + ' ใบ)');
  }
  return errs;
};

/* ---------------------------------------------------------------- game creation */
AF.createGame = function (cfg) {
  const seed = cfg.seed ?? Math.floor(Math.random() * 2 ** 31);
  const G = {
    seed, rng: mulberry32(seed), uidSeq: 0, turn: 0, active: 0, first: 0, phase: 'setup',
    stack: [], over: null, log: [], players: [], io: cfg.io, names: cfg.names || ['ผู้เล่น 1', 'ผู้เล่น 2'],
    tf: null, refresh: cfg.refresh || (() => { }), version: 0, events: []
  };
  for (let i = 0; i < 2; i++) {
    const d = cfg.decks[i];
    const P = {
      idx: i, name: G.names[i], deckSeries: d.series, deckName: d.name || null,
      avatar: { card: null, hp: 10, faceUp: false },
      deck: [], hand: [], discard: [], field: [null, null, null, null], magic: [null, null, null], domains: [],
      edeck: [], elems: [], limbo: [], used: {}, spellDiscountUntil: -1, counterDiscount: null,
      counterCount: 0, mulliganed: false
    };
    G.players.push(P);
    const mk = id => ({ uid: ++G.uidSeq, def: AF.defs[id], owner: i, zone: 'deck' });
    const av = mk(d.avatar); av.zone = 'avatar'; P.avatar.card = av;
    for (const [id, n] of Object.entries(d.counts)) for (let k = 0; k < n; k++) P.deck.push(mk(id));
    for (const [el, n] of Object.entries(AF.edeckOf(d))) for (let k = 0; k < n; k++) P.edeck.push({ uid: ++G.uidSeq, el, state: 'stand', owner: i });
    shuffleArr(P.deck, G.rng); shuffleArr(P.edeck, G.rng);
  }
  G.first = cfg.first === 0 || cfg.first === 1 ? cfg.first : (G.rng() < 0.5 ? 0 : 1);
  return G;
};

/* ---------------------------------------------------------------- logging / asking */
function log(G, text, p = null, extra = null) { G.log.push({ turn: G.turn, p, text, extra }); G.version++; G.refresh(G); }
AF.log = log;
async function ask(G, p, kind, spec) {
  G.refresh(G);
  const io = G.io[p];
  const r = await io[kind](G, p, spec);
  return r;
}
AF.ask = ask;

/* ---------------------------------------------------------------- zones */
function detach(G, c) {
  const z0 = c.zone;
  const P = G.players[c.owner];
  switch (c.zone) {
    case 'deck': P.deck.splice(P.deck.indexOf(c), 1); break;
    case 'hand': P.hand.splice(P.hand.indexOf(c), 1); break;
    case 'discard': P.discard.splice(P.discard.indexOf(c), 1); break;
    case 'domain': P.domains.splice(P.domains.indexOf(c), 1); break;
    case 'limbo': P.limbo.splice(P.limbo.indexOf(c), 1); break;
    case 'field': { const i = P.field.indexOf(c); if (i >= 0) P.field[i] = null; break; }
    case 'magic': { const i = P.magic.indexOf(c); if (i >= 0) P.magic[i] = null; break; }
    case 'equip': { if (c.host) { c.host.equips.splice(c.host.equips.indexOf(c), 1); c.host = null; } break; }
    default: break;
  }
  if (c.zone === 'field') { c.mods = []; c.equips = []; c.flags = {}; if (G.tf) { G.tf.left = G.tf.left || [0, 0]; G.tf.left[c.owner]++; } }   // นับ Unit ที่ออกจาก Action Zone ในเทิร์นนี้ (SD06-014)
  if (c.zone === 'magic') { c.linger = null; }
  c.zone = null;
  if (z0 === 'field') releaseLocks(G, c);
  if (z0 === 'domain') recalcCap(G);
}
function place(G, c, zone, opts = {}) {
  const z0 = c.zone;
  detach(G, c);
  if (z0 === 'field' && c.def.swordUnit) { c.def = AF.defs[c.def.id]; c.host = null; }   // Equipment ที่ถูกแปลงเป็น Unit (BT01-003) กลับเป็นการ์ดเดิมเมื่อออกจากสนาม
  const P = G.players[c.owner];
  if ((zone === 'deckTop' || zone === 'deckBottom') && z0 && z0 !== 'deck') AF.onDeckReturn(G, c, z0);   // การ์ดถูกส่งกลับ Main Deck (ไม่นับการเรียงใหม่ภายในเด็ค)
  switch (zone) {
    case 'deckTop': P.deck.unshift(c); c.zone = 'deck'; break;
    case 'deckBottom': P.deck.push(c); c.zone = 'deck'; break;
    case 'hand': P.hand.push(c); c.zone = 'hand'; break;
    case 'discard': P.discard.push(c); c.zone = 'discard'; break;
    case 'limbo': P.limbo.push(c); c.zone = 'limbo'; break;
    case 'domain': P.domains.push(c); c.zone = 'domain'; recalcCap(G); break;
    case 'magic': { const i = P.magic.indexOf(null); P.magic[i] = c; c.zone = 'magic'; break; }
    case 'field': {
      const i = P.field.indexOf(null); P.field[i] = c; c.zone = 'field';
      c.state = opts.state || 'stand'; c.enteredTurn = G.turn; c.attackedTurn = -1; c.mods = []; c.equips = []; c.flags = {};
      break;
    }
    default: throw new Error('bad zone ' + zone);
  }
  G.version++;
  return c;
}
AF.place = place;
/* hook ซิงก์: การ์ดที่อยู่บนสนาม/สวมใส่ที่มี fx.deckReturn(G, self, card, fromZone) จะถูกเรียกเมื่อมีการ์ดใดถูกส่งกลับ Main Deck (SD06-004, SD06-017) */
AF.onDeckReturn = (G, c, z0) => {
  for (const P of G.players) for (const u of P.field) {
    if (!u) continue;
    if (!AF.silenced(G, u)) { const f = FXOF(u).deckReturn; if (f) f(G, u, c, z0); }
    for (const e of u.equips) { const f = FXOF(e).deckReturn; if (f) f(G, e, c, z0); }
  }
};
function attach(G, eq, unit) {
  G.players[eq.owner].equipTurn = G.turn;
  if (eq.zone !== 'equip') eq.hops = 0;   // สวมใส่ใหม่จากโซนอื่น = เริ่มนับการย้ายผู้สวมใหม่ (SD05-017)
  detach(G, eq); eq.zone = 'equip'; eq.host = unit; unit.equips.push(eq);
}
AF.attach = attach;

AF.freeSlot = P => P.field.indexOf(null) >= 0 && P.field.filter(Boolean).length < (P.fieldCap ?? 4);
/* Domain ที่จำกัดจำนวน Unit (fieldLimit) — ใช้ค่าที่น้อยกว่าของทั้งสองฝ่าย */
function recalcCap(G) { let cap = 4; for (const P of G.players) for (const d of P.domains) { const f = FXOF(d).fieldLimit; if (f) cap = Math.min(cap, f); } for (const P of G.players) P.fieldCap = cap; }
AF.recalcCap = recalcCap;
/* การ์ดใน Magic Area ที่ล็อก Unit ไม่ให้กลับเป็น Stand (linger.locks) */
function releaseLocks(G, u) {
  for (const P of G.players) for (const m of [...P.magic]) {
    if (m && m.linger && m.linger.locks && m.linger.locks.includes(u)) {
      m.linger.locks = m.linger.locks.filter(x => x !== u);
      if (!m.linger.locks.length) { log(G, `${m.def.name} สิ้นสุดผลและลงกองทิ้ง`, m.owner); place(G, m, 'discard'); }
    }
  }
}
AF.standLocked = (G, u) => G.players.some(P => P.magic.some(m => m && m.linger && m.linger.locks && m.linger.locks.includes(u)));
AF.setStand = (G, u) => { if (hasFlag(u, 'noStand')) { log(G, `${u.def.name} ไม่สามารถเปลี่ยนสภาพเป็น Stand ได้`, u.owner); return false; } if (AF.standLocked(G, u)) { log(G, `${u.def.name} ไม่สามารถเปลี่ยนสภาพเป็น Stand ได้`, u.owner); return false; } u.state = 'stand'; return true; };
AF.units = (G, p) => G.players[p].field.filter(Boolean);

/* ---------------------------------------------------------------- stats & names */
const silenced = (G, u) => !!(u.mods && u.mods.some(m => m.silence)) || (u.zone === 'field' && G.players.some(P => P.magic.some(m => m && m.linger && FXOF(m).silenceUnits)));   // silenceUnits: Unit ทุกใบใช้ความสามารถไม่ได้ (SD06-010)
AF.silenced = silenced;
const hasFlag = (u, f) => !!(u.mods && u.mods.some(m => m.flag === f)) ||
  !!(u.zone === 'field' && u.equips && [...u.equips, ...(u.def.swordUnit ? [u] : [])].some(e => { const q = FXOF(e).equip; return q && ((q.flags && q.flags.includes(f)) || (q.flagIf && q.flagIf(u, f))); }));   // Equipment ให้ flag แก่ผู้สวมใส่ (equip.flags / equip.flagIf) เช่น BT01-094, BT01-054
AF.hasFlag = hasFlag;

function aura(G, u, k) {
  let n = 0;
  for (const P of G.players) {
    { const ac = P.avatar && P.avatar.card; const a = ac && FXOF(ac).aura; if (a && a[k]) n += a[k](G, ac, u) || 0; }   // aura ของ Avatar (BT01-002, BT01-004)
    for (const d of P.domains) { const a = FXOF(d).aura; if (a && a[k]) n += a[k](G, d, u) || 0; }
    for (const x of P.field) {
      if (!x) continue;
      if (!silenced(G, x)) { const a = FXOF(x).aura; if (a && a[k]) n += a[k](G, x, u) || 0; }
      for (const e of x.equips) { const a = FXOF(e).aura; if (a && a[k]) n += a[k](G, e, u, x) || 0; }
    }
  }
  return n;
}
function stat(G, u, k) {
  if (u.zone !== 'field') return u.def[k] || 0;
  let v = u.def[k] || 0;
  for (const m of u.mods) if (m[k]) v += m[k];
  for (const e of u.equips) { const fe = FXOF(e).equip; if (fe && fe[k]) v += fe[k]; }
  if (u.def.swordUnit) { const fe = FXOF(u).equip; if (fe && fe[k]) v += fe[k]; }   // เอฟเฟกต์ "Unit ที่สวมใส่" ส่งผลต่อตัวมันเอง
  v += aura(G, u, k);
  if (k === 'atk' && hasFlag(u, 'atkInf')) v = 9999;
  return Math.max(0, v);
}
AF.stat = stat;
function namesOf(G, u) {
  const n = [u.def.name];
  if (u.zone === 'field') { const f = FXOF(u).extraNames; if (f && !silenced(G, u)) n.push(...f(G, u)); }
  return n;
}
AF.namesOf = namesOf;
const hasName = (G, c, s) => namesOf(G, c).some(n => n.includes(s));
AF.hasName = hasName;
const tribeHas = (c, s) => (c.def.tribe || '').includes(s);
AF.tribeHas = tribeHas;
AF.addMod = (G, u, m) => {
  const mm = Object.assign({}, m);
  if (mm.until === 'turnEnd') mm.expireAt = G.turn;
  else if (mm.until === 'oppTurnEnd') mm.expireAt = G.turn + 1;
  u.mods.push(mm); G.version++; return mm;
};

/* ---------------------------------------------------------------- elements */
/* Avatar ที่ให้จ่าย Cost ของการ์ดบางใบด้วย Element ธาตุใดก็ได้ (fx.anyElementFor เช่น BT01-003) */
const anyElFor = (G, p, card) => { const a = FXOF(G.players[p].avatar.card).anyElementFor; return !!(a && a(card)); };
AF.anyElFor = anyElFor;
const standElems = (P, el) => P.elems.filter(e => e.state === 'stand' && (!el || (Array.isArray(el) ? el.includes(e.el) : e.el === el)));
AF.standElems = standElems;
function spendElems(G, p, n, el = null) {
  const P = G.players[p]; const pool = standElems(P, el);
  if (pool.length < n) return false;
  for (let i = 0; i < n; i++) pool[i].state = 'rest';
  G.version++; return true;
}
AF.spendElems = spendElems;
/* จ่าย Element แบบให้ผู้เล่นเลือกสีเอง: ถ้า Element ที่ใช้จ่ายได้มีหลายสี และจ่ายแล้วยังเหลือ (มีทางเลือกจริง)
   จะถามว่าจะจ่ายสีไหนกี่ใบ · ถ้าสีเดียว / จ่ายหมดพอดี / เหลือทางเดียว → จ่ายอัตโนมัติ */
async function payElems(G, p, n, el = null, why = '') {
  const P = G.players[p]; const pool = standElems(P, el);
  if (!(n > 0)) return true;
  if (pool.length < n) return false;
  const cnt = {}; pool.forEach(e => { cnt[e.el] = (cnt[e.el] || 0) + 1; });
  const cols = Object.keys(cnt);
  if (cols.length > 1 && n < pool.length) {
    const r = await ask(G, p, 'pick', { kind: 'payel', title: `${why ? why + ': ' : ''}จ่าย Element ${n} ใบ — เลือกสีที่จะจ่าย`, n, options: cols.map(k => ({ id: k, label: k, count: cnt[k] })), min: n, max: n });
    // ตรวจคำตอบ: ต้องได้ n ใบ และไม่เกินจำนวนที่มีของแต่ละสี ไม่งั้นเติมให้จากสีที่เหลือมากสุด
    const take = {}; let got = 0;
    for (const k of (Array.isArray(r) ? r : [])) { if (got >= n || !cnt[k] || (take[k] || 0) >= cnt[k]) continue; take[k] = (take[k] || 0) + 1; got++; }
    while (got < n) { const k = cols.filter(c => (take[c] || 0) < cnt[c]).sort((x, y) => (cnt[y] - (take[y] || 0)) - (cnt[x] - (take[x] || 0)))[0]; take[k] = (take[k] || 0) + 1; got++; }
    for (const k of cols) { let m = take[k] || 0; for (const x of pool) if (m > 0 && x.el === k) { x.state = 'rest'; m--; } }
    G.version++; return true;
  }
  return spendElems(G, p, n, el);
}
AF.payElems = payElems;
function gainElement(G, p) {
  const P = G.players[p]; if (!P.edeck.length) return false;
  const e = P.edeck.shift(); e.state = 'stand'; P.elems.push(e); return true;
}

/* ---------------------------------------------------------------- draw & deck ops */
function draw(G, p, n = 1) {
  const P = G.players[p]; const got = [];
  for (let i = 0; i < n; i++) { if (!P.deck.length) break; const c = P.deck.shift(); c.zone = 'hand'; P.hand.push(c); got.push(c); }
  if (got.length) log(G, `${P.name} จั่วการ์ด ${got.length} ใบ`, p);
  return got;
}
AF.draw = draw;
function shuffleDeck(G, p) { shuffleArr(G.players[p].deck, G.rng); G.version++; }
AF.shuffleDeck = shuffleDeck;

/* ---------------------------------------------------------------- prompts */
const H = AF.H = {};
H.pickCards = async (G, p, o) => {
  if (!o.cards.length) return [];
  const r = await ask(G, p, 'pick', { kind: o.kind || 'cards', title: o.title, options: o.cards.map(c => ({ id: c.uid, card: c })), min: o.optional ? 0 : (o.min ?? 1), max: o.max ?? 1, optional: !!o.optional, private: o.private, ctx: o.ctx });
  return (r || []).map(id => o.cards.find(c => c.uid === id)).filter(Boolean);
};
H.pickUnit = async (G, p, units, title, optional = false) => {
  if (!units.length) return null;
  const r = await ask(G, p, 'pick', { kind: 'units', title, options: units.map(u => ({ id: u.uid, card: u })), min: optional ? 0 : 1, max: 1, optional });
  return r && r.length ? units.find(u => u.uid === r[0]) || null : null;
};
H.yesNo = async (G, p, title, yes = 'ใช่', no = 'ไม่') => {
  const r = await ask(G, p, 'pick', { kind: 'choice', title, options: [{ id: 'y', label: yes }, { id: 'n', label: no }], min: 1, max: 1 });
  return !!(r && r[0] === 'y');
};
H.choose = async (G, p, title, labels) => {
  const r = await ask(G, p, 'pick', { kind: 'choice', title, options: labels.map((l, i) => ({ id: i, label: l })), min: 1, max: 1 });
  return r && r.length ? r[0] : 0;
};
H.order = async (G, p, title, cards) => {
  if (cards.length <= 1) return cards.slice();
  const r = await ask(G, p, 'order', { title, cards });
  const out = (r || []).map(id => cards.find(c => c.uid === id)).filter(Boolean);
  for (const c of cards) if (!out.includes(c)) out.push(c);
  return out;
};
H.discardFromHand = async (G, p, n, title) => {
  const P = G.players[p]; const out = [];
  for (let i = 0; i < n; i++) {
    if (!P.hand.length) break;
    const [c] = await H.pickCards(G, p, { title: title || 'เลือกการ์ดบนมือที่จะทิ้ง', cards: P.hand });
    if (!c) break;
    place(G, c, 'discard'); out.push(c);
    log(G, `${P.name} ทิ้ง ${c.def.name}`, p);
  }
  return out;
};
H.draw = draw;

/* ---------------------------------------------------------------- targeting */
function targetable(G, u, src, byPlayer) {
  // Guinevere style shields etc.
  for (const x of G.players[u.owner].field) {
    if (!x || silenced(G, x)) continue;
    const sh = FXOF(x).shield; if (sh && !sh(G, x, u, src, byPlayer)) return false;
    for (const e of x.equips) { const she = FXOF(e).shield; if (she && !she(G, e, u, src, byPlayer)) return false; }   // Equipment ที่คุ้มครองผู้สวมใส่ (BT01-074, BT01-086)
  }
  return true;
}
H.targetable = targetable;
H.oppUnits = (G, p, filter, src) => G.players[opp(p)].field.filter(u => u && targetable(G, u, src, p) && (!filter || filter(u)));
H.myUnits = (G, p, filter) => G.players[p].field.filter(u => u && (!filter || filter(u)));
H.immuneToEffect = (G, u) => {
  if (u.zone !== 'field') return false;
  for (const e of u.equips) { const f = FXOF(e).equip; if (f && f.noEffectDestroy) return true; }
  return false;
};

/* Equipment ที่ผู้สวมออกจากสนาม: ปกติลง dest ถ้าการ์ดมี equip.followHost (SD05-017) ให้เจ้าของเลือก Unit ใหม่สวมต่อ */
AF.releaseEquips = async (G, host, equips, dest) => {
  for (const e of equips) {
    const f = FXOF(e).equip || {};
    if (f.followHost && e.zone === 'equip') {
      const cands = AF.equipTargets(G, e.owner, e).filter(u => u !== host);
      if (cands.length) {
        const u = await H.pickUnit(G, e.owner, cands, `${e.def.name}: เลือก Unit ที่จะสวมใส่ต่อ`);
        if (u) { e.hops = (e.hops || 0) + 1; attach(G, e, u); log(G, `${u.def.name} สวมใส่ ${e.def.name} ต่อ (ย้ายครั้งที่ ${e.hops})`, e.owner, { equip: e.uid }); continue; }
      }
    }
    place(G, e, dest);
  }
};

/* ---------------------------------------------------------------- destruction */
async function destroyUnit(G, u, by) {
  if (u.zone !== 'field') return false;
  by = by || { kind: 'effect' };
  if (by.kind === 'effect' && H.immuneToEffect(G, u)) { log(G, `${u.def.name} ไม่ถูกทำลายด้วยความสามารถการ์ด`, u.owner); return false; }
  const P = G.players[u.owner];
  const wasSilenced = silenced(G, u);
  const fx = FXOF(u);
  const equips = [...u.equips];
  let dest = 'discard';
  if (by.kind === 'battle' && !wasSilenced && fx.returnOnBattleDestroy) dest = 'hand';
  place(G, u, dest);
  const returnAll = equips.some(e => (FXOF(e).equip || {}).returnAllOnHostDestroyed);
  await AF.releaseEquips(G, u, equips, returnAll ? 'hand' : 'discard');
  for (const e of equips) { const f = (FXOF(e).equip || {}).onHostDestroyed; if (f) await f({ G, p: e.owner, self: e, host: u }); }   // Equipment ที่มีผลเมื่อผู้สวมถูกทำลาย (BT01-016)
  log(G, `${u.def.name} ของ ${P.name} ถูกทำลาย${dest === 'hand' ? ' (กลับขึ้นมือ)' : ''}`, u.owner, { destroyed: u.uid });
  G.tf.destroyed[u.owner] = true;
  if (dest === 'discard' && !wasSilenced && fx.admonish) {
    log(G, `ADMONISH: ${u.def.name}`, u.owner);
    await fx.admonish({ G, p: u.owner, self: u });
  }
  await emit(G, 'unitDestroyed', { unit: u, by, owner: u.owner, wasSilenced });
  checkEnd(G);
  return true;
}
H.destroy = destroyUnit;

/* ---------------------------------------------------------------- events */
async function emit(G, name, payload) {
  if (G.tmpHooks) for (const h of [...G.tmpHooks]) if (h.name === name) await h.fn(payload);   // ตัวดักเหตุการณ์ชั่วคราว (เช่น Counter BT01-014) หมดอายุเมื่อจบการต่อสู้
  const list = [];
  for (const pi of [G.active, opp(G.active)]) {
    const P = G.players[pi];
    const add = c => { const fx = FXOF(c); if (fx.on && fx.on[name]) list.push(c); };
    for (const u of P.field) { if (!u) continue; if (!silenced(G, u)) add(u); for (const e of u.equips) add(e); }
    for (const d of P.domains) add(d);
    for (const m of P.magic) if (m && m.linger) add(m);
    add(P.avatar.card);
  }
  for (const c of list) {
    if (G.over) return;
    const live = c.zone === 'field' || c.zone === 'domain' || c.zone === 'equip' || c.zone === 'avatar' || (c.zone === 'magic' && c.linger);
    if (!live) continue;
    if (c.zone === 'field' && silenced(G, c)) continue;
    await FXOF(c).on[name](Object.assign({ G, self: c, p: c.owner }, payload));
  }
}
AF.emit = emit;

function checkEnd(G) {
  const h0 = G.players[0].avatar.hp, h1 = G.players[1].avatar.hp;
  if (h0 <= 0 || h1 <= 0) {
    const res = h0 <= 0 && h1 <= 0 ? { winner: null, reason: 'HP ของทั้งสองฝ่ายเหลือ 0 พร้อมกัน' } : { winner: h0 <= 0 ? 1 : 0, reason: 'HP ของ Avatar เหลือ 0' };
    G.over = res; throw new GameOver(res);
  }
}
AF.checkEnd = checkEnd;
function dealAvatarDamage(G, p, n, src) {
  const P = G.players[p]; P.avatar.hp -= n;
  log(G, `Avatar ของ ${P.name} ได้รับ ${n} ดาเมจ (HP ${P.avatar.hp})`, p, { dmg: n });
  checkEnd(G);
}
H.damageAvatar = dealAvatarDamage;
H.healAvatar = (G, p, n) => { const P = G.players[p]; P.avatar.hp += n; log(G, `Avatar ของ ${P.name} ได้รับพลังชีวิต +${n} (HP ${P.avatar.hp})`, p); };

/* ---------------------------------------------------------------- deck-top helpers for scripts */
H.revealTop = (G, p, n) => G.players[p].deck.slice(0, n);
H.toBottom = async (G, p, cards, title) => {
  const ordered = await H.order(G, p, title || 'เรียงการ์ดที่เหลือไว้ใต้ Main Deck (ใบแรกที่เลือก = อยู่บนสุดของที่ใต้เด็ค)', cards);
  for (const c of ordered) place(G, c, 'deckBottom');
};
// reveal top N, choose up to `count` matching cards to hand; rest go to bottom
H.digTop = async (G, p, o) => {
  const P = G.players[p];
  const top = P.deck.slice(0, o.n);
  if (!top.length) { log(G, `${P.name} ไม่มีการ์ดใน Main Deck`, p); return []; }
  log(G, `${P.name} เปิดการ์ด ${top.length} ใบบนสุดของ Main Deck: ${top.map(c => c.def.name).join(', ')}`, p, { reveal: top.map(c => c.uid) });
  const cand = top.filter(o.filter || (() => true));
  let chosen = [];
  if (cand.length) chosen = await H.pickCards(G, p, { title: o.title, cards: cand, optional: true, max: o.count || 1, kind: 'reveal', ctx: { all: top } });
  else await ask(G, p, 'pick', { kind: 'reveal', title: o.title + ' (ไม่มีการ์ดที่เข้าเงื่อนไข)', options: top.map(c => ({ id: c.uid, card: c, disabled: true })), min: 0, max: 0, optional: true });
  for (const c of chosen) {
    if (o.dest === 'field') { /* caller handles */ } else if (o.dest === 'discard') place(G, c, 'discard'); else place(G, c, 'hand');
  }
  const rest = top.filter(c => !chosen.includes(c));
  if (chosen.length) log(G, `${P.name} เลือก ${chosen.map(c => c.def.name).join(', ')}`, p, { show: chosen.map(c => c.uid) });
  await H.toBottom(G, p, rest);
  return chosen;
};
H.arrangeTop = async (G, p, n) => {
  const P = G.players[p]; const top = P.deck.slice(0, n);
  if (!top.length) return;
  const ord = await H.order(G, p, `ดูการ์ด ${top.length} ใบบนสุดของ Main Deck แล้วเรียงตามชอบ (ใบแรก = บนสุด)`, top);
  top.forEach(c => P.deck.splice(P.deck.indexOf(c), 1));
  P.deck.unshift(...ord);
  log(G, `${P.name} ดูและเรียงการ์ดบนสุดของ Main Deck ${top.length} ใบ`, p);
  await emit(G, 'arrange', { player: p });
};
H.search = async (G, p, o) => {
  const P = G.players[p];
  const pool = [];
  if (!o.from || o.from.includes('deck')) pool.push(...P.deck);
  if (o.from && o.from.includes('discard')) pool.push(...P.discard);
  const cand = pool.filter(o.filter);
  const [c] = await H.pickCards(G, p, { title: o.title, cards: cand, optional: true, kind: 'reveal', ctx: { search: true } });
  if (c) { log(G, `${P.name} ค้นหาและแสดง ${c.def.name} นำขึ้นมือ`, p, { show: [c.uid] }); place(G, c, 'hand'); }
  shuffleDeck(G, p);
  return c || null;
};

/* special / effect-based entry to Action Zone */
H.enterField = async (G, p, card, o = {}) => {
  const P = G.players[p];
  if (!AF.freeSlot(P)) { log(G, `Action Zone เต็ม ไม่สามารถนำ ${card.def.name} ลงสนาม`, p); return false; }
  place(G, card, 'field', { state: o.state || 'stand' });
  log(G, `${card.def.name} เข้าสู่ Action Zone ของ ${P.name}${o.adv ? ' (อัญเชิญ)' : ''}`, p, { enter: card.uid });
  await emit(G, 'unitEntered', { unit: card, via: o.adv ? 'summon' : 'effect', byEffect: !!o.byEffect, effectOwner: o.effectOwner ?? p });
  if (o.adv && !silenced(G, card)) { const fx = FXOF(card); if (fx.advent) await runAbility(G, p, card, fx.advent, 'unit-ability', 'ADVENT'); }
  return true;
};

/* ---------------------------------------------------------------- spell costs */
/* การ์ด Ultimate ที่วางใน Domain Zone แล้วมีการ์ดซ้อนใต้ (fx.bookCost, SD06-019): ใช้แทนการจ่าย 1 Element เมื่อร่าย Spell/เรียก Unit */
AF.bookHolder = (G, p, card) => {
  if (!card || !(card.def.type === 'Spell' || card.def.kind === 'Unit')) return null;
  return G.players[p].domains.find(d => FXOF(d).bookCost && d.under && d.under.length) || null;
};
AF.useBook = (G, p) => {
  const d = AF.bookHolder(G, p, { def: { type: 'Spell' } }); if (!d) return;
  const b = d.under.shift(); place(G, b, 'discard');
  log(G, `${d.def.name}: ส่ง ${b.def.name} ลงกองทิ้ง ใช้แทนการจ่าย 1 Element`, p);
  const fxd = FXOF(d); if (!d.under.length && fxd.bookCost.onEmpty) fxd.bookCost.onEmpty({ G, p, self: d });
};
function spellCost(G, p, card, asCounter = false, out = null) {
  const P = G.players[p]; let c = card.def.cost;
  if (c <= 0) return 0;
  const fi = FXOF(card).freeIf; if (fi && fi(G, p, card)) return 0;   // ร่ายฟรีเมื่อเข้าเงื่อนไข (SD06-014)
  if (card.def.type === 'Spell' && P.spellDiscountUntil >= G.turn) c = Math.max(1, c - 1);
  if ((card.def.kind === 'Counter' || asCounter) && P.counterDiscount && P.counterDiscount.turn === G.turn && !P.counterDiscount.used) c = Math.max(1, c - 1);
  const cm = FXOF(P.avatar.card).costMod;   // Avatar ลดค่าร่ายการ์ดบางใบ (SD05-001)
  if (cm) c = Math.max(0, c - (cm(G, p, card) || 0));
  if (c >= 1 && card.def.kind !== 'Ultimate' && AF.bookHolder(G, p, card)) { c--; if (out) out.book = true; }
  return c;
}
AF.spellCost = spellCost;
AF.unitCost = (G, p, card, out = null) => {
  let c = card.def.cost;
  for (const d of G.players[p].domains) { const m = FXOF(d).unitCostMod; if (m) c -= m(G, p, card) || 0; }   // Domain ลดค่าอัญเชิญ (BT01-096)
  c = Math.max(0, c);
  if (c >= 1 && AF.bookHolder(G, p, card)) { c--; if (out) out.book = true; }
  return c;
};

/* ---------------------------------------------------------------- chain / stack */
async function runChain(G, first) {
  const prev = G.stack; const chain = [first]; G.stack = chain; G.version++;
  try {
    let last = first;
    while (!G.over) {
      const r = opp(last.controller);
      const opts = counterOptions(G, r, last, chain);
      if (!opts.length) break;
      const pick = await ask(G, r, 'respond', { item: last, chain, options: opts.map(c => c.uid) });
      if (pick == null) break;
      const card = opts.find(c => c.uid === pick); if (!card) break;
      const it = await buildCounter(G, r, card, last);
      chain.push(it); last = it; G.version++;
    }
    while (chain.length) { const it = chain.pop(); G.stack = chain.slice(); await resolveItem(G, it); }
  } finally { G.stack = prev; G.version++; }
}
AF.runChain = runChain;

function counterOptions(G, r, last, chain) {
  const P = G.players[r];
  const out = [];
  if (last.kind === 'attack' && last.attacker && hasFlag(last.attacker, 'noCounter')) return out;   // การโจมตีที่ถูกตอบโต้ด้วย Counter ไม่ได้ (BT01-031)
  for (const c of P.hand) {
    const fx = FXOF(c); if (!fx.counter) continue;
    if (!fx.counter.when(G, r, last, chain)) continue;
    const cost = spellCost(G, r, c, true);
    if (standElems(P).length < cost) continue;
    if (fx.counter.life && P.avatar.hp <= fx.counter.life) continue;
    if (c.def.kind === 'Counter' && !P.magic.includes(null)) continue;
    out.push(c);
  }
  return out;
}
async function buildCounter(G, r, card, last) {
  const P = G.players[r]; const fx = FXOF(card);
  const bk = {}; const cost = spellCost(G, r, card, true, bk);
  await payElems(G, r, cost, null, `ร่าย ${card.def.name}`);
  if (bk.book) AF.useBook(G, r);
  if (fx.counter.life) { P.avatar.hp -= fx.counter.life; log(G, `${P.name} จ่ายพลังชีวิต ${fx.counter.life} หน่วย (HP ${P.avatar.hp})`, r); checkEnd(G); }
  if (P.counterDiscount && P.counterDiscount.turn === G.turn && !P.counterDiscount.used && cost < card.def.cost) P.counterDiscount.used = true;
  if (card.def.kind === 'Counter') place(G, card, 'magic'); else place(G, card, 'limbo');
  log(G, `${P.name} ใช้ COUNTER: ${card.def.name}`, r, { counter: card.uid });
  const it = {
    kind: card.def.kind === 'Ultimate' ? 'ultimate' : 'spell', controller: r, source: card, label: card.def.name, isCounter: true, target: last,
    resolve: async (self) => {
      P.counterCount++;
      await emit(G, 'spellCast', { card, player: r });
      await fx.counter.resolve({ G, p: r, self: card, item: self, target: last });
      if (fx.prophecySpell) await runSpellProphecy(G, r, card, fx);
    },
    after: async () => { if (card.zone === 'magic' || card.zone === 'limbo') place(G, card, 'discard'); }
  };
  return it;
}
async function resolveItem(G, it) {
  if (G.over) return;
  if (it.cancelled) log(G, `ผลของ ${it.label || it.source.def.name} ถูกยกเลิก`, it.controller);
  else await it.resolve(it);
  if (it.after) await it.after(it);
  G.version++;
}
H.cancel = (G, it) => { if (it) { it.cancelled = true; } };

/* ---------------------------------------------------------------- abilities */
const kindByZone = { field: 'unit-ability', discard: 'unit-ability', hand: 'unit-ability', avatar: 'avatar-ability', equip: 'equip-ability', domain: 'domain-ability' };
/* via = Unit ที่สั่งใช้ความสามารถนี้ซ้ำ (เช่น ฮัสซัน ร้อยหน้า): "การ์ดนี้/Unit นี้" ในข้อความความสามารถ = via ไม่ใช่เจ้าของข้อความ */
async function runAbility(G, p, card, ab, kind, label, via = null) {
  const ctx = { G, p, self: card, ab, via };
  let tg = null;
  if (ab.targets) { tg = await ab.targets(ctx); if (tg === undefined || tg === false) return false; }
  if (ab.optional) { const yes = await H.yesNo(G, p, `ใช้ความสามารถ ${label || ''} ของ ${card.def.name}?`); if (!yes) return false; }
  log(G, `${G.players[p].name} ใช้ ${label || 'ความสามารถ'} ของ ${card.def.name}`, p, { ability: card.uid });
  const item = { kind: kind || 'unit-ability', controller: p, source: via || card, label: `${label || ''} ${card.def.name}`.trim(), resolve: async (it) => { await ab.resolve({ G, p, self: card, via, item: it }, tg); if (ab.prophecy) { /* handled in resolve */ } } };
  await runChain(G, item);
  return true;
}
AF.runAbility = runAbility;

async function declareProphecy(G, p, card, onSuccess) {
  const P = G.players[p];
  const names = [...new Set([...P.deck, ...P.hand, ...P.discard].map(c => c.def.name))];
  const deckNames = [...new Set(P.deck.map(c => c.def.name))];
  const pool = deckNames.length ? deckNames : names;
  if (!P.deck.length) { log(G, `${P.name} ประกาศ PROPHECY ไม่ได้ (Main Deck ว่าง)`, p); return false; }
  const r = await ask(G, p, 'pick', { kind: 'names', title: `PROPHECY (${card.def.name}): ประกาศชื่อการ์ดใบบนสุดของ Main Deck`, options: pool.map(n => ({ id: n, label: n })), min: 1, max: 1, ctx: { prophecy: true } });
  const guess = r && r[0];
  const top = P.deck[0];
  log(G, `${P.name} ประกาศ "${guess}" — เปิดเผยการ์ดบนสุด: ${top.def.name}`, p, { reveal: [top.uid] });
  if (top.def.name === guess) { log(G, `PROPHECY สำเร็จ!`, p); await onSuccess(); return true; }
  log(G, `PROPHECY พลาด`, p); return false;
}
H.prophecy = declareProphecy;
async function runSpellProphecy(G, p, card, fx) {
  const ok = await H.yesNo(G, p, `ลอง PROPHECY ของ ${card.def.name}?`, 'ประกาศ', 'ข้าม');
  if (!ok) return;
  await declareProphecy(G, p, card, () => fx.prophecySpell({ G, p, self: card }));
}

/* abilities discovery */
function abilityList(G, p, phase) {
  const P = G.players[p]; const out = [];
  const add = (card, ab, zone) => {
    if (ab.phase && ab.phase !== phase) return;
    if (!ab.phase && phase !== 'main') return;
    const key = card.uid + ':' + ab.id;
    const uses = P.used[key] && P.used[key].turn === G.turn ? P.used[key].n : 0;
    if (uses >= (ab.uses || 1)) return;
    const ctx = { G, p, self: card, ab };
    if (ab.can && !ab.can(ctx)) return;
    if (ab.spend && standElems(P, ab.spendEl).length < ab.spend) return;
    out.push({ t: 'ability', uid: card.uid, aid: ab.id, label: ab.label, kw: ab.kw, zone, ab, card });
  };
  const A = card => (FXOF(card).abilities || []);
  add && A(P.avatar.card).forEach(ab => add(P.avatar.card, ab, 'avatar'));
  for (const u of P.field) { if (!u || silenced(G, u)) continue; A(u).filter(a => (a.zone || 'field') === 'field').forEach(ab => add(u, ab, 'field')); for (const e of u.equips) A(e).filter(a => a.zone === 'equip').forEach(ab => add(e, ab, 'equip')); if (u.def.swordUnit) A(u).filter(a => a.zone === 'equip').forEach(ab => add(u, ab, 'field')); }
  for (const d of P.domains) A(d).filter(a => a.zone === 'domain').forEach(ab => add(d, ab, 'domain'));
  for (const c of P.discard) A(c).filter(a => a.zone === 'discard').forEach(ab => add(c, ab, 'discard'));
  for (const c of P.hand) A(c).filter(a => a.zone === 'hand').forEach(ab => add(c, ab, 'hand'));
  return out;
}

/* ---------------------------------------------------------------- legality / explanations */
function whyNot(G, p, card) {
  const P = G.players[p]; const d = card.def; const fx = FXOF(card);
  if (card.zone !== 'hand') return 'ไม่ได้อยู่บนมือ';
  if (d.kind === 'Unit') {
    if (fx.cantSummonFromHand) return 'อัญเชิญจากมือไม่ได้ (ดูความสามารถ ANNOUNCE)';
    if (!AF.freeSlot(P)) return `Action Zone เต็ม (${P.fieldCap ?? 4} ช่อง)`;
    if (standElems(P, fx.anyElementCost || anyElFor(G, p, card) ? null : d.els).length < AF.unitCost(G, p, card)) return `Element ธาตุ${d.els.join('/')}ที่พร้อมใช้ไม่พอ (ต้องการ ${AF.unitCost(G, p, card)})`;
    return null;
  }
  if (d.kind === 'Counter') return 'ใช้ตอบโต้ได้เท่านั้น (ตอนคู่ต่อสู้ทำอะไรบางอย่าง)';
  if (d.kind === 'Enchant' || d.kind === 'Equipment' || d.kind === 'Domain') {
    const cost = spellCost(G, p, card);
    if (standElems(P, anyElFor(G, p, card) ? null : fx.costEl).length < cost) return `Element${fx.costEl ? 'ธาตุ' + fx.costEl : ''}ที่พร้อมใช้ไม่พอ (ต้องการ ${cost})`;
    if (d.kind === 'Enchant' && !P.magic.includes(null)) return 'Magic Area เต็ม 3 ช่อง';
    if (d.kind === 'Equipment') { if (!equipTargets(G, p, card).length) return 'ไม่มี Unit ที่สวมใส่ได้'; }
    if (d.kind === 'Domain') {
      if (P.domains.some(x => x.def.name === d.name)) return 'ห้ามมี Domain ชื่อซ้ำกัน';
      if (P.domains.length >= AF.DOMAIN_LIMIT) return `Domain Zone เต็ม (${AF.DOMAIN_LIMIT} ใบ)`;
    }
    if (fx.castLife && P.avatar.hp <= fx.castLife) return `พลังชีวิตไม่พอจ่ายค่าร่าย (ต้องจ่าย ${fx.castLife} และ HP ต้องเหลืออย่างน้อย 1)`;
    if (fx.spell && fx.spell.can && !fx.spell.can({ G, p, self: card })) return fx.spell.cantReason || 'เงื่อนไขการร่ายยังไม่ครบ';
    return null;
  }
  if (d.kind === 'Ultimate') return 'ใช้ได้เฉพาะใน Ultimate Phase';
  return 'เล่นไม่ได้';
}
AF.whyNot = whyNot;

function equipTargets(G, p, card) {
  const fx = FXOF(card).equip || {};
  return G.players[p].field.filter(u => u && (!fx.canEquip || fx.canEquip(G, u, card)) && (u.equips.length === 0 || (fx.extra && fx.extra(G, u, card))));
}
AF.equipTargets = equipTargets;

AF.legal = function (G, p, phase) {
  const P = G.players[p]; const acts = [];
  if (phase === 'main') {
    for (const c of P.hand) {
      const k = c.def.kind;
      if (k === 'Unit' && !whyNot(G, p, c)) acts.push({ t: 'summon', uid: c.uid, card: c });
      else if (k === 'Enchant' && !whyNot(G, p, c)) acts.push({ t: 'spell', uid: c.uid, card: c });
      else if (k === 'Equipment' && !whyNot(G, p, c)) acts.push({ t: 'equip', uid: c.uid, card: c });
      else if (k === 'Domain' && !whyNot(G, p, c)) acts.push({ t: 'domain', uid: c.uid, card: c });
    }
    acts.push(...abilityList(G, p, 'main'));
  } else if (phase === 'ultimate') {
    for (const c of P.hand) if (c.def.kind === 'Ultimate') {
      const cost = spellCost(G, p, c);
      const fx = FXOF(c);
      if (standElems(P).length >= cost && (!fx.ultimate || !fx.ultimate.can || fx.ultimate.can({ G, p, self: c }))) acts.push({ t: 'ultimate', uid: c.uid, card: c });
    }
  }
  acts.push({ t: 'pass' });
  return acts;
};
const actKey = a => `${a.t}:${a.uid || ''}:${a.aid || ''}`;
AF.actKey = actKey;

AF.tauntUnits = (G, p) => G.players[opp(p)].field.filter(u => u && hasFlag(u, 'taunt') && !silenced(G, u)); // Unit ที่ฝ่าย p ต้องทำลายก่อน
AF.attackLocked = G => G.players.some(P => P.magic.some(m => m && m.linger && FXOF(m).lockAttacks));
AF.avatarAttackable = (G, p) => { const o = G.players[opp(p)]; const us = o.field.filter(Boolean); if (AF.tauntUnits(G, p).length) return false; return us.length === 0 || us.every(u => u.state === 'rest'); };
AF.legalAttacks = function (G, p) {
  const P = G.players[p]; const O = G.players[opp(p)]; const out = [];
  if (AF.attackLocked(G) || P.noAttackTurn === G.turn) return out;   // noAttackTurn: Unit ฝ่ายนี้ประกาศโจมตีไม่ได้ทั้งเทิร์น (SD06-013)
  const restOkAv = P.avatar && P.avatar.card && FXOF(P.avatar.card).restAttack;
  const restAttackOk = !!restOkAv;
  for (const u of P.field) {
    if (!u || (u.enteredTurn === G.turn && !hasFlag(u, 'haste'))) continue;
    /* Avatar ที่มี restAttack (เช่น BT01-001): Unit ที่นอนอยู่ประกาศโจมตีได้ แต่ได้ครั้งเดียวต่อเทิร์น (กันโจมตีวนซ้ำ) */
    if (u.state !== 'stand' && !(restAttackOk && u.attackedTurn !== G.turn)) continue;
    if (hasFlag(u, 'noAttack')) continue;
    const targets = O.field.filter(Boolean).map(t => ({ unit: t }));
    const av = AF.avatarAttackable(G, p) || hasFlag(u, 'direct');   // flag 'direct' = โจมตี Avatar ได้โดยตรง
    const tn = AF.tauntUnits(G, p);
    out.push({ attacker: u, units: tn.length ? tn : O.field.filter(Boolean), avatar: av });
  }
  return out.filter(a => a.units.length || a.avatar);
};

/* ---------------------------------------------------------------- actions */
async function payAndCast(G, p, card, kind) {
  const P = G.players[p]; const fx = FXOF(card);
  const bk = {}; const cost = spellCost(G, p, card, false, bk);
  await payElems(G, p, cost, anyElFor(G, p, card) ? null : (fx.costEl || null), `ร่าย ${card.def.name}`);   // costEl = ค่าร่ายต้องเป็น Element ธาตุนี้ (เช่น "Spend 1 fire Element")
  if (bk.book) AF.useBook(G, p);
  if (fx.castLife) { P.avatar.hp -= fx.castLife; log(G, `${P.name} จ่ายพลังชีวิต ${fx.castLife} หน่วย (HP ${P.avatar.hp})`, p); checkEnd(G); }   // ค่าร่ายเป็นพลังชีวิต
  if (P.counterDiscount && P.counterDiscount.turn === G.turn && !P.counterDiscount.used && kind === 'Counter') P.counterDiscount.used = true;
  const slot = kind === 'Enchant';
  if (slot) place(G, card, 'magic'); else place(G, card, 'limbo');
  P.castNames = P.castNames || {}; P.castNames[card.def.name] = G.turn;
  log(G, `${P.name} ร่าย ${card.def.name}${cost ? ` (Spend ${cost} Element)` : ''}`, p, { cast: card.uid });
  await emit(G, 'spellCast', { card, player: p });
  return cost;
}

async function castEnchant(G, p, card) {
  const fx = FXOF(card);
  await payAndCast(G, p, card, 'Enchant');
  const item = {
    kind: 'spell', controller: p, source: card, label: card.def.name,
    resolve: async (self) => {
      if (fx.spell && fx.spell.resolve) await fx.spell.resolve({ G, p, self: card, item: self });
      else log(G, `(${card.def.name} ยังไม่มีสคริปต์เอฟเฟกต์ — ใช้แถบเครื่องมือทำผลเอง)`, p);
      if (fx.prophecySpell) await runSpellProphecy(G, p, card, fx);
    },
    after: async () => { if (card.zone === 'magic' && !card.linger) place(G, card, 'discard'); else if (card.zone === 'limbo') place(G, card, 'discard'); }
  };
  await runChain(G, item);
}
async function castEquip(G, p, card) {
  const fx = FXOF(card);
  await payAndCast(G, p, card, 'Equipment');
  const item = {
    kind: 'spell', controller: p, source: card, label: card.def.name,
    resolve: async () => {
      const targets = equipTargets(G, p, card);
      const u = await H.pickUnit(G, p, targets, `เลือก Unit ที่จะสวมใส่ ${card.def.name}`);
      if (!u) { log(G, 'ไม่มี Unit ให้สวมใส่', p); return; }
      attach(G, card, u); log(G, `${u.def.name} สวมใส่ ${card.def.name}`, p, { equip: card.uid });
    },
    after: async () => { if (card.zone === 'limbo') place(G, card, 'discard'); }
  };
  await runChain(G, item);
}
async function castDomain(G, p, card) {
  const P = G.players[p];
  await payAndCast(G, p, card, 'Domain');
  const item = {
    kind: 'spell', controller: p, source: card, label: card.def.name,
    resolve: async () => {
      place(G, card, 'domain'); log(G, `${P.name} วาง Domain ${card.def.name}`, p, { domain: card.uid });
      const dfx = FXOF(card); if (dfx.domainEnter) await dfx.domainEnter({ G, p, self: card });
    },
    after: async () => { if (card.zone === 'limbo') place(G, card, 'discard'); }
  };
  await runChain(G, item);
}
async function summonFromHand(G, p, card) {
  const P = G.players[p];
  const bk = {}; await payElems(G, p, AF.unitCost(G, p, card, bk), FXOF(card).anyElementCost || anyElFor(G, p, card) ? null : card.def.els, `อัญเชิญ ${card.def.name}`);
  if (bk.book) AF.useBook(G, p);
  place(G, card, 'field', { state: 'stand' });
  log(G, `${P.name} อัญเชิญ ${card.def.name} (Invite ${card.def.cost})`, p, { enter: card.uid });
  await emit(G, 'unitEntered', { unit: card, via: 'summon', byEffect: false });
  const fx = FXOF(card);
  if (fx.advent && !silenced(G, card)) await runAbility(G, p, card, fx.advent, 'unit-ability', 'ADVENT');
}
async function castUltimate(G, p, card) {
  const fx = FXOF(card);
  const cost = spellCost(G, p, card);
  await payElems(G, p, cost, null, `ULTIMATE ${card.def.name}`);
  place(G, card, 'limbo');
  log(G, `${G.players[p].name} ใช้ ULTIMATE: ${card.def.name} (Spend ${cost})`, p, { cast: card.uid });
  const item = {
    kind: 'ultimate', controller: p, source: card, label: card.def.name,
    resolve: async (self) => { if (fx.ultimate && fx.ultimate.resolve) await fx.ultimate.resolve({ G, p, self: card, item: self }); else log(G, `(${card.def.name} ยังไม่มีสคริปต์เอฟเฟกต์ — ใช้แถบเครื่องมือทำผลเอง)`, p); },
    after: async () => { if (card.zone === 'limbo') place(G, card, 'discard'); }
  };
  await runChain(G, item);
}
async function useAbility(G, p, a) {
  const P = G.players[p]; const { card, ab } = a;
  const key = card.uid + ':' + ab.id;
  const prev = P.used[key] && P.used[key].turn === G.turn ? P.used[key].n : 0;
  P.used[key] = { turn: G.turn, n: prev + 1 };
  if (ab.spend) await payElems(G, p, ab.spend, ab.spendEl || null, `ใช้ความสามารถ ${card.def.name}`);
  if (ab.pay) await ab.pay({ G, p, self: card, ab });
  const kind = kindByZone[a.zone] || 'unit-ability';
  const run = ab.prophecy ? { resolve: async (ctx) => { await declareProphecy(G, p, card, () => ab.resolve(ctx, null)); } } : ab;
  if (ab.prophecy) {
    const kwName = ab.kw ? ab.kw.split(' ')[0] : 'PROPHECY';
    log(G, `${P.name} ใช้ ${kwName} ของ ${card.def.name} (ประกาศชื่อการ์ด)`, p);
    const item = { kind, controller: p, source: card, label: kwName + ' ' + card.def.name, resolve: async (it) => { await declareProphecy(G, p, card, () => ab.resolve({ G, p, self: card, item: it }, null)); } };
    await runChain(G, item);
  } else {
    const ok = await runAbility(G, p, card, ab, kind, ab.kw ? ab.kw.split(' ')[0] : 'ความสามารถ');
    if (!ok) { P.used[key] = { turn: G.turn, n: prev }; }
  }
}
async function doAction(G, p, a) {
  const c = a.card;
  switch (a.t) {
    case 'summon': return summonFromHand(G, p, c);
    case 'spell': return castEnchant(G, p, c);
    case 'equip': return castEquip(G, p, c);
    case 'domain': return castDomain(G, p, c);
    case 'ultimate': return castUltimate(G, p, c);
    case 'ability': return useAbility(G, p, a);
  }
}

/* ---------------------------------------------------------------- attack */
async function resolveAttack(G, item) {
  const a = item.attacker; const t = item.target; const p = a.owner;
  if (a.zone !== 'field') return;
  if (t === 'avatar') {
    if (!AF.avatarAttackable(G, p) && !hasFlag(a, 'direct')) { log(G, 'การโจมตี Avatar ไม่เป็นผล (ฝ่ายตรงข้ามมี Unit ที่ Stand อยู่)', p); return; }
    const dmg = stat(G, a, 'cri');
    log(G, `${a.def.name} โจมตี Avatar ของ ${G.players[opp(p)].name} (CRI ${dmg})`, p, { atkAvatar: a.uid });
    if (dmg > 0) dealAvatarDamage(G, opp(p), dmg, a);
    await emit(G, 'attackSuccess', { attacker: a, target: 'avatar', destroyed: false });
  } else {
    if (t.zone !== 'field') return;
    const atk = stat(G, a, 'atk'), def = stat(G, t, 'def');
    let success;
    if (a.def.id === 'SD01-002' && !silenced(G, a) && stat(G, t, 'atk') <= stat(G, a, 'def')) {
      const P = G.players[p];
      if (P.hand.length) {
        log(G, `ธีอัลฟี: ต้องทิ้งการ์ดบนมือ 1 ใบเพื่อทำลาย ${t.def.name}`, p);
        const d = await H.discardFromHand(G, p, 1, 'ธีอัลฟี: เลือกการ์ดบนมือที่จะทิ้งเพื่อทำลายเป้าหมาย'); success = d.length > 0;
      } else { success = false; log(G, 'ธีอัลฟี: ไม่มีการ์ดบนมือให้ทิ้ง การโจมตีไม่สำเร็จ', p); }
    } else success = atk >= def;
    log(G, `${a.def.name} (ATK ${atk}) ต่อสู้กับ ${t.def.name} (DEF ${def}) → ${success ? 'โจมตีสำเร็จ' : 'โจมตีไม่สำเร็จ'}`, p, { battle: [a.uid, t.uid] });
    if (success) {
      const ok = await destroyUnit(G, t, { kind: 'battle', attacker: a, player: p });
      await emit(G, 'attackSuccess', { attacker: a, target: t, destroyed: ok });
      if (ok && a.zone === 'field' && hasFlag(a, 'rekill')) { if (AF.setStand(G, a)) log(G, `${a.def.name} กลับเป็น Stand และโจมตีได้อีกครั้ง`, p); }
    }
  }
}
async function declareAttack(G, p, a, target) {
  const wasRest = a.state !== 'stand';   // ประกาศโจมตีทั้งที่นอนอยู่ (ผ่าน BT01-001) ให้ Equipment อย่าง BT01-015 ตรวจได้
  a.state = 'rest'; a.attackedTurn = G.turn;
  const tn = target === 'avatar' ? `Avatar ของ ${G.players[opp(p)].name}` : target.def.name;
  log(G, `${G.players[p].name} สั่ง ${a.def.name} โจมตี ${tn}`, p, { attack: a.uid, target: target === 'avatar' ? 'avatar' : target.uid });
  const item = { kind: 'attack', controller: p, source: a, attacker: a, target, label: 'การโจมตี', resolve: (it) => resolveAttack(G, it) };
  await emit(G, 'attackDeclared', { item, attacker: a, target, wasRest });
  await runChain(G, item);
  // end of battle: drop battle-long modifiers
  for (const P of G.players) for (const u of P.field) if (u) u.mods = u.mods.filter(m => m.until !== 'battle');
  if (G.tmpHooks) G.tmpHooks = G.tmpHooks.filter(h => !h.battle);
  await emit(G, 'attackResolved', { item, attacker: a, target });   // จบการต่อสู้ (ใช้โดย BT01-043)
  if (a.zone === 'field' && hasFlag(a, 'doubleStrike') && !a.flags.dsUsed) { a.flags.dsUsed = true; if (AF.setStand(G, a)) log(G, `${a.def.name} DoubleStrike: กลับเป็น Stand โจมตีได้อีกครั้ง`, p); }
  if (a.zone === 'field' && hasFlag(a, 'multiStand') && (a.flags.msUsed || 0) < 2) { a.flags.msUsed = (a.flags.msUsed || 0) + 1; if (AF.setStand(G, a)) log(G, `${a.def.name}: กลับเป็น Stand โจมตีได้อีกครั้ง (${a.flags.msUsed}/2)`, p); }   // BT01-030
  G.version++;
}
AF.declareAttack = declareAttack;
H.freeAttack = async (G, p, a) => {   // attack as part of an effect (no declaration window)
  const O = G.players[opp(p)];
  const tn = AF.tauntUnits(G, p);
  const units = tn.length ? tn : O.field.filter(Boolean);
  const opts = [...units.map(u => ({ id: u.uid, card: u }))];
  if (AF.avatarAttackable(G, p)) opts.push({ id: 'avatar', label: 'โจมตี Avatar', avatar: true });
  if (!opts.length) return;
  const r = await ask(G, p, 'pick', { kind: 'attackTarget', title: `เลือกเป้าหมายของ ${a.def.name}`, options: opts, min: 1, max: 1 });
  const id = r && r[0]; if (id == null) return;
  a.state = 'rest';
  const target = id === 'avatar' ? 'avatar' : units.find(u => u.uid === id);
  await resolveAttack(G, { attacker: a, target });
  if (G.tmpHooks) G.tmpHooks = G.tmpHooks.filter(h => !h.battle);
};

/* ---------------------------------------------------------------- turn loop */
async function runPhaseLoop(G, p, phase) {
  while (!G.over) {
    const acts = AF.legal(G, p, phase);
    const a = await ask(G, p, 'act', { phase, actions: acts });
    if (!a || a.t === 'pass') break;
    const real = acts.find(x => actKey(x) === actKey(a));
    if (!real) continue;
    await doAction(G, p, real);
    if (G.endNow) break;   // เอฟเฟกต์สั่งจบเทิร์นทันที (BT01-075)
  }
}
async function attackPhase(G, p) {
  while (!G.over) {
    const opts = AF.legalAttacks(G, p);
    if (!opts.length) break;
    const a = await ask(G, p, 'attack', { options: opts });
    if (!a) break;
    const o = opts.find(x => x.attacker.uid === a.attacker); if (!o) continue;
    let target = null;
    if (a.target === 'avatar') { if (!o.avatar) continue; target = 'avatar'; } else { target = o.units.find(u => u.uid === a.target); if (!target) continue; }
    await declareAttack(G, p, o.attacker, target);
  }
}

async function setup(G) {
  G.phase = 'setup';
  for (const P of G.players) { P.avatar.card.zone = 'avatar'; }
  for (const P of G.players) { draw(G, P.idx, 6); }
  const order = [G.first, opp(G.first)];
  for (const p of order) {
    const P = G.players[p];
    const mul = await ask(G, p, 'mulligan', { hand: P.hand.slice() });
    if (mul) {
      const old = P.hand.splice(0, P.hand.length); old.forEach(c => { c.zone = 'deck'; P.deck.push(c); });
      draw(G, p, 6); shuffleDeck(G, p);
      log(G, `${P.name} เปลี่ยนมือเริ่มต้น (Mulligan)`, p);
    } else log(G, `${P.name} เก็บมือเริ่มต้น`, p);
  }
  for (const P of G.players) { gainElement(G, P.idx); P.avatar.faceUp = true; }
  log(G, `เริ่มเกม! ${G.players[G.first].name} เล่นก่อน — หงายหน้า Avatar`, null);
  G.active = G.first; G.turn = 0;
}
async function takeTurn(G) {
  G.turn++; const p = G.active; const P = G.players[p];
  G.endNow = false;
  G.tf = { destroyed: [false, false], left: [0, 0] };
  for (const Q of G.players) Q.counterCount = 0;
  log(G, `── เทิร์น ${G.turn}: ${P.name} ──`, p, { divider: true });
  // Start Phase
  G.phase = 'start';
  for (const u of P.field) if (u && u.state === 'rest') AF.setStand(G, u);
  for (const e of P.elems) e.state = 'stand';
  await emit(G, 'turnStart', { player: p });
  // Draw Phase
  G.phase = 'draw';
  if (!P.deck.length) { G.over = { winner: opp(p), reason: `${P.name} จั่วการ์ดไม่ได้ (Main Deck หมด)` }; throw new GameOver(G.over); }
  draw(G, p, 1);
  if (G.turn === 1) { draw(G, p, 1); log(G, `${P.name} เป็นผู้เล่นคนแรก: ไม่ได้ Element ในเทิร์นแรก แต่จั่วเพิ่ม 1 ใบ`, p); }
  else if (gainElement(G, p)) log(G, `${P.name} ได้รับ Element +1 (มี ${P.elems.length} ใบ)`, p);
  else log(G, `Element Deck ของ ${P.name} หมดแล้ว`, p);
  // Main Phase
  G.phase = 'main'; await runPhaseLoop(G, p, 'main');
  // Attack Phase
  G.phase = 'attack'; if (!G.endNow) await attackPhase(G, p);
  // Ultimate Phase
  G.phase = 'ultimate';
  if (!G.endNow && AF.legal(G, p, 'ultimate').length > 1) await runPhaseLoop(G, p, 'ultimate');
  // End Phase
  G.phase = 'end';
  await emit(G, 'turnEnd', { player: p });
  for (const h of AF.hooks.turnEnd) await h(G, p);
  for (const Q of G.players) {
    for (const u of Q.field) if (u) u.mods = u.mods.filter(m => !(m.expireAt != null && m.expireAt <= G.turn));
    for (let i = 0; i < Q.magic.length; i++) { const m = Q.magic[i]; if (m && m.linger && m.linger.expire <= G.turn) { place(G, m, 'discard'); log(G, `${m.def.name} สิ้นสุดผลและลงกองทิ้ง`, Q.idx); } }
  }
  for (const Q of G.players) for (const u of Q.field) if (u) { delete u.flags.dsUsed; delete u.flags.msUsed; }
  G.active = opp(p);
}
AF.runGame = async function (G, maxTurns = 120) {
  try {
    await setup(G);
    while (!G.over) { await takeTurn(G); if (G.turn >= maxTurns && !G.over) { G.over = { winner: null, reason: `ครบ ${maxTurns} เทิร์น (เสมอ)` }; break; } }
  } catch (e) { if (!(e instanceof GameOver)) throw e; }
  G.phase = 'over'; log(G, G.over.winner == null ? `เสมอ — ${G.over.reason}` : `${G.players[G.over.winner].name} ชนะ! (${G.over.reason})`, G.over.winner);
  G.refresh(G);
  return G.over;
};

AF._takeTurn = takeTurn; AF._setup = setup; AF._abilityList = abilityList;

/* sandbox helpers used by UI */
AF.tools = {
  draw: (G, p) => draw(G, p, 1),
  element: (G, p) => gainElement(G, p),
  restoreElements: (G, p) => { G.players[p].elems.forEach(e => e.state = 'stand'); },
  hp: (G, p, d) => { G.players[p].avatar.hp += d; try { checkEnd(G); } catch (e) { } },
  fetch: (G, p, uid) => { const c = G.players[p].deck.find(x => x.uid === uid); if (c) { place(G, c, 'hand'); shuffleDeck(G, p); } }
};

})(globalThis.AF = globalThis.AF || {});
