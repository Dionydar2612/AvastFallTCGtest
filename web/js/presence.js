/* บอกเซิร์ฟเวอร์ว่า "ยังออนไลน์อยู่" (heartbeat ทุก 25 วินาที ขณะแท็บเปิดอยู่) → ดูได้ที่ /admin แท็บ "ออนไลน์"
   ไม่ส่งข้อมูลส่วนตัว: มีแค่รหัสสุ่มของแท็บ + path ของหน้า */
(function () {
  'use strict';
  var sid; try { sid = sessionStorage.getItem('af-sid'); } catch (e) { }
  if (!sid) {
    var a = new Uint8Array(9); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach(function (_, i) { a[i] = Math.random() * 256; });
    sid = Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    try { sessionStorage.setItem('af-sid', sid); } catch (e) { }
  }
  function body() { return JSON.stringify({ sid: sid, page: location.pathname }); }
  function ping() {
    if (document.hidden) return;                       // แท็บถูกซ่อน = ไม่ส่ง (เงียบเกิน 70 วิ จะถูกนับเป็นออฟไลน์)
    try { fetch('/api/presence/ping', { method: 'POST', headers: { 'content-type': 'application/json' }, body: body(), keepalive: true }).catch(function () { }); } catch (e) { }
  }
  ping(); setInterval(ping, 25000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) ping(); });
  window.addEventListener('pagehide', function () {
    try { navigator.sendBeacon && navigator.sendBeacon('/api/presence/bye', new Blob([body()], { type: 'application/json' })); } catch (e) { }
  });
})();
