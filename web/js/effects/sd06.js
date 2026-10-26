/* AvastFall TCG – สคริปต์เอฟเฟกต์การ์ดชุด SD06
   หนึ่งการ์ด = FX[id] หนึ่งรายการ + (ถ้าจำเป็น) NOTES[id] อธิบายการตีความ
   ถ้าแก้ข้อความการ์ดใน card-api ให้แก้สคริปต์ตรงนี้ แล้วอัปเดตข้อความใน js/data/snapshot.js ให้ตรงกัน */
(function (AF) {
'use strict';
const H = AF.H, FX = AF.FX = AF.FX || {}, NOTES = AF.notes = AF.notes || {};
const log = AF.log, place = AF.place;

/* =============================================================== SD06 */
const BOOK = 'ตำราพิชัยสงคราม', WATER = 'น้ำ';
const books = P => P.hand.filter(c => c.def.name.includes(BOOK));

/* ---- 001 ซุนวู นักยุทธศาสตร์ไร้รูปแบบ (Avatar) */
FX['SD06-001'] = { abilities: [{
  id: 'art', kw: 'ACTIVATE 1/turn', zone: 'avatar', label: '[Spend 2 Water] ทิ้ง “ตำราพิชัยสงคราม” 1 ใบ: นำ Unit ฝ่ายตรงข้าม 1 ใบไปไว้ใต้ Main Deck',
  can: ({ G, p, self }) => AF.standElems(G.players[p], WATER).length >= 2 && books(G.players[p]).length > 0 && H.oppUnits(G, p, null, self).length > 0,
  pay: async ({ G, p }) => {
    AF.spendElems(G, p, 2, WATER);
    const [c] = await H.pickCards(G, p, { title: 'ซุนวู: เลือกการ์ดที่มีคำว่า “ตำราพิชัยสงคราม” ในชื่อจากมือเพื่อทิ้ง', cards: books(G.players[p]) });
    if (c) { place(G, c, 'discard'); log(G, `${G.players[p].name} ทิ้ง ${c.def.name}`, p); }
  },
  targets: async ({ G, p, self }) => (await H.pickUnit(G, p, H.oppUnits(G, p, null, self), 'ซุนวู: เลือก Unit ฝ่ายตรงข้าม 1 ใบ นำไปไว้ใต้ Main Deck ของฝ่ายตรงข้าม')) || false,
  resolve: async ({ G, p }, u) => {
    if (!u || u.zone !== 'field') return;
    await H.removeUnit(G, u, 'deckBottom');
    log(G, `${u.def.name} ถูกนำไปไว้ใต้ Main Deck ของ ${G.players[u.owner].name}`, p);
  } }] };
NOTES['SD06-001'] = 'ค่า Spend ต้องใช้ Element ธาตุน้ำ 2 ใบ ทิ้งการ์ดเป็นค่าใช้จ่ายก่อนเลือกเป้าหมาย (ตามรูปแบบเดียวกับ SD03-009) ถ้า Unit มี Equipment สวมอยู่ Equipment จะลงกองทิ้งตามปกติ';
/* ---- 002 จางอิ่ง สายลับไร้เงา */
FX['SD06-002'] = { advent: { resolve: async ({ G, p }) => {
  const O = G.players[AF.opp(p)];
  if (!O.hand.length) { log(G, 'ฝ่ายตรงข้ามไม่มีการ์ดบนมือ', p); return; }
  const c = O.hand[Math.floor(G.rng() * O.hand.length)];
  place(G, c, 'deckBottom'); log(G, `การ์ดบนมือของ ${O.name} 1 ใบถูกนำไปไว้ใต้ Main Deck`, p);
  H.draw(G, AF.opp(p), 1);
} } };

/* ---- 003 เติ้งจือ ทูตม้าเร็ว */
FX['SD06-003'] = { advent: { resolve: async ({ G, p }) => {
  await H.digTop(G, p, { n: 2, title: 'เติ้งจือ: เลือกการ์ดที่มีคำว่า “ตำราพิชัยสงคราม” ในชื่อ 1 ใบขึ้นมือ', filter: c => c.def.name.includes(BOOK) });
} } };

/* ---- 005 เฉินเต้า ทหารล่อศึก */
FX['SD06-005'] = { admonish: async ({ G, p }) => {
  const c = H.oppUnits(G, p, u => u.state === 'rest');
  const u = await H.pickUnit(G, p, c, 'เฉินเต้า: เลือก Unit ฝ่ายตรงข้ามที่นอนอยู่ 1 ใบ นำไปไว้ใต้ Main Deck');
  if (u) { await H.removeUnit(G, u, 'deckBottom'); log(G, `${u.def.name} ถูกนำไปไว้ใต้ Main Deck`, p); }
} };

/* ---- 018 กระโจมบัญชาการลับ (Domain) */
FX['SD06-018'] = { abilities: [{
  id: 'tent', kw: 'ACTIVATE 1/turn', zone: 'domain', label: 'ทิ้ง “ตำราพิชัยสงคราม” 1 ใบจากมือ แล้วจั่ว 2',
  can: ({ G, p }) => books(G.players[p]).length > 0,
  pay: async ({ G, p }) => {
    const [c] = await H.pickCards(G, p, { title: 'กระโจมบัญชาการลับ: เลือก “ตำราพิชัยสงคราม” จากมือเพื่อทิ้ง', cards: books(G.players[p]) });
    if (c) { place(G, c, 'discard'); log(G, `${G.players[p].name} ทิ้ง ${c.def.name}`, p); }
  },
  resolve: async ({ G, p }) => { H.draw(G, p, 2); } }] };
NOTES['SD06-018'] = 'ค่าใช้จ่ายคือการทิ้งการ์ด (ทิ้งก่อนแล้วจึงจั่ว 2 ใบ)';
const opp = AF.opp, stat = AF.stat, addMod = AF.addMod;
const isBook = c => c.def.name.includes(BOOK);
const toBottom = async (G, u, p, why) => { await H.removeUnit(G, u, 'deckBottom'); log(G, `${u.def.name} ถูกนำไปไว้ใต้ Main Deck ${why || ''}`.trim(), p); };

/* ---- 004 จูกัดเหลียง ผู้พลิกกระดานศึก: Unit ฝ่ายตรงข้ามถูกส่งกลับ Main Deck จาก Action Zone → จั่ว 1 */
FX['SD06-004'] = { deckReturn: (G, self, c, z0) => {
  if (z0 === 'field' && c.def.kind === 'Unit' && c.owner !== self.owner) { H.draw(G, self.owner, 1); log(G, `${self.def.name}: Unit ของฝ่ายตรงข้ามถูกส่งกลับ Main Deck จึงจั่วการ์ด`, self.owner); }
} };

/* ---- 006 โจวยี่ แม่ทัพพัดเพลิง: ตกเป็นเป้าหมายการโจมตี → ทิ้ง 1 ใบ แล้วส่ง Unit ที่โจมตีไปใต้ Main Deck (1/turn) */
FX['SD06-006'] = { on: { attackDeclared: async ({ G, self, p, item, target }) => {
  if (target !== self || self.flags.zhouTurn === G.turn) return;
  const a = item.attacker, P = G.players[p];
  if (!P.hand.length || !a || a.zone !== 'field') return;
  if (!(await H.yesNo(G, p, `โจวยี่: ทิ้งการ์ดบนมือ 1 ใบ เพื่อนำ ${a.def.name} ไปไว้ใต้ Main Deck ของเจ้าของ?`))) return;
  self.flags.zhouTurn = G.turn;
  const d = await H.discardFromHand(G, p, 1, 'โจวยี่: เลือกการ์ดบนมือที่จะทิ้ง');
  if (d.length && a.zone === 'field') await toBottom(G, a, p, 'ของเจ้าของ');
} } };

/* ---- 007 บังทอง: ร่ายการ์ดที่ชื่อมี “ตำราพิชัยสงคราม” → จั่ว 1 (1/turn) */
FX['SD06-007'] = { on: { spellCast: async ({ G, self, p, card, player }) => {
  if (player !== p || !isBook(card) || self.flags.pangTurn === G.turn) return;
  self.flags.pangTurn = G.turn; H.draw(G, p, 1); log(G, `${self.def.name}: ร่าย ${card.def.name} จึงจั่วการ์ด`, p);
} } };

/* ---- 008 หานชิน แม่ทัพพิชิตศึก: ทำลาย Unit สำเร็จ → Spend 1 ส่ง Unit ที่ Cost น้อยกว่าไปใต้ Main Deck (1/turn) */
FX['SD06-008'] = { on: { attackSuccess: async ({ G, self, p, attacker, target, destroyed }) => {
  if (attacker !== self || !destroyed || target === 'avatar' || self.flags.hanTurn === G.turn) return;
  if (AF.standElems(G.players[p]).length < 1) return;
  const c = H.oppUnits(G, p, u => u.def.cost < target.def.cost, self);
  if (!c.length) return;
  if (!(await H.yesNo(G, p, 'หานชิน: Spend 1 Element เพื่อนำ Unit ฝ่ายตรงข้ามที่ Cost น้อยกว่าไปไว้ใต้ Main Deck?'))) return;
  self.flags.hanTurn = G.turn; await AF.payElems(G, p, 1, null, 'หานชิน');
  const u = await H.pickUnit(G, p, c, `หานชิน: เลือก Unit ฝ่ายตรงข้ามที่ Cost น้อยกว่า ${target.def.name} (${target.def.cost})`);
  if (u) await toBottom(G, u, p, 'ของฝ่ายตรงข้าม');
} } };

/* ---- 009 เว่ยเหลียว ปราชญ์แห่งตำราศึก: CRI +1 ต่อทุก 3 ใบที่เป็นตำราในกองทิ้ง */
FX['SD06-009'] = { aura: { cri: (G, self, u) => u === self ? Math.floor(G.players[self.owner].discard.filter(isBook).length / 3) : 0 } };

/* ---- 010 ปิดฟ้าข้ามทะเล: ค้าง 3 เทิร์นของฝ่ายตรงข้าม Unit ทุกใบใช้ความสามารถไม่ได้ */
FX['SD06-010'] = { silenceUnits: true,
  spell: { resolve: async ({ G, p, self }) => { self.linger = { expire: Infinity, oppTurns: 3 }; log(G, `${self.def.name} ค้างอยู่ใน Magic Area 3 เทิร์นของฝ่ายตรงข้าม — Unit ทุกใบใช้ความสามารถไม่ได้`, p); } },
  on: { turnEnd: async ({ G, self, p, player }) => {
    if (player === p || self.zone !== 'magic' || !self.linger || self.linger.oppTurns == null) return;
    self.linger.oppTurns--;
    if (self.linger.oppTurns > 0) { log(G, `${self.def.name}: เหลืออีก ${self.linger.oppTurns} เทิร์นของฝ่ายตรงข้าม`, p); return; }
    place(G, self, 'discard'); log(G, `${self.def.name} สิ้นสุดผล (ครบ 3 เทิร์นของฝ่ายตรงข้าม) และลงกองทิ้ง`, p);
  } } };

/* ---- 011 ล้อมเว่ยช่วยจ้าว */
const siegeMods = (G, u) => { addMod(G, u, { flag: 'haste', until: 'turnEnd' }); addMod(G, u, { flag: 'direct', until: 'turnEnd' }); };
FX['SD06-011'] = {
  spell: {
    can: ({ G, p }) => G.players[opp(p)].field.filter(Boolean).length === 4 && G.players[p].field.filter(Boolean).length < 4,
    cantReason: 'ต้องที่ฝ่ายตรงข้ามมี Unit 4 ใบ และคุณมี Unit น้อยกว่า',
    resolve: async ({ G, p, self }) => {
      self.linger = { expire: G.turn }; self.siegeDone = false;
      for (const u of H.myUnits(G, p)) siegeMods(G, u);
      log(G, `${self.def.name}: Unit ฝ่ายเราทุกใบโจมตีได้ทันทีและโจมตี Avatar ตรงได้จนจบเทิร์น`, p);
    } },
  on: {
    unitEntered: async ({ G, self, p, unit }) => { if (unit.owner === p && unit.zone === 'field') siegeMods(G, unit); },
    attackSuccess: async ({ G, self, p, attacker, target }) => {
      if (self.siegeDone || target !== 'avatar' || attacker.owner !== p) return;
      self.siegeDone = true;
      const u = await H.pickUnit(G, p, H.oppUnits(G, p, null, self), 'ล้อมเว่ยช่วยจ้าว: เลือก Unit ฝ่ายตรงข้าม 1 ใบ เปลี่ยนเป็นสภาพนอน');
      if (u) { u.state = 'rest'; log(G, `${u.def.name} เปลี่ยนเป็นสภาพนอน`, p); }
    } } };
NOTES['SD06-011'] = 'ร่ายได้เมื่อฝ่ายตรงข้ามมี Unit พอดี 4 ใบและเรามี Unit น้อยกว่า การ์ดค้างใน Magic Area จนจบเทิร์นเพื่อให้ Unit ที่ลงสนามหลังร่ายได้ผลด้วย Unit ที่นอนอยู่ยังโจมตีไม่ได้ตามปกติ';

/* ---- 012 ยืมดาบฆ่าคน */
FX['SD06-012'] = { spell: {
  can: ({ G, p }) => G.players[opp(p)].field.filter(Boolean).length >= 2, cantReason: 'ฝ่ายตรงข้ามต้องมี Unit อย่างน้อย 2 ใบ',
  resolve: async ({ G, p, self }) => {
    const all = H.oppUnits(G, p, null, self);
    const w = await H.pickUnit(G, p, all, 'ยืมดาบฆ่าคน: เลือก “ผู้ถือดาบ” (Unit ฝ่ายตรงข้าม)');
    if (!w) return;
    const v = await H.pickUnit(G, p, all.filter(u => u !== w), 'ยืมดาบฆ่าคน: เลือก “เหยื่อ” (Unit ฝ่ายตรงข้ามอีกใบ)');
    if (!v) return;
    const atk = stat(G, w, 'atk'), def = stat(G, v, 'def');
    log(G, `${w.def.name} (ATK ${atk}) โจมตี ${v.def.name} (DEF ${def})`, p);
    if (atk >= def) await H.destroy(G, v, { kind: 'battle', attacker: w, player: p });
    if (w.zone === 'field') { w.state = 'rest'; log(G, `${w.def.name} เปลี่ยนเป็นสภาพนอน`, p); }
  } } };

/* ---- 013 รอซ้ำยามเปลี้ย */
FX['SD06-013'] = { spell: { resolve: async ({ G, p, self }) => {
  const c = H.oppUnits(G, p, u => u.state === 'rest', self);
  const picks = await H.pickCards(G, p, { title: 'รอซ้ำยามเปลี้ย: เลือก Unit ฝ่ายตรงข้ามที่นอนอยู่ (ไม่เกิน 2 ใบ) เพื่อทำลาย', cards: c, min: 0, max: 2, optional: true, kind: 'units' });
  for (const u of picks) if (u.zone === 'field') await H.destroy(G, u, { kind: 'effect', player: p, source: self });
  G.players[p].noAttackTurn = G.turn; log(G, 'Unit ฝ่ายเราประกาศโจมตีไม่ได้จนจบเทิร์นนี้', p);
} } };

/* ---- 014 ตีชิงตามไฟ */
FX['SD06-014'] = {
  freeIf: (G, p) => (G.tf && G.tf.left ? G.tf.left[opp(p)] : 0) >= 2,
  spell: { resolve: async ({ G, p }) => {
    const P = G.players[p], O = G.players[opp(p)];
    const i = await H.choose(G, p, 'ตีชิงตามไฟ: เลือก 1 อย่าง', ['จั่วการ์ด 1 ใบ', `รับ Element 1 ใบ (${P.elems.length}/8)`, `สุ่มทิ้งการ์ดบนมือฝ่ายตรงข้าม 1 ใบ (${O.hand.length} ใบ)`]);
    if (i === 0) H.draw(G, p, 1);
    else if (i === 1) { if (P.elems.length >= 8) log(G, 'มี Element ครบ 8 ใบแล้ว ไม่ได้รับเพิ่ม', p); else if (AF.tools.element(G, p)) log(G, `${P.name} ได้รับ Element +1 (มี ${P.elems.length} ใบ)`, p); else log(G, 'Element Deck หมดแล้ว', p); }
    else if (O.hand.length) { const c = O.hand[Math.floor(G.rng() * O.hand.length)]; place(G, c, 'discard'); log(G, `สุ่มทิ้ง ${c.def.name} จากมือของ ${O.name}`, p); }
  } } };
NOTES['SD06-014'] = 'ร่ายตามปกติด้วย SpellCost 3 หากในเทิร์นนี้ Unit ฝ่ายตรงข้ามออกจาก Action Zone ตั้งแต่ 2 ใบ (ไม่ว่าด้วยเหตุใด) ค่าร่ายเป็น 0 ระบบนับการออกจากสนามตั้งแต่ต้นเทิร์น';

/* ---- 015 กลเมืองร้าง (Counter) */
FX['SD06-015'] = { counter: {
  when: (G, r, last) => last.kind === 'attack' && last.controller !== r,
  resolve: async ({ G, p, target }) => {
    H.cancel(G, target);
    const a = target.attacker; log(G, 'การโจมตีถูกยกเลิก', p);
    if (!G.players[p].hand.length || !a || a.zone !== 'field') return;
    if (!(await H.yesNo(G, p, `กลเมืองร้าง: ทิ้งการ์ดบนมือ 1 ใบ เพื่อนำ ${a.def.name} ไปไว้ใต้ Main Deck ของเจ้าของ?`))) return;
    const d = await H.discardFromHand(G, p, 1, 'กลเมืองร้าง: เลือกการ์ดบนมือที่จะทิ้ง');
    if (d.length && a.zone === 'field') await toBottom(G, a, p, 'ของเจ้าของ');
  } } };

/* ---- 016 ซ่อนดาบในรอยยิ้ม (Counter) */
FX['SD06-016'] = { counter: {
  when: (G, r, last) => last.controller !== r && last.kind === 'spell' && last.source.def.type === 'Spell',
  resolve: async ({ G, p, target }) => {
    H.cancel(G, target);
    const c = target.source;
    target.after = async () => { if (c.zone === 'magic' || c.zone === 'limbo') { place(G, c, 'deckBottom'); log(G, `${c.def.name} ถูกนำไปไว้ใต้ Main Deck ของเจ้าของแทนการลงกองทิ้ง`, p); } };
  } } };

/* ---- 017 พัดยุทธศาสตร์โบราณ: ทุกครั้งที่การ์ดฝ่ายตรงข้ามถูกส่งกลับ Main Deck ผู้สวมใส่ ATK/DEF +1 (สะสม ตราบที่ยังสวมใส่) */
const fanBonus = (G, self, u) => {
  if (!self.host || u !== self.host) return 0;
  if (self.fanHost !== self.host) { self.fanHost = self.host; self.fanCount = 0; }
  return self.fanCount || 0;
};
FX['SD06-017'] = {
  equip: {},
  aura: { atk: (G, self, u) => fanBonus(G, self, u), def: (G, self, u) => fanBonus(G, self, u) },
  deckReturn: (G, self, c, z0) => {
    if (self.zone !== 'equip' || !self.host || c.owner === self.owner) return;
    fanBonus(G, self, self.host); self.fanCount++;
    log(G, `${self.def.name}: ${self.host.def.name} ได้รับ ATK/DEF +1 (รวม +${self.fanCount})`, self.owner);
  } };
NOTES['SD06-017'] = 'โบนัสสะสมทุกครั้งที่การ์ดฝ่ายตรงข้ามถูกส่งกลับ Main Deck จากโซนใดก็ตาม (ไม่นับการเรียงใหม่ภายใน Main Deck) โบนัสหายเมื่อพัดออกจากผู้สวม';

/* ---- 019 พิชิตศัตรูโดยไม่ต้องรบ (Ultimate → Domain Zone) */
const finishSun = ({ G, p, self }) => {
  log(G, `${self.def.name}: ไม่มีการ์ดใต้ใบนี้แล้ว ลงกองทิ้งและสร้างความเสียหาย 4 หน่วยแก่ฝ่ายตรงข้าม`, p);
  place(G, self, 'discard'); H.damageAvatar(G, opp(p), 4);
};
FX['SD06-019'] = {
  bookCost: { onEmpty: finishSun },
  ultimate: {
    can: ({ G, p }) => G.players[p].domains.length < AF.DOMAIN_LIMIT,
    resolve: async ({ G, p, self }) => {
      const P = G.players[p];
      place(G, self, 'domain'); self.under = [];
      for (const b of P.discard.filter(isBook)) { place(G, b, 'limbo'); P.limbo.splice(P.limbo.indexOf(b), 1); b.zone = 'under'; self.under.push(b); }
      log(G, `${self.def.name} ถูกวางใน Domain Zone พร้อมตำรา ${self.under.length} ใบใต้การ์ด`, p);
      if (!self.under.length) finishSun({ G, p, self });
    } } };
NOTES['SD06-019'] = 'การใช้ตำราใต้การ์ดแทน 1 Element ระบบใช้ให้อัตโนมัติทุกครั้งที่ร่าย Spell หรืออัญเชิญ Unit ที่มีค่าร่ายอย่างน้อย 1 (ไม่ถามก่อน) เมื่อตำราใต้การ์ดหมด การ์ดลงกองทิ้งและสร้างความเสียหาย 4 หน่วย ใช้ไม่ได้ถ้า Domain Zone เต็ม';
})(globalThis.AF = globalThis.AF || {});
