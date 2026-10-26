/* UI · หน้าสร้างเด็คแบบคลังการ์ด (ซ้าย) + กล่องเด็ค (ขวา)
   - แถบ Unit / Spell / Ultimate / ALL กรองคลังการ์ดทางซ้าย (ตัวเลขบนแถบ = จำนวนในเด็ค) ส่วนรายการการ์ดในเด็คทางขวาแสดงทั้งหมด
   - ซ้าย: คลังการ์ดทั้งหมดจาก card-api (รวมชุด BT) ค้นหา/กรอง/เรียงได้ คลิกการ์ดเพื่อใส่ลงเด็ค
   - ขวา: คลิกกล่องเด็คเพื่อเลือก Avatar · แท็บ Unit / Spell / Ultimate · Element Deck (อยู่ใต้แท็บ)
   ไฟล์นี้แทนที่หน้าต่าง "สร้างเด็คของฉัน" เดิมใน modals.js (modalHTML ถูกครอบไว้ด้านล่าง)
   ใช้ actions เดิมจาก events.js: edc (เพิ่ม/ลดการ์ด) ede (Element) edeauto edsave edcancel
   และ data-chg="edf" (ตัวกรอง) ส่วน action ใหม่ใช้ data-da และจัดการในไฟล์นี้
   โหลดหลัง events.js และก่อน main.js */
