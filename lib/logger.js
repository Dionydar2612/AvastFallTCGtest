// Logger แบบไม่พึ่งไลบรารี: เขียน JSON Lines ลงไฟล์รายวัน + stdout + เก็บ 500 รายการล่าสุดในหน่วยความจำให้หน้า /admin อ่าน
//   ไฟล์:  <DATA_DIR>/logs/app-YYYY-MM-DD.log  (เก็บ LOG_KEEP_DAYS วัน ค่าเริ่มต้น 14)
//   ตั้งระดับด้วย LOG_LEVEL=debug|info|warn|error (ค่าเริ่มต้น info)
//   ใช้งาน: log.info("msg", { ...fields })  ·  log.audit("action", req, { ...fields })  ·  app.use(log.requests)
const fs = require("fs"), path = require("path"), crypto = require("crypto");

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN = LEVELS[String(process.env.LOG_LEVEL || "info").toLowerCase()] || 20;
const KEEP_DAYS = Math.max(1, parseInt(process.env.LOG_KEEP_DAYS) || 14);
const RING_MAX = 500;
const dir = path.join(process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, ".."), "logs");
const ring = [];
let stream = null, streamDay = "", lastPrune = 0;

const ymd = (d = new Date()) => d.toISOString().slice(0, 10);
function open() {
  const day = ymd();
  if (stream && day === streamDay) return stream;
  try { stream?.end(); fs.mkdirSync(dir, { recursive: true }); stream = fs.createWriteStream(path.join(dir, `app-${day}.log`), { flags: "a" }); streamDay = day; stream.on("error", () => { stream = null; }); }
  catch { stream = null; }
  if (Date.now() - lastPrune > 6 * 3600e3) prune();
  return stream;
}
function prune() {
  lastPrune = Date.now();
  try {
    const cut = Date.now() - KEEP_DAYS * 86400e3;
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      if (/^app-\d{4}-\d{2}-\d{2}\.log$/.test(f) && fs.statSync(p).mtimeMs < cut) fs.unlinkSync(p);
    }
  } catch { /* ไม่เป็นไร */ }
}

// IP เก็บแบบแฮช (กันข้อมูลส่วนบุคคลรั่วใน log แต่ยังนับ/ตามรอยได้)
const SALT = process.env.ADMIN_SECRET || "avastfall";
const hashIp = (ip) => crypto.createHash("sha256").update(SALT + String(ip || "")).digest("hex").slice(0, 10);
const ipOf = (req) => String(req.headers?.["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim();

function write(level, msg, fields) {
  if (LEVELS[level] < MIN) return;
  const rec = { t: new Date().toISOString(), level, msg, ...fields };
  const line = JSON.stringify(rec);
  ring.push(rec); if (ring.length > RING_MAX) ring.shift();
  open()?.write(line + "\n");
  (level === "error" ? console.error : level === "warn" ? console.warn : console.log)(line);
}
const log = {
  debug: (m, f) => write("debug", m, f), info: (m, f) => write("info", m, f),
  warn: (m, f) => write("warn", m, f), error: (m, f) => write("error", m, f),
  // บันทึกการกระทำของแอดมิน (ใคร/ทำอะไร/จาก IP ไหน)
  audit(action, req, f) { write("info", "audit", { type: "audit", action, ip: hashIp(ipOf(req)), ...f }); },
  hashIp, ipOf, dir,
  recent({ level, type, limit = 200 } = {}) {
    const min = LEVELS[level] || 0;
    return ring.filter((r) => LEVELS[r.level] >= min && (!type || r.type === type)).slice(-limit).reverse();
  },
  files() { try { return fs.readdirSync(dir).filter((f) => /^app-\d{4}-\d{2}-\d{2}\.log$/.test(f)).sort().reverse(); } catch { return []; } },
  filePath(name) { return /^app-\d{4}-\d{2}-\d{2}\.log$/.test(name) ? path.join(dir, name) : null; },
  // middleware: log ทุก request ที่ช้า (>1 วิ) หรือ error (>=400) · ที่เหลือระดับ debug · ข้ามไฟล์ static/ping
  requests(req, res, next) {
    const t0 = process.hrtime.bigint();
    res.on("finish", () => {
      if (/^\/(api\/presence|images|assets)\b|\.(js|css|png|jpe?g|webp|ico|woff2?)$/i.test(req.path)) return;
      const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 || ms > 1000 ? "warn" : "debug";
      write(level, "http", { type: "http", method: req.method, path: req.originalUrl.split("?")[0], status: res.statusCode, ms: Math.round(ms), ip: hashIp(ipOf(req)) });
    });
    next();
  },
};
process.on("uncaughtException", (e) => { write("error", "uncaughtException", { err: e.stack || String(e) }); });
process.on("unhandledRejection", (e) => { write("error", "unhandledRejection", { err: e?.stack || String(e) }); });
module.exports = log;
