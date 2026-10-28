/* AvastFall TCG – สคริปต์เอฟเฟกต์การ์ดชุด SD07 (Ocean Symphony)
   หนึ่งการ์ด = FX[id] หนึ่งรายการ + (ถ้าจำเป็น) NOTES[id] อธิบายการตีความ
   ถ้าแก้ข้อความการ์ดใน card-api ให้แก้สคริปต์ตรงนี้ แล้วอัปเดตข้อความใน js/data/snapshot.js ให้ตรงกัน */
(function (AF) {
'use strict';
const H = AF.H, FX = AF.FX = AF.FX || {}, NOTES = AF.notes = AF.notes || {};
const log = AF.log, place = AF.place, addMod = AF.addMod;
const kit = AF.fxKit;
const WATER = 'น้ำ', SINGER = 'นักร้อง';

/* ---- ตัวช่วย ---- */
const mine = (G, p, f) => H.myUnits(G, p, f);
const full = (G, p) => G.players[p].field.filter(Boolean).length >= 4;           // มี Unit ครบ 4 ใบ
const standN = (G, p) => AF.standElems(G.players[p]).length;
const isWater = c => (c.def.els || []).includes(WATER);
const pickMany = (G, p, title, cards, max) => H.pickCards(G, p, { title, cards, min: 0, max, optional: true, kind: 'units' });
const buff = (G, u, n, p, k = 'atk') => {
  if (!u || u.zone !== 'field') return;
  addMod(G, u, { [k]: n, until: 'turnEnd' });
  log(G, `${u.def.name} ได้รับ ${k.toUpperCase()} +${n} จนจบเทิร์น`, p);
};
const drawDiscard = cond => ({ resolve: async ({ G, p, self }) => {
  H.draw(G, p, 1);
  if (cond && !cond(G, p)) return;
  if (G.players[p].hand.length) await H.discardFromHand(G, p, 1, `${self.def.name}: เลือกการ์ดบนมือ 1 ใบเพื่อทิ้ง`);
} });

/* ---- 001 อาเรีย (Avatar) */
FX['SD07-001'] = {
  abilities: [{ id: 'cheer', kw: 'ACTIVATE 1/turn', zone: 'avatar', spend: 2, label: '[Spend 2 Element] เลือก Unit สูงสุด 2 ใบ ATK +1',
    can: ({ G, p }) => standN(G, p) >= 2 && mine(G, p).length > 0,
    resolve: async ({ G, p }) => {
      for (const u of await pickMany(G, p, 'อาเรีย: เลือก Unit ฝ่ายคุณสูงสุด 2 ใบ ได้รับ ATK +1', mine(G, p), 2)) buff(G, u, 1, p);
    } }],
  on: { spellCast: async ({ G, self, p, card, player }) => {
    if (player !== p || self.autoTurn === G.turn || card.def.type !== 'Spell' || card.def.cost < 2 || !isWater(card)) return;
    const u = await H.pickUnit(G, p, mine(G, p), 'อาเรีย: เลือก Unit ฝ่ายคุณ 1 ใบ ATK +1 และโจมตีได้แม้ลงมาในเทิร์นนี้', true);
    if (!u) return;
    self.autoTurn = G.turn;
    buff(G, u, 1, p); addMod(G, u, { flag: 'haste', until: 'turnEnd' });
  } } };
NOTES['SD07-001'] = 'AUTO 1/turn ทำงานเมื่อร่าย Spell ธาตุน้ำ Cost 2 ขึ้นไป (ไม่รวม Ultimate) เลือก Unit ได้หรือข้ามก็ได้ ถ้าข้ามจะยังไม่นับว่าใช้ในเทิร์นนี้';

/* ---- 002 ฟาร์ลูล */
FX['SD07-002'] = {
  on: { unitEntered: async ({ G, self, p, unit }) => {
    if (unit.owner !== p || unit.zone !== 'field' || self.zone !== 'field') return;
    buff(G, self, 1, p);
  } },
  abilities: [{ id: 'parade', kw: 'ACTIVATE 1/turn', zone: 'field', spend: 1, label: '[Spend 1 Element] ATK +2 ถ้ามี Unit ครบ 4 ใบ จั่ว 1',
    can: ({ G, p }) => standN(G, p) >= 1,
    resolve: async ({ G, p, self }) => { buff(G, self, 2, p); if (full(G, p)) H.draw(G, p, 1); } }] };
NOTES['SD07-002'] = 'AUTO นับ Unit ฝ่ายเราทุกใบที่เข้าสู่ Action Zone ในเทิร์นนั้น (รวมตัวเอง) แต่ละใบให้ ATK +1';

/* ---- 003 อามี */
FX['SD07-003'] = { on: { attackDeclared: async ({ G, self, p, attacker }) => {
  if (attacker !== self || !full(G, p)) return;
  addMod(G, self, { atk: 2, until: 'battle' }); log(G, `${self.def.name} ได้รับ ATK +2 จนจบการต่อสู้`, p);
} } };

/* ---- 004 ลิเซล็อตต์ */
FX['SD07-004'] = { advent: { resolve: async ({ G, p, self }) => {
  const P = G.players[p], c = P.deck[0];
  if (!c) { log(G, 'ไม่มีการ์ดใน Main Deck', p); return; }
  log(G, `${self.def.name}: เปิดการ์ดบนสุดของ Main Deck คือ ${c.def.name}`, p, { reveal: [c.uid] });
  if (c.def.kind === 'Unit' && c.def.cost <= 1 && AF.freeSlot(P) && await H.yesNo(G, p, `${c.def.name} (Cost ${c.def.cost}) — นำเข้าสู่ Action Zone?`)) await kit.enterByEffect(G, p, c);
  if (c.zone === 'deck') { place(G, c, 'deckBottom'); log(G, `${c.def.name} ถูกวางไว้ใต้ Main Deck`, p); }
} } };

/* ---- 005 ริล์ม: ไม่มีความสามารถ */

/* ---- 006 อีเนส */
FX['SD07-006'] = { advent: { resolve: async ({ G, p, self }) => {
  if (standN(G, p) < 1 || !(await H.yesNo(G, p, 'อีเนส: Spend 1 Element เพื่อให้ Unit นี้ได้รับ ATK +1?'))) return;
  await AF.payElems(G, p, 1, null, 'อีเนส'); buff(G, self, 1, p);
} } };

/* ---- 007 ลาห์ตี */
FX['SD07-007'] = { advent: {
  targets: async ({ G, p, self }) => (await H.pickUnit(G, p, mine(G, p, u => u !== self), 'ลาห์ตี: เลือก Unit ฝ่ายคุณอื่น 1 ใบ ได้รับ ATK +1')) || false,
  resolve: async ({ G, p }, u) => buff(G, u, 1, p) } };

/* ---- 008 / 011 จั่ว 1 แล้วทิ้ง 1 */
FX['SD07-008'] = { advent: drawDiscard() };
FX['SD07-011'] = { advent: drawDiscard() };

/* ---- 009 ลิลลี (Counter ของ Unit: ป้องกันการถูกทำลายจากการต่อสู้ของ Unit ฝ่ายเรา) */
FX['SD07-009'] = { battleSave: async ({ G, p, unit }) => {
  if (!G.players[p].hand.length) return false;
  if (!(await H.yesNo(G, p, `ลิลลี: ทิ้งการ์ดบนมือ 1 ใบ เพื่อป้องกันการทำลาย ${unit.def.name} จากการต่อสู้ครั้งนี้?`))) return false;
  const d = await H.discardFromHand(G, p, 1, 'ลิลลี: เลือกการ์ดบนมือที่จะทิ้ง');
  if (!d.length) return false;
  log(G, `ลิลลี: ${unit.def.name} ไม่ถูกทำลายจากการต่อสู้ครั้งนี้`, p); return true;
} };
NOTES['SD07-009'] = 'COUNTER ของ Unit ใช้ได้ขณะอยู่บนสนาม (ไม่ต้องใช้จากมือ) เมื่อ Unit ฝ่ายเรา (รวมตัวเอง) กำลังจะถูกทำลายจากการต่อสู้ ใช้ได้ไม่จำกัดครั้ง ตราบที่ยังมีการ์ดบนมือให้ทิ้ง';

/* ---- 010 อิซาเบลลา */
FX['SD07-010'] = { advent: { resolve: async ({ G, p, self }) => {
  const others = mine(G, p, u => u !== self);
  if (others.length && standN(G, p) >= 2 && await H.yesNo(G, p, 'อิซาเบลลา: Spend 2 Element เพื่อให้ Unit ฝ่ายคุณอื่นสูงสุด 2 ใบ ATK +1?')) {
    await AF.payElems(G, p, 2, null, 'อิซาเบลลา');
    for (const u of await pickMany(G, p, 'อิซาเบลลา: เลือก Unit ฝ่ายคุณอื่นสูงสุด 2 ใบ ได้รับ ATK +1', others, 2)) buff(G, u, 1, p);
  }
  if (!full(G, p)) return;
  for (const u of mine(G, p, u => !!(FX[u.def.id] || {}).advent)) addMod(G, u, { flag: 'haste', until: 'turnEnd' });
  log(G, 'Unit ทุกใบที่มี ADVENT โจมตีได้แม้ลงมาในเทิร์นนี้', p);
} } };
NOTES['SD07-010'] = 'เงื่อนไข Unit ครบ 4 ใบแยกจากการ Spend: ตรวจตอนเอฟเฟกต์ทำงาน และให้ Unit ที่มี ADVENT ในขณะนั้นทุกใบโจมตีได้จนจบเทิร์น';

/* ---- 012 เพิร์ช */
FX['SD07-012'] = { advent: {
  targets: async ({ G, p }) => (await H.pickUnit(G, p, mine(G, p), 'เพิร์ช: เลือก Unit ฝ่ายคุณ 1 ใบ ได้รับ CRI +1')) || false,
  resolve: async ({ G, p }, u) => buff(G, u, 1, p, 'cri') } };

/* ---- 013 รินะ */
FX['SD07-013'] = { advent: { resolve: async ({ G, p, self }) => { if (mine(G, p, u => u !== self).length) buff(G, self, 1, p); } } };

/* ---- 014 เออร์มา */
FX['SD07-014'] = { advent: drawDiscard((G, p) => G.players[p].hand.length > 5) };

/* ---- 015 เอเลนา */
FX['SD07-015'] = { advent: { resolve: async ({ G, p }) => {
  const c = G.players[p].discard.filter(x => x.def.kind === 'Unit' && x.def.cost <= 1);
  const [u] = await H.pickCards(G, p, { title: 'เอเลนา: เลือก Unit ที่มี Cost 1 หรือต่ำกว่า 1 ใบจากกองทิ้งขึ้นมือ', cards: c, optional: true, kind: 'reveal', ctx: { all: c } });
  if (u) { place(G, u, 'hand'); log(G, `นำ ${u.def.name} จากกองทิ้งขึ้นมือ`, p); }
} } };

/* ---- 016 มนตร์เสน่ห์แห่งท่วงทำนอง */
FX['SD07-016'] = { spell: { resolve: async ({ G, p, self }) => {
  buff(G, await H.pickUnit(G, p, mine(G, p), `${self.def.name}: เลือก Unit ฝ่ายคุณ 1 ใบ ได้รับ ATK +1`), 1, p);
} } };

/* ---- 017 คำสัญญาใต้แสงจันทร์ */
FX['SD07-017'] = { spell: { resolve: async ({ G, p, self }) => {
  const u = await H.pickUnit(G, p, mine(G, p), `${self.def.name}: เลือก Unit ฝ่ายคุณ 1 ใบ ได้รับ ATK +2`);
  if (!u) return;
  buff(G, u, 2, p);
  if (AF.tribeHas(u, SINGER)) H.draw(G, p, 1);
} } };

/* ---- 018 เสียงประสานแห่งมิตรภาพ */
FX['SD07-018'] = { spell: { resolve: async ({ G, p, self }) => {
  for (const u of await pickMany(G, p, `${self.def.name}: เลือก Unit ฝ่ายคุณ 2 ใบ ได้รับ ATK +1`, mine(G, p), 2)) buff(G, u, 1, p);
} } };

/* ---- 019 บทเพลงกล่อมคลื่น */
FX['SD07-019'] = { spell: { resolve: async ({ G, p, self }) => {
  buff(G, await H.pickUnit(G, p, mine(G, p), `${self.def.name}: เลือก Unit ฝ่ายคุณ 1 ใบ ได้รับ ATK +2`), 2, p);
  const c = G.players[p].discard.slice();
  const [x] = await H.pickCards(G, p, { title: `${self.def.name}: เลือกการ์ด 1 ใบจากกองทิ้งขึ้นมือ`, cards: c, kind: 'reveal', ctx: { all: c } });
  if (x) { place(G, x, 'hand'); log(G, `นำ ${x.def.name} จากกองทิ้งขึ้นมือ`, p); }
} } };

/* ---- 020 กระแสน้ำแห่งความทรงจำ */
FX['SD07-020'] = { spell: { resolve: async ({ G, p, self }) => {
  const c = G.players[p].discard.filter(x => x.def.kind === 'Unit' && isWater(x));
  const ch = c.length ? await H.pickCards(G, p, { title: `${self.def.name}: เลือก Unit ธาตุน้ำสูงสุด 4 ใบจากกองทิ้งเพื่อนำกลับเข้า Main Deck`, cards: c, min: 0, max: 4, optional: true, kind: 'reveal', ctx: { all: c } }) : [];
  for (const x of ch) place(G, x, 'deckBottom');
  AF.shuffleDeck(G, p); log(G, `นำ Unit กลับเข้า Main Deck ${ch.length} ใบ และสับ Main Deck`, p);
  H.draw(G, p, 1);
} } };
NOTES['SD07-020'] = 'ข้อความการ์ดไม่ระบุแหล่ง จึงตีความว่าเลือก Unit ธาตุน้ำจากกองทิ้ง (สูงสุด 4 ใบ) นำเข้า Main Deck → สับ → จั่ว 1';

/* ---- 021 อาณาเขตนครบาดาล (Domain) */
FX['SD07-021'] = { on: { turnEnd: async ({ G, p, player }) => {
  if (player !== p) return;
  for (const u of mine(G, p)) addMod(G, u, { def: 1 });
  log(G, 'อาณาเขตนครบาดาล: Unit ฝ่ายเราทุกใบได้รับ DEF +1', p);
} } };
NOTES['SD07-021'] = 'DEF +1 ที่ได้รับไม่มีกำหนดหมดเวลา อยู่ตราบที่ Unit ยังอยู่บนสนาม (สะสมทุกเทิร์นของเรา)';

/* ---- 022 สวนปะการังแห่งเสียงเพลง (Domain) */
FX['SD07-022'] = { abilities: [{ id: 'garden', kw: 'ACTIVATE 1/turn', zone: 'domain', label: 'ถ้ามี Unit เผ่า นักร้อง ตั้งแต่ 2 ใบ จั่ว 1',
  can: ({ G, p }) => mine(G, p, u => AF.tribeHas(u, SINGER)).length >= 2,
  resolve: async ({ G, p }) => { H.draw(G, p, 1); } }] };

/* ---- 023 ม่านน้ำป้องกันภัย (Counter) */
FX['SD07-023'] = { counter: {
  when: (G, r, last) => last.kind === 'attack' && last.target !== 'avatar' && last.target.owner === r,
  resolve: async ({ G, p, target }) => {
    const u = target.target;
    if (u !== 'avatar' && u.zone === 'field') { addMod(G, u, { flag: 'battleImmune', until: 'battle' }); log(G, `${u.def.name} ไม่ถูกทำลายจากการต่อสู้ครั้งนี้`, p); }
  } } };

/* ---- 024 เสียงประสานตัดกำลัง (Counter) */
FX['SD07-024'] = { counter: {
  when: (G, r, last) => last.controller !== r && last.kind !== 'attack' && last.source && last.source.def && /ATK\s*\+/.test(JSON.stringify(last.source.def.fx || [])) && G.players[AF.opp(r)].field.some(Boolean),
  resolve: async ({ G, p, self }) => {
    const u = await H.pickUnit(G, p, H.oppUnits(G, p, null, self), `${self.def.name}: เลือก Unit ฝ่ายตรงข้ามที่ได้รับ ATK เพิ่ม`);
    if (!u) return;
    addMod(G, u, { atk: -u.def.atk, until: 'turnEnd' });
    log(G, `${u.def.name} มี ATK ตั้งต้นเป็น 0 จนจบเทิร์น`, p);
  } } };
NOTES['SD07-024'] = 'ใช้ได้เมื่อฝ่ายตรงข้ามใช้เอฟเฟกต์ที่มีข้อความ ATK + (Counter ทำงานก่อนเอฟเฟกต์นั้นจะแก้) เลือก Unit ที่เป็นเป้า → ATK ตั้งต้นเป็น 0 (โบนัสที่ได้รับตามมายังคงอยู่) จนจบเทิร์น';

/* ---- 025 สร้อยไข่มุกแห่งเสียงสะท้อน (Equipment) */
FX['SD07-025'] = { equip: {},
  on: { attackSuccess: async ({ G, self, attacker }) => {
    if (self.zone !== 'equip' || !self.host || attacker !== self.host) return;
    H.draw(G, self.owner, 1); log(G, `${self.def.name}: ${attacker.def.name} โจมตีสำเร็จ จึงจั่วการ์ด`, self.owner);
  } } };

/* ---- 026 อัลติเมตซิมโฟนี (Ultimate) */
FX['SD07-026'] = { ultimate: { resolve: async ({ G, p, self }) => {
  for (const u of await pickMany(G, p, `${self.def.name}: เลือก Unit ฝ่ายคุณสูงสุด 4 ใบ ได้รับ ATK +3`, mine(G, p), 4)) buff(G, u, 3, p);
  H.draw(G, p, 2);
  if (!full(G, p)) return;
  for (const u of mine(G, p)) if (u.state !== 'stand') AF.setStand(G, u);
  log(G, `${self.def.name}: Unit ทุกใบเป็นสภาพ Stand และโจมตีใน Ultimate phase ได้`, p);
  while (!G.over) {
    const opts = AF.legalAttacks(G, p);
    if (!opts.length) break;
    const a = await H.pickUnit(G, p, opts.map(o => o.attacker), 'เลือก Unit ที่จะโจมตี (ปิดเพื่อจบการโจมตี)', true);
    if (!a) break;
    const o = opts.find(x => x.attacker === a);
    const labels = [...o.units.map(u => `โจมตี ${u.def.name}`), ...(o.avatar ? ['โจมตี Avatar'] : [])];
    const i = await H.choose(G, p, `${a.def.name}: เลือกเป้าหมาย`, labels);
    await AF.declareAttack(G, p, a, i < o.units.length ? o.units[i] : 'avatar');
  }
} } };
NOTES['SD07-026'] = 'ถ้ามี Unit ครบ 4 ใบ Unit ทั้งหมด Stand แล้วเปิดให้โจมตีต่อเนื่องทันทีในขั้นตอนของการ์ดนี้ (ภายใน Ultimate phase) ตามกติกาโจมตีปกติ';
})(globalThis.AF = globalThis.AF || {});
