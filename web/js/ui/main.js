/* UI · จุดเริ่มต้นของแอป (โหลดเป็นไฟล์สุดท้าย) */
'use strict';
DATA.boot();                       // ใช้สำเนาในเบราว์เซอร์ หรือ snapshot ก่อน
ui.cfg=loadCfg();ui.my=loadMy();
DATA.setApi(ui.cfg.api);
syncFromData();fixSelections();
render();
DATA.load();                       // แล้วค่อยดึงข้อมูลล่าสุดจาก card-api
try{const rc=new URLSearchParams(location.search).get('room');if(rc){ui.cfg.mode='online';ui.olcode=rc.toUpperCase();history.replaceState(null,'',location.pathname);olJoin(ui.olcode)}}catch(e){}   // เปิดลิงก์ห้อง ?room=รหัส
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&ui.screen!=='game'&&Date.now()-(DATA.status.at||0)>90000&&DATA.status.state!=='loading')DATA.load()});
/* ปุ่มบนแถบเมนูหลัก (วิธีเล่น · กระดิ่ง Update Note) เรียกเข้ามาทางนี้ (js/site.js) */
const noteKey=()=>{const u=UPDATE_NOTES[0];return u?(u.id||u.date)+'|'+u.title:''};
function syncBell(){let seen='';try{seen=localStorage.getItem('af-notes-seen')||''}catch(e){}const d=document.getElementById('hdrNotesDot');if(d)d.hidden=seen===noteKey()}
window.AFApp={
  guide(){if(ui.screen==='setup'){ui.page='guide';ui.modal=null;render();scrollTo(0,0)}else{ui.modal={t:'help'};render()}},   // กำลังเล่นอยู่: เปิดกติกาโดยย่อแทน เกมไม่หาย
  notes(){ui.modal={t:'notes'};render();try{localStorage.setItem('af-notes-seen',noteKey())}catch(e){}syncBell();loadUpdateNotes().then(()=>{try{localStorage.setItem('af-notes-seen',noteKey())}catch(e){}syncBell()})}
};
syncBell();
window.__af={ui,AF,DATA};
