// ผู้ใช้ออนไลน์: หน้าเว็บส่ง heartbeat ทุก 25 วินาที (POST /api/presence/ping) · เซิร์ฟเวอร์ถือว่า "ออนไลน์" ถ้าเงียบไม่เกิน 70 วินาที
// เก็บในหน่วยความจำเท่านั้น (รีสตาร์ตแล้วเริ่มนับใหม่) · ไม่เก็บ IP จริง เก็บเฉพาะแฮชแบบสั้น
const log = require("./logger");

const TTL = 70e3, MAX = 5000;
const sessions = new Map(); // sid -> { first, last, page, ua, ip, pings }
let peak = { n: 0, at: 0 };

const clip = (v, n) => String(v ?? "").replace(/[\r\n]/g, " ").trim().slice(0, n);
const device = (ua) => (/mobile|android|iphone|ipad/i.test(ua) ? "มือถือ/แท็บเล็ต" : "คอมพิวเตอร์");

function ping(req) {
  const b = req.body || {};
  const sid = clip(b.sid, 40);
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(sid)) return false;
  const now = Date.now();
  let s = sessions.get(sid);
  if (!s) {
    if (sessions.size >= MAX) return false;
    s = { first: now, pings: 0 };
    sessions.set(sid, s);
    log.debug("presence_join", { type: "presence", sid: sid.slice(0, 6), ip: log.hashIp(log.ipOf(req)) });
  }
  s.last = now; s.pings++;
  s.page = clip(b.page, 60) || "/";
  s.ua = clip(req.headers["user-agent"], 160);
  s.ip = log.hashIp(log.ipOf(req));
  return true;
}
function bye(req) { // sendBeacon ตอนปิดแท็บ
  const sid = clip(req.body?.sid, 40);
  if (sessions.delete(sid)) log.debug("presence_leave", { type: "presence", sid: sid.slice(0, 6) });
}

function sweep() {
  const now = Date.now();
  for (const [k, s] of sessions) if (now - s.last > 10 * 60e3) sessions.delete(k);
}
setInterval(sweep, 60e3).unref();

function snapshot(extra = {}) {
  const now = Date.now(), list = [];
  for (const [sid, s] of sessions) if (now - s.last <= TTL) list.push({ id: sid.slice(0, 6), page: s.page, device: device(s.ua), ip: s.ip, since: s.first, lastSeen: s.last, secs: Math.round((now - s.first) / 1000) });
  list.sort((a, b) => a.since - b.since);
  const uniq = new Set(list.map((x) => x.ip)).size;
  if (list.length > peak.n) peak = { n: list.length, at: now };
  return { online: list.length, uniqueVisitors: uniq, peak, list, ...extra };
}
module.exports = { ping, bye, snapshot, count: () => snapshot().online };
