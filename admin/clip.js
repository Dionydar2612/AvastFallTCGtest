/* แปลงข้อความที่ paste (จาก Excel/Google Sheets, JSON หรือข้อความการ์ดแบบ "ชื่อ: ค่า") -> ค่าของฟอร์มเพิ่มการ์ด
   ใช้ได้ทั้งในเบราว์เซอร์ (window.ClipCard) และ node (require) เพื่อทดสอบ
   ผลลัพธ์: { fields: {deck,no,variant,name,type,element,element2,...,effect1_keyword,effect1_text,...}, count, note } */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ClipCard = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const norm = (s) => String(s ?? "").toLowerCase().replace(/[\s_\-().\/:：]/g, "");
  const TYPES = ["Avatar", "Unit", "Spell", "Ultimate"];
  const TYPE_ALIAS = { "อวตาร": "Avatar", "ยูนิต": "Unit", "สเปล": "Spell", "อัลติเมท": "Ultimate", "อัลติเมต": "Ultimate" };
  // ลำดับคอลัมน์เดียวกับไฟล์ต้นแบบ Excel (ใช้ตอน paste แถวเดียวที่ไม่มีหัวคอลัมน์)
  const COLUMNS = ["deck", "no", "variant", "name", "type", "sub", "element", "rarity", "rotation", "artist", "cost", "cri", "atk", "def", "sc", "tribe",
    "effect1_keyword", "effect1_text", "effect2_keyword", "effect2_text", "effect3_keyword", "effect3_text", "effect4_keyword", "effect4_text", "effect5_keyword", "effect5_text", "flavor"];
  const ALIAS = {
    id: ["id", "รหัส", "รหัสการ์ด", "cardid", "code"],
    deck: ["deck", "เด็ค", "ซีรีส์", "ซีรีย์", "series", "set", "ชุด"],
    no: ["no", "number", "cardno", "เลข", "เลขการ์ด", "เลขที่", "หมายเลข"],
    variant: ["variant", "version", "suffix", "เวอร์ชัน", "เวอร์ชันพิเศษ"],
    name: ["name", "cardname", "ชื่อ", "ชื่อการ์ด"],
    type: ["type", "cardtype", "ประเภท", "ประเภทการ์ด"],
    sub: ["sub", "subtype", "ประเภทย่อย"],
    element: ["element", "elements", "ธาตุ", "ธาตุ1", "element1"],
    element2: ["element2", "ธาตุ2", "ธาตุที่2", "ธาตุรอง"],
    rarity: ["rarity", "rar", "ความหายาก", "ระดับ"],
    rotation: ["rotation", "rot", "โรเทชัน"],
    artist: ["artist", "art", "illustrator", "นักวาด"],
    cost: ["cost", "คอสต์"], cri: ["cri", "crit", "คริ"], atk: ["atk", "attack"], def: ["def", "defense", "defence"],
    sc: ["sc", "elementvalue", "ค่าelement", "ค่าธาตุ"],
    tribe: ["tribe", "race", "เผ่า"],
    flavor: ["flavor", "flavortext", "fl", "คำพูด", "ข้อความท้ายการ์ด"],
  };
  for (let i = 1; i <= 5; i++) {
    ALIAS[`effect${i}_keyword`] = [`effect${i}keyword`, `keyword${i}`, `kw${i}`, `คีย์เวิร์ด${i}`];
    ALIAS[`effect${i}_text`] = [`effect${i}text`, `effect${i}`, `เอฟเฟกต์${i}`, `เอฟเฟค${i}`, `ผล${i}`];
  }
  const LOOKUP = new Map();
  for (const [k, list] of Object.entries(ALIAS)) for (const a of list.concat(k)) LOOKUP.set(norm(a), k);
  // ป้ายที่ใช้ในข้อความอิสระ: effect/เอฟเฟกต์ (ไม่มีเลข) = เอฟเฟกต์ถัดไป
  const FX_LABEL = new Set(["effect", "เอฟเฟกต์", "เอฟเฟค", "ผล", "ความสามารถ", "text", "ข้อความ"].map(norm));
  const keyOf = (label) => LOOKUP.get(norm(label)) || null;

  function splitId(id) {
    const m = String(id).trim().match(/^([A-Za-z0-9_]+(?:-[A-Za-z0-9_]+)*?)-(\d{1,4})([A-Za-z0-9]*)$/);
    return m ? { deck: m[1], no: m[2].padStart(3, "0"), variant: m[3] } : null;
  }
  function normType(v) {
    const t = String(v).trim();
    return TYPES.find((x) => x.toLowerCase() === t.toLowerCase()) || TYPE_ALIAS[t] || "";
  }
  function setElements(out, v) {
    const list = String(v).split(/[\/,，、+&]|\s+(?=\S)/).map((x) => x.trim().replace(/^ธาตุ/, "")).filter(Boolean);
    const u = [...new Set(list)];
    if (u[0]) out.element = u[0];
    if (u[1]) out.element2 = u[1];
  }
  // ใส่ค่า 1 ช่องลงผลลัพธ์ (จัดรูปตามชนิดช่อง)
  function put(out, key, val) {
    val = String(val ?? "").trim();
    if (val === "" || val === "-" || val === "—" || val === "–") return;
    if (key === "id") { const p = splitId(val); if (p) Object.assign(out, p); return; }
    if (key === "type") { const t = normType(val); if (t) out.type = t; return; }
    if (key === "element") { setElements(out, val); return; }
    if (key === "element2") { out.element2 = val.replace(/^ธาตุ/, ""); return; }
    if (["cost", "cri", "atk", "def", "sc"].includes(key)) { const n = val.replace(/,/g, ""); if (/^-?\d+(\.\d+)?$/.test(n)) out[key] = n; return; }
    if (key === "no") { const n = val.replace(/\.0+$/, ""); if (/^\d{1,4}$/.test(n)) out.no = n.padStart(3, "0"); return; }
    out[key] = val;
  }
  function finish(out) {
    // ถ้าได้ deck แต่ไม่ได้ no/variant จาก id รวม ไม่ต้องทำอะไรเพิ่ม · จัด effects ให้เรียงต่อเนื่อง
    const fx = [];
    for (let i = 1; i <= 5; i++) if (out[`effect${i}_text`] || out[`effect${i}_keyword`]) fx.push([out[`effect${i}_keyword`] || "", out[`effect${i}_text`] || ""]);
    for (let i = 1; i <= 5; i++) { delete out[`effect${i}_keyword`]; delete out[`effect${i}_text`]; }
    fx.slice(0, 5).forEach(([k, t], i) => { if (k) out[`effect${i + 1}_keyword`] = k; out[`effect${i + 1}_text`] = t; });
    return out;
  }

  /* ---------- JSON ---------- */
  function fromObject(o) {
    const out = {};
    if (!o || typeof o !== "object") return out;
    for (const [k, v] of Object.entries(o)) {
      if (k === "effects" && Array.isArray(v)) {
        v.slice(0, 5).forEach((e, i) => { if (e && e.text) { put(out, `effect${i + 1}_keyword`, e.keyword); put(out, `effect${i + 1}_text`, e.text); } });
        continue;
      }
      if (k === "elements" && Array.isArray(v)) { if (v[0]) out.element = String(v[0]); if (v[1]) out.element2 = String(v[1]); continue; }
      if (v && typeof v === "object") continue;
      const key = keyOf(k); if (key) put(out, key, v);
    }
    if (o.id && !out.deck) put(out, "id", o.id);
    return out;
  }

  /* ---------- ตาราง (TSV จาก Excel / Google Sheets) ---------- */
  function parseTSV(text) {
    // รองรับช่องที่ครอบด้วย "..." และมีขึ้นบรรทัดใหม่ข้างใน (Excel ทำแบบนี้ตอนมี Alt+Enter)
    const rows = []; let row = [], cur = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"' && cur === "") q = true;
      else if (ch === "\t") { row.push(cur); cur = ""; }
      else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; }
      else cur += ch;
    }
    row.push(cur); rows.push(row);
    return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some(Boolean));
  }
  function fromTable(rows) {
    const known = (r) => r.filter((c) => LOOKUP.has(norm(c))).length;
    const hasHeader = rows.length > 1 && known(rows[0]) >= 2;
    const out = {}; let count;
    if (hasHeader) {
      const keys = rows[0].map((h) => keyOf(h));
      rows[1].forEach((v, i) => { if (keys[i]) put(out, keys[i], v); });
      count = rows.length - 1;
    } else {
      rows[0].forEach((v, i) => { if (COLUMNS[i]) put(out, COLUMNS[i], v); });
      count = rows.length;
    }
    // รหัสที่ถูกใส่มาในช่อง deck ทั้งก้อน (เช่น BT01-001SR)
    if (out.deck && /-\d/.test(out.deck)) { const p = splitId(out.deck); if (p) Object.assign(out, p); }
    return { out, count, how: hasHeader ? "ตาราง (มีหัวคอลัมน์)" : "ตาราง (เรียงตามไฟล์ต้นแบบ)" };
  }

  /* ---------- ข้อความอิสระ ("ชื่อ: …" ต่อบรรทัด) ---------- */
  function fromText(text, keywords) {
    const out = {}, fx = [];
    const kws = [...new Set((keywords || []).filter(Boolean))].sort((a, b) => b.length - a.length);
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const free = [];
    let stats = false;
    for (const raw of lines) {
      let line = raw;
      // บรรทัดสถานะรวม เช่น "COST 3 | ATK 5 | DEF 4 | CRI 1"
      const sm = [...line.matchAll(/\b(cost|atk|def|cri|sc)\s*[:：=]?\s*(-?\d+(?:\.\d+)?)/gi)];
      if (sm.length >= 2 && !/[ก-๙]{6,}/.test(line)) { sm.forEach((m) => put(out, m[1].toLowerCase(), m[2])); stats = true; continue; }
      // ป้าย: ค่า
      const lm = line.match(/^([^:：=]{1,30})\s*[:：=]\s*(.+)$/);
      if (lm) {
        const label = lm[1].replace(/^[\[\(【]|[\]\)】]$/g, "");
        const key = keyOf(label);
        if (key) { put(out, key, lm[2]); continue; }
        if (FX_LABEL.has(norm(label))) { fx.push(["", lm[2].trim()]); continue; }
        const kw = kws.find((k) => k.toLowerCase() === label.trim().toLowerCase());   // "AUTO: ข้อความ"
        if (kw) { fx.push([kw, lm[2].trim()]); continue; }
      }
      // คีย์เวิร์ดนำหน้า: "[AUTO] ..." หรือ "ACTIVATE 1/turn ..." หรือ "ACTIVATE 1/turn: ..."
      const stripped = line.replace(/^[\[【(]\s*/, "");
      const kw = kws.find((k) => stripped.toLowerCase().startsWith(k.toLowerCase()) && /^[\]】)\s:：\-–]|^$/.test(stripped.slice(k.length) || " "));
      if (kw) { fx.push([kw, stripped.slice(kw.length).replace(/^[\]】)\s:：\-–]+/, "").trim()]); continue; }
      if (/^[“"‘'「].+[”"’'」]$/.test(line) && !out.flavor) { out.flavor = line; continue; }
      // รหัสการ์ดเดี่ยว ๆ เช่น "BT01-001SR"
      if (/^[A-Za-z0-9_]+-\d{1,4}[A-Za-z0-9]*$/.test(line)) { put(out, "id", line); continue; }
      free.push(line);
    }
    // บรรทัดที่ไม่มีป้าย: บรรทัดแรก = ชื่อ (ถ้ายังไม่มี) ที่เหลือ = เอฟเฟกต์
    for (const l of free) { if (!out.name) out.name = l; else fx.push(["", l]); }
    fx.slice(0, 5).forEach(([k, t], i) => { if (k) out[`effect${i + 1}_keyword`] = k; out[`effect${i + 1}_text`] = t; });
    return { out, extraFx: Math.max(0, fx.length - 5), stats };
  }

  function parse(text, keywords) {
    text = String(text ?? "").replace(/^\uFEFF/, "").trim();
    if (!text) return { fields: {}, count: 0, note: "คลิปบอร์ดว่างเปล่า" };
    // JSON
    if (/^[\[{]/.test(text)) {
      try {
        const j = JSON.parse(text), arr = Array.isArray(j) ? j : [j];
        const f = finish(fromObject(arr[0]));
        return { fields: f, count: arr.length, note: "JSON" + (arr.length > 1 ? ` — พบ ${arr.length} ใบ ใส่เฉพาะใบแรก (หลายใบให้ใช้แท็บ “นำเข้า Excel”)` : "") };
      } catch (e) { /* ไม่ใช่ JSON ที่ถูกต้อง -> ลองแบบอื่น */ }
    }
    // ตาราง (มี Tab)
    if (text.includes("\t")) {
      const t = fromTable(parseTSV(text));
      return { fields: finish(t.out), count: t.count, note: t.how + (t.count > 1 ? ` — พบ ${t.count} แถว ใส่เฉพาะแถวแรก (หลายใบให้ใช้แท็บ “นำเข้า Excel”)` : "") };
    }
    const t = fromText(text, keywords);
    return { fields: finish(t.out), count: 1, note: "ข้อความการ์ด" + (t.extraFx ? ` — เอฟเฟกต์เกิน 5 ข้อ ตัดทิ้ง ${t.extraFx} ข้อ` : "") };
  }

  return { parse, splitId, COLUMNS };
});
