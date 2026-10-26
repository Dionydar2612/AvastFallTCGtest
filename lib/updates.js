// Update Note: โน้ตแจ้งอัปเดตที่แอดมินเขียนใน /admin แล้วแสดงให้ผู้เล่นทุกคน
// เก็บเป็นไฟล์ updates.json ในโฟลเดอร์ data ของ DATA_DIR (ดิสก์ถาวรของ Render) จึงไม่หายตอน deploy ใหม่
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const store = require("./store");

const file = () => path.join(store.dataDir, "updates.json");
const MAX_NOTES = 200, MAX_ITEMS = 30;

// ครั้งแรกที่ยังไม่มีไฟล์ จะใส่ Update Note เดิมที่เคยเขียนไว้ในโค้ดให้ (แอดมินลบทิ้งได้ในหน้า /admin)
const SEED = [
  { date: "2026-10-23", title: "รวมการสร้างเด็คไว้ที่ Deckbuilder", items: ["การสร้าง/แก้ไข/ลบ/นำเข้าเด็คทั้งหมดอยู่ที่แท็บ Deckbuilder ที่เดียว เด็คที่บันทึกแล้วจะมาให้เลือกในหน้าเล่นทันที (เด็คที่เคยสร้างไว้ในเกมรุ่นเก่าย้ายมาให้อัตโนมัติ)", "หน้าเลือกเด็คแสดงเฉพาะเด็คปัจจุบัน กด \"เปลี่ยนเด็ค\" เพื่อเลือกเด็คอื่น", "ย้าย \"วิธีเล่น\" และ \"Update Note\" (ไอคอนกระดิ่ง) ขึ้นไปที่แถบเมนูด้านบน และนำชิปสถานะการ์ดกับปุ่มกติกาโดยย่อออกจากหน้าเล่น", "อัปเดตการ์ดชุด BT01 JUGGERNAUT ETERNAL (รูปและข้อความตามไฟล์ล่าสุด) และเปลี่ยนการ์ดตัวอย่างในหน้า \"วิธีเล่น\" เป็นการ์ดชุด BT01"] },
  { date: "2026-10-23", title: "รวมเว็บ + ปรับข้อความการ์ด", items: ["เว็บเกมและ Card List รวมอยู่ที่โดเมนเดียวกัน สลับระหว่าง Playtest กับ Card List ได้ด้วยแท็บเลื่อนด้านบน (เกมที่เล่นค้างไว้ไม่หายเวลาสลับแท็บ) เกมดึงข้อมูลการ์ดและรูปจากเซิร์ฟเวอร์เดียวกัน", "BT01-001 ผู้คุมไฟนรก ซาลอุน: ปรับข้อความเอฟเฟกต์ AUTO ให้ชัดเจนว่า Unit ที่เพิ่งลงสนามได้รับผลนี้เช่นกัน การทำงานในเกมเหมือนเดิม"] },
  { date: "2026-10-20", title: "ปรับห้องออนไลน์", items: ["ตั้งชื่อที่แสดงตอนเล่นได้ในหน้าห้อง (ไม่ใส่จะเป็น ผู้เล่น 1/2) ระบบจำชื่อไว้ในเบราว์เซอร์", "ถ้าฝ่ายใดกดยอมแพ้หรือออกจากเกมในโหมดออนไลน์ ทั้งสองฝ่ายจะกลับมาหน้าแรกทันที"] },
  { date: "2026-10-20", title: "เล่นออนไลน์กับเพื่อน", items: ["เพิ่มโหมด \"เล่นออนไลน์กับเพื่อน\": กด \"สร้างห้อง\" แล้วส่งรหัสห้อง 5 ตัว (หรือลิงก์) ให้เพื่อน เพื่อนกรอกรหัสเข้าห้อง ต่างคนต่างเลือกเด็คของตัวเอง กด \"พร้อม\" ทั้งคู่แล้วเกมเริ่ม ใครเล่นก่อนสุ่มให้", "ห้องเป็นแบบส่วนตัว ใช้เล่นกันสองคนเท่านั้น ถ้าเน็ตสะดุดระบบจะต่อใหม่ให้เอง แต่ถ้ารีเฟรชหน้าระหว่างเกม เกมนั้นจะเล่นต่อไม่ได้", "ทั้งสองคนควรเปิดหน้าเว็บในเวอร์ชันเดียวกัน ถ้าข้อมูลการ์ดไม่ตรงกัน ระบบจะแจ้งและไม่เริ่มเกม ให้รีเฟรชแล้วเข้าห้องใหม่"] },
  { date: "2026-10-20", title: "ปรับหน้าตา", items: ["เปลี่ยนปุ่ม \"ข้อสังเกต\" เป็น \"Update Note\""] },
];

let notes = [];
const sortNotes = () => notes.sort((a, b) => (b.date + b.at).localeCompare(a.date + a.at));
function persist() {
  const p = file(), t = p + ".tmp";
  fs.writeFileSync(t, JSON.stringify(notes, null, 1) + "\n"); fs.renameSync(t, p);
}
function init() {
  try { notes = JSON.parse(fs.readFileSync(file(), "utf8")); if (!Array.isArray(notes)) notes = []; }
  catch (e) {
    if (e.code === "ENOENT") { // ยังไม่เคยมีไฟล์ → ใส่ของเดิมให้ครั้งเดียว
      const base = Date.now() - SEED.length * 1000;
      notes = SEED.map((n, i) => ({ id: crypto.randomBytes(6).toString("hex"), at: new Date(base + (SEED.length - i) * 1000).toISOString(), ...n }));
      try { persist(); } catch (_) { /* เขียนไม่ได้ก็ใช้ในหน่วยความจำไปก่อน */ }
    } else { console.error("อ่าน updates.json ไม่ได้:", e.message); notes = []; }
  }
  sortNotes();
}

function clean(b) {
  const title = String(b?.title ?? "").trim().slice(0, 120);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(b?.date ?? "")) ? String(b.date) : new Date().toISOString().slice(0, 10);
  const raw = Array.isArray(b?.items) ? b.items : String(b?.items ?? "").split(/\r?\n/);
  const items = raw.map((s) => String(s).trim().slice(0, 600)).filter(Boolean).slice(0, MAX_ITEMS);
  if (!title) throw new Error("กรุณาใส่หัวข้อ");
  if (!items.length) throw new Error("กรุณาใส่รายละเอียดอย่างน้อย 1 บรรทัด");
  return { title, date, items };
}
const list = () => notes;
function add(b) {
  const n = { id: crypto.randomBytes(6).toString("hex"), at: new Date().toISOString(), ...clean(b) };
  notes.push(n); sortNotes(); notes = notes.slice(0, MAX_NOTES); persist(); return n;
}
function update(id, b) {
  const i = notes.findIndex((n) => n.id === id); if (i < 0) return null;
  notes[i] = { ...notes[i], ...clean(b) }; sortNotes(); persist(); return notes.find((n) => n.id === id);
}
function remove(id) {
  const before = notes.length; notes = notes.filter((n) => n.id !== id);
  if (notes.length === before) return false; persist(); return true;
}
module.exports = { init, list, add, update, remove };
