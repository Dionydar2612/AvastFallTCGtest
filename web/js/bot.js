/* AvastFall TCG – simple heuristic bot (implements the same io interface the UI does) */
(function (AF) {
'use strict';
const opp = AF.opp;
const fxOf = c => (AF.FX[c.def.id] || {});

function cardValue(G, c) {
  const d = c.def;
  switch (d.kind) {
    case 'Unit': return 3 + d.cost * 1.5 + d.atk * 0.3 + d.def * 0.3;
    case 'Equipment': return 6;
    case 'Domain': return 5;
    case 'Ultimate': return 6;
    case 'Counter': return 5;
    default: return 4;
  }
}
const unitValue = (G, u) => u.def.cost * 2 + AF.stat(G, u, 'atk') + AF.stat(G, u, 'def') * 0.7 + AF.stat(G, u, 'cri') * 1.2 + (u.equips.length * 2);

function scoreAction(G, p, a, ctx) {
  const P = G.players[p], O = G.players[opp(p)];
  const oppUnits = O.field.filter(Boolean);
  const stand = AF.standElems(P).length;
  const id = a.card.def.id;
  const afterCost = c => stand - c;
  let s = 0;
  if (a.t === 'summon') {
    const u = a.card; s = 9 + u.def.cost * 1.5;
    const adv = fxOf(u).advent;
    if (adv && /ทำลาย/.test(u.def.fx.map(f => f[1]).join(' '))) s += oppUnits.length ? 4 : -3;
    if (u.def.id === 'SD01-010' && !P.hand.some(c => c.def.name.includes('มโยลเนียร์'))) s -= 1;
    if (ctx.myUnits >= 3) s -= 2;
    return s;
  }
  if (a.t === 'spell') {
    const cost = AF.spellCost(G, p, a.card);
    s = 5;
    if (['SD01-013'].includes(id)) s = oppUnits.some(u => AF.stat(G, u, 'def') <= 1) ? 8 : -5;
    if (['SD01-014'].includes(id)) s = 6;
    if (['SD01-015'].includes(id)) s = P.hand.some(c => c.def.kind === 'Equipment') ? 1 : 5;
    if (id === 'SD02-016') s = 3;
    if (id === 'SD02-010' || id === 'SD02-011') s = 5;
    if (id === 'SD03-012') s = oppUnits.length ? 6 : 2;
    if (id === 'SD03-013') s = ctx.myUnits ? 4 : 0;
    if (id === 'SD03-015') s = 7;
    if (id === 'SD03-014') s = 4;
    if (id === 'SD03-010' || id === 'SD03-011') s = 6;
    if (id === 'SD04-010') s = oppUnits.length ? 6 : 0;
    if (id === 'SD04-011') s = oppUnits.length && ctx.myUnits ? 4 : 0;
    if (id === 'SD04-012') s = 1;
    if (id === 'SD05-012') s = ctx.myUnits ? 5 : 0;
    if (id === 'SD05-013') s = P.field.some(u => u && AF.hasName(G, u, 'ฮัสซัน')) ? 7 : -5;
    if (id === 'SD05-014') s = O.avatar.hp <= 2 ? 10 : (P.avatar.hp <= 4 ? -3 : 2);
    if (ctx.reserve && afterCost(cost) < ctx.reserve) s -= 4;
    return s;
  }
  if (a.t === 'equip') {
    const cost = AF.spellCost(G, p, a.card); s = 8;
    if (id === 'SD05-017' && P.avatar.hp <= 3) s = -3;
    if (ctx.reserve && afterCost(cost) < ctx.reserve) s -= 3;
    return s;
  }
  if (a.t === 'domain') { const cost = AF.spellCost(G, p, a.card); s = 6; if (id === 'SD04-018') s = ctx.myUnits <= 1 && oppUnits.length >= 3 ? 8 : -3; if (ctx.reserve && afterCost(cost) < ctx.reserve) s -= 3; return s; }
  if (a.t === 'ultimate') {
    if (id === 'SD01-019') { const mine = P.field.filter(Boolean).length; const theirs = oppUnits.length; return theirs - mine >= 2 ? 9 : -9; }
    if (id === 'SD02-019') return P.deck.length >= 3 ? 3 : -3;
    if (id === 'SD03-019') return 7;
    if (id === 'SD04-019') return 9;
    if (id === 'SD05-019') return oppUnits.length ? 9 : -9;
    return 1;
  }
  if (a.t === 'ability') {
    const ab = a.ab;
    if (ab.prophecy) return 6;
    if (id === 'SD01-001') return oppUnits.some(u => AF.stat(G, u, 'def') <= 3) ? (ctx.reserve ? 5 : 8) : 0;
    if (id === 'SD01-016') return 8;
    if (id === 'SD02-001') return 7;
    if (id === 'SD02-005' && ab.id === 'lib') return P.hand.length ? 3 : 0;
    if (id === 'SD02-017') return 4;
    if (id === 'SD03-001') return ab.id === 'seek' ? 7 : (P.hand.length >= 3 ? 3 : -1);
    if (id === 'SD03-004') return 8;
    if (id === 'SD03-005') return 6;
    if (id === 'SD03-009') return ab.zone === 'hand' ? (P.field.some(u => u && u.def.id === 'SD03-009') ? -9 : 2) : (P.hand.length ? 3 : 0);
    if (id === 'SD03-018') return 8;
    if (id === 'SD04-001') return ab.id === 'haste' ? 3 : 7;
    if (id === 'SD06-001') return oppUnits.length ? 8 : 0;
    if (id === 'SD05-001') return oppUnits.some(u => u.state === 'rest') ? 7 : 0;
    if (id === 'SD05-004') return 8;
    if (id === 'SD05-005') return 5;
    if (id === 'SD05-006') return 4;
    if (id === 'SD05-015') return P.avatar.hp > 5 ? 4 : -2;
    if (id === 'SD05-016') return 5;
    if (id === 'SD05-018') return 2;
    return 4;
  }
  return 0;
}

AF.makeBot = function (o = {}) {
  const getDelay = () => (typeof o.delay === 'function' ? o.delay() : (o.delay || 0));
  const wait = () => { const d = getDelay(); return d ? new Promise(r => setTimeout(r, d)) : null; };
  const io = {
    isBot: true,
    async act(G, p, spec) {
      await wait();
      const P = G.players[p];
      const counters = P.hand.filter(c => fxOf(c).counter && c.def.kind === 'Counter');
      const reserve = counters.length ? Math.min(...counters.map(c => AF.spellCost(G, p, c, true))) : 0;
      const ctx = { reserve, myUnits: P.field.filter(Boolean).length };
      let best = null, bs = 1.5;
      for (const a of spec.actions) {
        if (a.t === 'pass') continue;
        const s = scoreAction(G, p, a, ctx) + G.rng() * 0.5;
        if (s > bs) { bs = s; best = a; }
      }
      return best || { t: 'pass' };
    },
    async attack(G, p, spec) {
      await wait();
      const P = G.players[p], O = G.players[opp(p)];
      const hpOpp = O.avatar.hp;
      const myStand = P.field.filter(u => u && u.state === 'stand');
      const oppPotential = O.field.filter(Boolean).reduce((s, u) => s + AF.stat(G, u, 'cri'), 0);
      let best = null, bs = 0;
      for (const o2 of spec.options) {
        const a = o2.attacker; const atk = AF.stat(G, a, 'atk'); const cri = AF.stat(G, a, 'cri');
        const exposesMe = myStand.length <= 1 && oppPotential >= P.avatar.hp - 2;
        if (o2.avatar) {
          let s = cri * 3 + (cri >= hpOpp ? 100 : 0);
          if (cri === 0) s = 0.1;
          if (exposesMe && cri < hpOpp) s -= 4;
          if (s > bs) { bs = s; best = { attacker: a.uid, target: 'avatar' }; }
        }
        for (const t of o2.units) {
          const def = AF.stat(G, t, 'def');
          const ok = atk >= def || (a.def.id === 'SD01-002');
          if (!ok) continue;
          let s = unitValue(G, t) + 2;
          if (exposesMe && !o2.avatar) s -= 6;
          if (s > bs) { bs = s; best = { attacker: a.uid, target: t.uid }; }
        }
      }
      return best;
    },
    async pick(G, p, spec) {
      await wait();
      const P = G.players[p];
      const opts = spec.options.filter(x => !x.disabled);
      const take = n => opts.slice(0, n).map(x => x.id);
      const title = spec.title || '';
      if (spec.kind === 'payel') {   // บอท: จ่ายจากสีที่มีเหลือมากสุดก่อน (รักษาความหลากหลายของสี)
        const left = {}; spec.options.forEach(o => { left[o.id] = o.count; }); const out = [];
        for (let i = 0; i < spec.n; i++) { const k = Object.keys(left).sort((a, b) => left[b] - left[a])[0]; left[k]--; out.push(k); }
        return out;
      }
      if (spec.kind === 'choice') {
        if (/ย้ายไปใต้/.test(title) || (spec.options[0] && /ย้ายไปใต้/.test(spec.options[0].label || ''))) { const t = P.deck[0]; return [t && cardValue(G, t) < 5 ? 'y' : 'n']; }
        if (/เปลี่ยนเป้าหมาย/.test(title)) return [AF.standElems(P).length >= 2 ? 'y' : 'n'];
        if (/ฝ่ายตรงข้ามต้องเลือก/.test(title)) return [P.hand.length >= 4 ? 1 : 0];
        if (/ทิ้งการ์ดบนมือ 1 ใบเพื่อทำลาย/.test(title)) return ['y'];
        if (spec.options.every(x => typeof x.id === 'number')) return [spec.options[0].id];
        return ['y'];
      }
      if (spec.kind === 'names') {
        const cnt = {}; P.deck.forEach(c => cnt[c.def.name] = (cnt[c.def.name] || 0) + 1);
        const best = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
        return [best ? best[0] : opts[0].id];
      }
      if (spec.kind === 'attackTarget') {
        const av = opts.find(x => x.id === 'avatar'); const units = opts.filter(x => x.id !== 'avatar');
        if (av) return ['avatar'];
        units.sort((a, b) => unitValue(G, b.card) - unitValue(G, a.card)); return [units[0].id];
      }
      if (spec.kind === 'units') {
        const mine = opts[0] && opts[0].card.owner === p;
        const sorted = [...opts].sort((a, b) => unitValue(G, b.card) - unitValue(G, a.card));
        if (mine && /วางไว้บนสุดของ Main Deck เรา/.test(title)) return [sorted[sorted.length - 1].id];
        return [sorted[0].id];
      }
      // cards / reveal
      const discarding = /ทิ้ง/.test(title) && !/ค้นหา|ขึ้นมือ/.test(title) && !/นำลงสนาม|ส่งลงกองทิ้ง 1 ใบ/.test(title);
      const sorted = [...opts].sort((a, b) => cardValue(G, discarding ? a.card : b.card) - cardValue(G, discarding ? b.card : a.card));
      const n = spec.max || 1;
      if (!sorted.length) return [];
      if (spec.optional && !sorted.length) return [];
      return sorted.slice(0, n).map(x => x.id);
    },
    async order(G, p, spec) { return spec.cards.map(c => c.uid); },
    async respond(G, p, spec) {
      await wait();
      const item = spec.item, P = G.players[p];
      const cards = spec.options.map(uid => P.hand.find(c => c.uid === uid)).filter(Boolean);
      const spare = AF.standElems(P).length;
      for (const c of cards) {
        const id = c.def.id; const cost = AF.spellCost(G, p, c, true);
        if (id === 'SD02-012') { if (item.source.def.cost >= 2 || /ทำลาย/.test(item.source.def.fx.map(f => f[1]).join(' '))) return c.uid; }
        if (id === 'SD02-013' || id === 'SD02-014') {
          const a = item.attacker, t = item.target; if (t === 'avatar') continue;
          const atk = AF.stat(G, a, 'atk'), def = AF.stat(G, t, 'def');
          if (atk >= def && (id === 'SD02-013' ? atk < def + 3 : atk - 3 < def)) return c.uid;
        }
        if (id === 'SD02-015') { if (/ADVENT|ACTIVATE|PROPHECY/.test(item.label || '')) return c.uid; }
        if (id === 'SD03-016') {
          const t = item.target, a = item.attacker;
          if (t === 'avatar') { if (AF.stat(G, a, 'cri') >= 1) return c.uid; }
          else if (AF.stat(G, a, 'atk') >= AF.stat(G, t, 'def')) return c.uid;
        }
        if (id === 'SD04-013') { if (item.kind === 'attack' && P.avatar.hp > 8) return c.uid; }
        if (id === 'SD04-014') { const a = item.attacker, t = item.target; if (AF.stat(G, a, 'atk') >= AF.stat(G, t, 'def')) return c.uid; }
        if (id === 'SD04-015') { const a = item.attacker, t = item.target; if (item.kind === 'attack' && t !== 'avatar' && AF.stat(G, a, 'atk') >= AF.stat(G, t, 'def') && P.deck.length > 8) return c.uid; }
      }
      return null;
    },
    async mulligan(G, p, spec) {
      const cheap = spec.hand.filter(c => (c.def.kind === 'Unit' && c.def.cost <= 2) || (c.def.cost <= 1 && c.def.kind !== 'Unit')).length;
      return cheap < 2;
    }
  };
  return io;
};
})(globalThis.AF = globalThis.AF || {});