'use strict';
(function () {
  const TABS = [['Unit', 'Unit'], ['Spell', 'Spell'], ['Ultimate', 'Ultimate'], ['ALL', 'ALL']];   // ALL = ทุกประเภท
  const tabOf = k => k === 'Unit' ? 'Unit' : k === 'Ultimate' ? 'Ultimate' : 'Spell';
  const KORD = { Unit: 0, Enchant: 1, Counter: 2, Equipment: 3, Domain: 4, Ultimate: 5 };
  const KINDS = ['Unit', 'Enchant', 'Counter', 'Equipment', 'Domain', 'Ultimate'];
  const SORTS = [['id', 'เรียงตามรหัส'], ['cost', 'Cost ต่ำ → สูง'], ['costd', 'Cost สูง → ต่ำ'], ['name', 'เรียงตามชื่อ']];
  const cmpId = (x, y) => x.deck.localeCompare(y.deck) || x.no.localeCompare(y.no);
  const sorter = s => s === 'cost' ? (x, y) => x.cost - y.cost || cmpId(x, y)
    : s === 'costd' ? (x, y) => y.cost - x.cost || cmpId(x, y)
    : s === 'name' ? (x, y) => x.name.localeCompare(y.name, 'th') || cmpId(x, y) : cmpId;
  const kLabel = k => (typeof kindTh === 'function' ? kindTh(k) : k);
  const meta = d => `${esc(d.id)} · ${esc(d.kind)}${d.kind === 'Unit' ? ' · Cost ' + d.cost : d.noCost ? '' : ' · Spend ' + d.cost}`;
  const tags = d => (d.isNew ? '<small class="tg new">ใหม่</small>' : '') +
    (d.unscripted ? '<small class="tg warn" title="ยังไม่มีสคริปต์เอฟเฟกต์">⚠ ไม่มีสคริปต์</small>'
      : d.stale ? '<small class="tg warn" title="ข้อความต่างจากที่สคริปต์เขียนไว้">⚠ ข้อความเปลี่ยน</small>' : '');
  const opt = (v, cur, label) => `<option value="${esc(v)}" ${cur === v ? 'selected' : ''}>${esc(label == null ? v : label)}</option>`;
  const sel = (k, cur, items, all0) => `<select data-chg="edf" data-k="${k}" aria-label="${esc(all0)}"><option value="">${esc(all0)}</option>${items.map(o => Array.isArray(o) ? opt(o[0], cur, o[1]) : opt(o, cur)).join('')}</select>`;

  function dedHTML() {
    const e = ui.ed;
    e.tab = e.tab || 'ALL'; e.sort = e.sort || 'id';
    const all = Object.values(AF.defs);
    const pool = all.filter(d => d.kind !== 'Avatar');
    const decksF = [...new Set(all.map(d => d.deck))].sort();
    const els = [...new Set(all.flatMap(d => d.els || []))];
    const ELS = Object.keys(ELEMENTS);
    const av = AF.defs[e.avatar];

    /* จำนวนตามชื่อ (กฎ 4 ใบ) */
    const nameCount = {};
    for (const [id, n] of Object.entries(e.counts)) { const nm = AF.defs[id] ? AF.defs[id].name : id; nameCount[nm] = (nameCount[nm] || 0) + n; }

    /* ---------- คลังการ์ด (ซ้าย) ---------- */
    const q = (e.q || '').trim().toLowerCase();
    const lib = pool
      .filter(d => (e.tab === 'ALL' || tabOf(d.kind) === e.tab) && (!e.fd || d.deck === e.fd) && (!e.ft || d.kind === e.ft) && (!e.fe || (d.els || []).includes(e.fe)) && (!e.fin || (e.counts[d.id] || 0) > 0))
      .sort(sorter(e.sort));
    const tiles = lib.map(d => {
      const n = e.counts[d.id] || 0;
      const hay = (d.name + ' ' + d.id + ' ' + d.tribe).toLowerCase();
      const hid = q && !hay.includes(q);
      const bad = av && !AF.allowedInDeck(av, d);
      const full = (nameCount[d.name] || 0) >= 4 || bad;
      return `<div class="pt ${n ? 'in' : ''} ${full ? 'full' : ''} ${bad ? 'offel' : ''}" ${bad ? `title="ธาตุ${esc(d.els.join('/'))} ใส่ไม่ได้: Avatar เป็นธาตุ${esc(av.els.join('/') || 'ไม่ระบุ')}"` : ''} ${hid ? 'hidden' : ''} data-q="${esc(hay)}">
        <div class="card ${cardArt(d.id)}" data-pdef="${esc(d.id)}" data-act="edc" data-id="${esc(d.id)}" data-d="1" role="button" aria-label="เพิ่ม ${esc(d.name)}">${n ? `<span class="cpill">${n}</span>` : ''}</div>
        <small class="nm">${esc(d.name)}</small><small class="mt">${elIcons(d, 12)} ${meta(d)}</small>${bad ? '<small class="tg warn">ธาตุไม่ตรง Avatar</small>' : ''}${tags(d)}
        <div class="step"><button data-act="edc" data-id="${esc(d.id)}" data-d="-1" ${n ? '' : 'disabled'} aria-label="ลด">−</button><b>${n}</b><button data-act="edc" data-id="${esc(d.id)}" data-d="1" ${full ? 'disabled' : ''} aria-label="เพิ่ม">+</button></div></div>`;
    }).join('') || '<span class="muted">ไม่พบการ์ดตามตัวกรอง</span>';

    /* ---------- เด็ค (ขวา) ---------- */
    const tot = AF.deckSize({ counts: e.counts });
    const errs = edErrors(e);
    const ed = edEdeck(e);
    const edTot = Object.values(ed).reduce((a, b) => a + b, 0);
    const byTab = { Unit: 0, Spell: 0, Ultimate: 0, ALL: 0 };
    for (const [id, n] of Object.entries(e.counts)) { const d = AF.defs[id]; if (d) { byTab[tabOf(d.kind)] += n; byTab.ALL += n; } }
    const mine = Object.keys(e.counts).filter(id => e.counts[id] > 0 && AF.defs[id])
      .map(id => AF.defs[id])
      .sort((x, y) => (KORD[x.kind] - KORD[y.kind]) || x.cost - y.cost || cmpId(x, y));
    const mini = mine.map(d => {
      const n = e.counts[d.id];
      const full = (nameCount[d.name] || 0) >= 4;
      return `<div class="mt-tile" title="${esc(d.name)}"><div class="card ${cardArt(d.id)}" data-pdef="${esc(d.id)}"><span class="cpill">${n}</span></div>
        <small class="nm">${esc(d.name)}</small>
        <div class="step"><button data-act="edc" data-id="${esc(d.id)}" data-d="-1" aria-label="ลด">−</button><button data-act="edc" data-id="${esc(d.id)}" data-d="1" ${full ? 'disabled' : ''} aria-label="เพิ่ม">+</button></div></div>`;
    }).join('') || '<span class="muted">ยังไม่มีการ์ดในเด็ค คลิกการ์ดทางซ้ายเพื่อใส่ลงเด็ค</span>';

    const box = `<button class="dbx-box" data-da="avopen" title="คลิกเพื่อเลือก Avatar" aria-label="เลือก Avatar">
        ${av ? `<div class="card ${cardArt(av.id)}"></div>` : '<div class="dbx-empty">เลือก<br>Avatar</div>'}
        <span class="dbx-rib">เลือก Avatar</span></button>`;

    const tabs = TABS.map(([k, label]) => `<button class="dbx-tab ${e.tab === k ? 'on' : ''}" data-da="tab" data-v="${k}" role="tab" aria-selected="${e.tab === k}">${label}<b>${byTab[k]}</b></button>`).join('');

    const elHTML = ELS.map(k => `<div class="elc" title="${esc(k)}">${elIcon(k, 18)}<span>${esc(k)}</span><button data-act="ede" data-k="${esc(k)}" data-d="-1" aria-label="ลด ${esc(k)}">−</button><b>${ed[k] || 0}</b><button data-act="ede" data-k="${esc(k)}" data-d="1" aria-label="เพิ่ม ${esc(k)}">+</button></div>`).join('');

    /* ---------- หน้าต่างเลือก Avatar ---------- */
    let picker = '';
    if (e.pickAv) {
      const aq = (e.avq || '').trim().toLowerCase();
      const avs = all.filter(d => d.kind === 'Avatar' && (!e.afd || d.deck === e.afd)).sort(cmpId);
      const avTiles = avs.map(d => {
        const hay = (d.name + ' ' + d.id + ' ' + d.tribe).toLowerCase();
        return `<button class="dbx-av ${e.avatar === d.id ? 'on' : ''}" data-da="avpick" data-id="${esc(d.id)}" ${aq && !hay.includes(aq) ? 'hidden' : ''} data-q="${esc(hay)}">
          <div class="card ${cardArt(d.id)}" data-pdef="${esc(d.id)}"></div><b>${esc(d.name)}</b><small class="mt">${elIcons(d, 13)} ${esc(d.id)}</small>${tags(d)}</button>`;
      }).join('') || '<span class="muted">ไม่พบ Avatar</span>';
      picker = `<div class="dbx-pick" role="dialog" aria-label="เลือก Avatar"><div class="dbx-pick-h"><h2>เลือก Avatar</h2>
        <input id="avq" type="search" placeholder="ค้นหาชื่อ / รหัส" value="${esc(e.avq || '')}" aria-label="ค้นหา Avatar">
        ${sel('afd', e.afd, decksF, 'ทุกเด็ค')}
        <button class="btn" data-da="avclose">ปิด</button></div>
        <div class="dbx-pick-g" data-ks="avpick">${avTiles}</div></div>`;
    }

    return `<div class="ov"><div class="dlg wide dbx">
      <section class="edpool"><h2>${e.id ? 'แก้ไขเด็ค' : 'สร้างเด็คของฉัน'} <span class="muted dbx-n">คลังการ์ด ${lib.length}/${pool.length} ใบ</span></h2>
        <div class="fbar"><input id="edq" type="search" placeholder="ค้นหาชื่อ / รหัส / เผ่า" value="${esc(e.q)}" aria-label="ค้นหา">
          ${sel('fd', e.fd, decksF, 'ทุกเด็ค')}${sel('ft', e.ft, KINDS.map(k => [k, kLabel(k)]), 'ทุกประเภท')}${sel('fe', e.fe, els, 'ทุกธาตุ')}
          <select data-chg="edf" data-k="sort" aria-label="เรียงลำดับ">${SORTS.map(([v, l]) => opt(v, e.sort, l)).join('')}</select>
          <label class="chk"><input type="checkbox" data-chg="edf" data-k="fin" ${e.fin ? 'checked' : ''}> เฉพาะที่อยู่ในเด็ค</label></div>
        <div class="pgrid" data-ks="pool">${tiles}</div></section>
      <aside class="edside dbx-side">
        <div class="dbx-top">
          <label class="fl dbx-name">ชื่อเด็ค<input id="edname" type="text" maxlength="40" value="${esc(e.name)}"></label>
          <div class="dbx-head">${box}
            <div class="dbx-info"><b class="dbx-av-name">${av ? esc(av.name) : 'ยังไม่ได้เลือก Avatar'}</b>
              ${av ? `<span class="muted">${elIcons(av, 13)} ${esc(av.id)}</span>` : ''}
              <div class="dbx-total"><b>${tot}</b>/60 ${tot === 60 ? '<span class="good">ครบ</span>' : `<span class="bad">${tot < 60 ? 'ขาด ' + (60 - tot) : 'เกิน ' + (tot - 60)}</span>`}</div>
              <div class="dbx-bar"><i class="${tot === 60 ? 'ok' : tot > 60 ? 'over' : ''}" style="width:${Math.min(100, tot / 60 * 100)}%"></i></div>
              <span class="muted">Element Deck ${edTot}/8 ${edTot === 8 ? '<span class="good">✓</span>' : ''}</span></div></div>
          <div class="dbx-tabs" role="tablist">${tabs}</div>
          <div class="dbx-el"><div class="dbx-elh"><span>Element Deck <b>${edTot}</b>/8 ${edTot === 8 ? '<span class="good">✓</span>' : ''}</span><button class="btn sm" data-act="edeauto">ตามธาตุ Avatar (8 ใบ)</button></div><div class="dbx-elg">${elHTML}</div></div></div>
        <div class="dbx-mini" data-ks="side">${mini}</div>
        <div class="dbx-bot">
          ${errs.length ? `<div class="warnbox">${errs.map(esc).join('<br>')}</div>` : '<div class="good">✓ เด็คถูกต้อง</div>'}
          <div class="acts"><button class="btn" data-act="edcancel">ยกเลิก</button><button class="btn pri" data-act="edsave">บันทึกเด็ค</button></div></div>
      </aside>${picker}</div></div>`;
  }

  /* ครอบ modalHTML เดิม: เฉพาะหน้าต่างสร้างเด็คใช้ของใหม่ ที่เหลือใช้ของเดิมทั้งหมด */
  const baseModalHTML = modalHTML;
  modalHTML = function () {
    if (ui.modal && ui.modal.t === 'ded' && ui.ed) return dedHTML();
    return baseModalHTML.apply(this, arguments);
  };

  /* action ใหม่ของหน้านี้ (data-da) */
  root.addEventListener('click', ev => {
    const t = ev.target.closest('[data-da]');
    if (!t || !ui.ed) return;
    const e = ui.ed, k = t.dataset.da;
    hidePop();
    if (k === 'avopen') { e.pickAv = true; e.avq = ''; return render(); }
    if (k === 'avclose') { e.pickAv = false; return render(); }
    if (k === 'avpick') { e.avatar = t.dataset.id; if (e.edeckAuto) e.edeck = null; e.pickAv = false; return render(); }
    if (k === 'tab') { e.tab = t.dataset.v; return render(); }
  });
  root.addEventListener('input', ev => {
    if (ev.target.id !== 'avq' || !ui.ed) return;
    const q = ev.target.value.trim().toLowerCase();
    ui.ed.avq = ev.target.value;
    document.querySelectorAll('.dbx-av').forEach(b => { b.hidden = !!q && !b.dataset.q.includes(q); });
  });
})();
