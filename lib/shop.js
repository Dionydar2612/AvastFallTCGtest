// ร้านค้า: สินค้าถูกสร้างให้อัตโนมัติจากเด็ค/ซีรีส์ (BT… = ซองการ์ด, SD… = Starter Deck) เมื่อมีชุดใหม่
// แอดมินแก้ราคา/เปิด-ปิดขายได้ที่ /admin → เก็บใน shop.json (เฉพาะสิ่งที่แก้ ค่าเริ่มต้นคำนวณสด) มีผลทันที
const fs = require("fs"), path = require("path");
const store = require("./store");

const DEFAULT_PRICE = { pack: 100, starter: 500, other: 100 };
const file = () => path.join(store.dataDir, "shop.json");
let overrides = {}; // sku -> { price, onSale }

function init() {
  try { overrides = JSON.parse(fs.readFileSync(file(), "utf8")) || {}; } catch { overrides = {}; }
}
function persist() { const p = file(), t = p + ".tmp"; fs.writeFileSync(t, JSON.stringify(overrides, null, 1) + "\n"); fs.renameSync(t, p); }

const kindOf = (id) => (/^BT/i.test(id) ? "pack" : /^SD/i.test(id) ? "starter" : "other");
const KIND_LABEL = { pack: "ซองการ์ด", starter: "Starter Deck", other: "อื่น ๆ" };
const skuOf = (d) => `${kindOf(d.id) === "starter" ? "starter" : "pack"}-${d.id}`;
const titleOf = (d) => (kindOf(d.id) === "starter" ? `Starter Deck ${d.id} · ${d.name}` : `ซองการ์ด ${d.id} · ${d.name}`);

function list() {
  const order = { pack: 0, starter: 1, other: 2 };
  return store.state.decks.map((d) => {
    const kind = kindOf(d.id), sku = skuOf(d), o = overrides[sku] || {};
    return { sku, deck: d.id, kind, kindLabel: KIND_LABEL[kind], title: titleOf(d), price: Number.isFinite(o.price) ? o.price : DEFAULT_PRICE[kind], onSale: o.onSale !== undefined ? !!o.onSale : true };
  }).sort((a, b) => order[a.kind] - order[b.kind] || a.deck.localeCompare(b.deck));
}
function update(sku, b) {
  const item = list().find((x) => x.sku === sku);
  if (!item) throw new Error("ไม่พบสินค้านี้");
  const price = b?.price === "" || b?.price == null ? NaN : Number(b.price);
  if (!Number.isInteger(price) || price < 0 || price > 1_000_000) throw new Error("ราคาต้องเป็นจำนวนเต็ม 0 – 1,000,000");
  overrides[sku] = { price, onSale: !!b?.onSale };
  persist();
  return { before: item, after: { ...item, price, onSale: !!b?.onSale } };
}
module.exports = { init, list, update };
