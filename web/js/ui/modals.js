/* UI · หน้าต่างป๊อปอัป: ตอบโต้/เลือกการ์ด (pending) กติกา ข้อสังเกต ข้อมูลการ์ด ตัวแก้เด็ค */
'use strict';
/* ------------------------------------------------------------------ pending modals */
function pcard(c,o={}){return `<button class="pc ${o.on?'on':''} ${o.off?'off':''}" ${o.off?'disabled':''} data-act="pickc" data-id="${c.uid}">${o.ord?`<span class="ord">${o.ord}</span>`:''}<div class="card ${cardArt(c.def.id)}" data-pop="${c.uid}"></div><small>${esc(c.def.name)}</small></button>`}
function pendingModalHTML(){
  const pd=pdOf();if(!pd||ui.cover!==null)return '';
  const s=pd.spec;const G=ui.G;
  if(pd.kind==='mulligan'){
    return `<div class="ov"><div class="dlg"><h2>${esc(G.players[pd.p].name)}: มือเริ่มต้น</h2><p class="muted">เปลี่ยนมือได้ 1 ครั้ง การ์ดทั้งหมดจะไปอยู่ใต้เด็ค จั่วใหม่ 6 ใบ แล้วสับเด็ค</p><div class="cgrid">${s.hand.map(c=>`<div class="pc"><div class="card ${cardArt(c.def.id)}" data-pop="${c.uid}"></div><small>${esc(c.def.name)}</small></div>`).join('')}</div><div class="acts"><button class="btn" data-act="mull" data-v="1">เปลี่ยนมือ (Mulligan)</button><button class="btn pri" data-act="mull" data-v="0">เก็บมือนี้</button></div></div></div>`;
  }
  if(pd.kind==='respond'){
    const it=s.item;const P=G.players[pd.p];
    const what=it.kind==='attack'?`การโจมตี: ${esc(it.attacker.def.name)} → ${it.target==='avatar'?'Avatar':esc(it.target.def.name)}`:esc(it.label||it.source.def.name);
    const cards=s.options.map(uid=>P.hand.find(c=>c.uid===uid)).filter(Boolean);
    return `<div class="ov"><div class="dlg"><h2>${esc(P.name)}: ใช้ Counter ไหม?</h2><p><b>${esc(G.players[it.controller].name)}</b> ทำ ${what}</p><p class="muted">Element ที่พร้อมใช้ ${AF.standElems(P).length} ใบ</p><div class="cgrid">${cards.map(c=>`<button class="pc" data-act="respond" data-id="${c.uid}"><div class="card ${cardArt(c.def.id)}" data-pop="${c.uid}"></div><small>${esc(c.def.name)} (${(AF.FX[c.def.id]&&AF.FX[c.def.id].counter&&AF.FX[c.def.id].counter.life)?'จ่าย HP '+AF.FX[c.def.id].counter.life:'Spend '+AF.spellCost(G,pd.p,c,true)})</small></button>`).join('')}</div><div class="acts"><button class="btn pri" data-act="respond" data-id="">ไม่ใช้</button></div></div></div>`;
  }
  if(pd.kind==='order'){
    const sel=pd.order;
    return `<div class="ov"><div class="dlg"><h2>${esc(s.title)}</h2><p class="muted">คลิกการ์ดตามลำดับที่ต้องการ เลข 1 = ลำดับแรก</p><div class="cgrid">${s.cards.map(c=>{const i=sel.indexOf(c.uid);return `<button class="pc ${i>=0?'on':''}" data-act="ord" data-id="${c.uid}">${i>=0?`<span class="ord">${i+1}</span>`:''}<div class="card ${cardArt(c.def.id)}" data-pop="${c.uid}"></div><small>${esc(c.def.name)}</small></button>`}).join('')}</div><div class="acts"><button class="btn" data-act="ordreset">ล้างลำดับ</button><button class="btn" data-act="ordkeep">ใช้ลำดับเดิม</button><button class="btn pri" data-act="ordok" ${sel.length===s.cards.length?'':'disabled'}>ยืนยัน</button></div></div></div>`;
  }
  if(pd.kind==='pick'){
    if(s.kind==='units'||s.kind==='attackTarget')return '';
    const sel=pd.order;
    if(s.kind==='payel'){
      const got={};sel.forEach(k=>{got[k]=(got[k]||0)+1});
      const btns=s.options.map(o=>{const left=o.count-(got[o.id]||0);return `<button class="elpay ${left<=0?'zero':''}" data-act="payel" data-id="${esc(o.id)}" ${left<=0?'disabled':''} aria-label="จ่าย ${esc(o.id)}"><span class="eli">${elIcon(o.id,46)}</span><b class="eln">${left}</b><small>${esc(o.id)}</small></button>`}).join('');
      const chosen=sel.map(k=>elIcon(k,26)).join('')||'<span class="muted">ยังไม่ได้เลือก</span>';
      return `<div class="ov"><div class="dlg narrow"><h2>${esc(s.title)}</h2><p class="muted">กดที่สีเพื่อจ่ายทีละใบ (เลขใต้ไอคอน = จำนวนที่เหลือ) กดครบ ${s.n} ใบแล้วจะจ่ายให้ทันที</p><div class="elpays">${btns}</div><div class="elsel"><span>จะจ่าย ${sel.length}/${s.n}:</span>${chosen}</div><div class="acts"><button class="btn" data-act="payclear" ${sel.length?'':'disabled'}>ล้างที่เลือก</button></div></div></div>`;
    }
    if(s.kind==='choice')return `<div class="ov"><div class="dlg narrow"><h2>${esc(s.title)}</h2><div class="acts" style="justify-content:flex-start">${s.options.map(o=>`<button class="btn" data-act="choice" data-id="${esc(o.id)}">${esc(o.label)}</button>`).join('')}</div></div></div>`;
    if(s.kind==='names'){
      const P=G.players[pd.p];const cnt={};P.deck.forEach(c=>cnt[c.def.name]=(cnt[c.def.name]||0)+1);
      return `<div class="ov"><div class="dlg"><h2>${esc(s.title)}</h2><p class="muted">ในเด็คเหลือกี่ใบแสดงข้างชื่อ (ไม่รวมการ์ดที่อยู่ที่อื่นแล้ว)</p><input id="nsearch" type="search" placeholder="ค้นหาชื่อการ์ด" style="width:100%;padding:8px;border:2px solid var(--line);border-radius:8px;background:var(--paper);color:var(--ink)"><div class="names" id="nlist">${s.options.map(o=>`<button class="btn" data-act="choice" data-id="${esc(o.id)}" data-n="${esc(o.label)}">${esc(o.label)} <span class="muted">×${cnt[o.label]||0}</span></button>`).join('')}</div></div></div>`;
    }
    // cards / reveal
    const all=(s.ctx&&s.ctx.all)||null;
    const optIds=new Set(s.options.map(o=>o.id));
    const list=all||s.options.map(o=>o.card);
    const min=s.min||0,max=s.max||1;
    const ok=sel.length>=min&&sel.length<=max;
    return `<div class="ov"><div class="dlg"><h2>${esc(s.title)}</h2><p class="muted">${max>1?`เลือกได้สูงสุด ${max} ใบ`:'เลือก 1 ใบ'}${s.optional?' หรือไม่เลือกก็ได้':''}</p><div class="cgrid">${list.map(c=>pcard(c,{on:sel.includes(c.uid),off:!optIds.has(c.uid)})).join('')}</div><div class="acts">${s.optional?'<button class="btn" data-act="pickskip">ไม่เลือก</button>':''}<button class="btn pri" data-act="pickok" ${ok?'':'disabled'}>ยืนยัน</button></div></div></div>`;
  }
  return '';
}
function menuHTML(){
  const m=ui.menu;
  const items=m.actions.map((a,i)=>`<button class="btn" data-act="doact" data-i="${i}">${esc(a.t==='summon'?`อัญเชิญ ${a.card.def.name} (Invite ${a.card.def.cost})`:a.t==='spell'||a.t==='equip'||a.t==='domain'?`ร่าย ${a.card.def.name} (${AF.spellCost(ui.G,a.card.owner,a.card)})`:a.t==='ultimate'?`ใช้ ${a.card.def.name}`:`${a.card&&a.card.zone==='equip'?'['+a.card.def.name+'] ':''}${a.kw?a.kw.split(' ')[0]+': ':''}${a.label}`)}</button>`).join('');
  const x=Math.min(m.x,innerWidth-300),y=Math.min(m.y,innerHeight-60-m.actions.length*40);
  return `<div class="menu" style="left:${Math.max(8,x)}px;top:${Math.max(8,y)}px">${items}<button class="btn sm" data-act="closemenu">ปิด</button></div>`;
}

/* ------------------------------------------------------------------ other modals */
function rulesHTML(compact){
  return `<div class="list">
  <h3>เป้าหมาย</h3><p>ใช้ Unit โจมตีให้ HP ของ Avatar ฝ่ายตรงข้ามจาก 10 เหลือ 0 ก่อน ถ้าจั่วการ์ดประจำเทิร์นไม่ได้เพราะเด็คหมด จะแพ้</p>
  <h3>เทิร์น</h3><p><b>Start</b> Unit และ Element ที่นอนอยู่ตั้งขึ้นทั้งหมด · <b>Draw</b> จั่ว 1 ใบ และรับ Element 1 ใบ (ผู้เล่นคนแรกเทิร์นแรกจั่วเพิ่มแทน) · <b>Main</b> ลงการ์ด ใช้ความสามารถ Unit ที่ลงเทิร์นนี้ยังโจมตีไม่ได้ · <b>Attack</b> โจมตีได้หลายครั้ง · <b>Ultimate</b> ใช้การ์ด Ultimate · <b>End</b> จบเทิร์น</p>
  <h3>Element</h3><p>Invite (อัญเชิญ Unit) ใช้ Element ธาตุตรงกับ Unit ตาม Cost ส่วน Spend (Enchant, Equipment, Domain, Ultimate) ใช้ธาตุไหนก็ได้ Element ที่ใช้แล้วจะนอน (Rest) จนถึง Start Phase ของเรา</p>
  <h3>โจมตี</h3><p>เลือก Unit ที่ตั้งอยู่ ให้นอน แล้วเลือกเป้าหมาย ถ้า ATK ≥ DEF ทำลายเป้า ถ้าน้อยกว่าไม่มีอะไรเกิดขึ้น โจมตี Avatar ได้เมื่อฝ่ายตรงข้ามไม่มี Unit หรือ Unit ทุกใบนอนอยู่ ดาเมจ = CRI</p>
  <h3>Counter</h3><p>ตอบโต้ได้ตอนฝ่ายตรงข้ามประกาศโจมตี ใช้ความสามารถ Unit หรือร่าย Spell ใช้ Element ที่เหลือจากเทิร์นตัวเองได้ ผลทำงานแบบใบสุดท้ายทำก่อน</p>
  <h3>การ์ด</h3><p>Unit (ATK/DEF/CRI) · Equipment ติด Unit 1 ใบ · Domain สนาม 3 ใบ ห้ามชื่อซ้ำ · Enchant วางใน Magic Area 3 ช่อง · ADVENT ตอนอัญเชิญ · ADMONISH ตอนถูกทำลายลงกองทิ้ง</p>
  ${compact?'':'<h3>เด็ค</h3><p>เด็คหลัก 60 ใบ (รวม Avatar) ชื่อซ้ำได้ 4 ใบ · Element Deck 8 ใบ</p>'}
  </div>`;
}
function modalHTML(){
  const m=ui.modal;if(!m)return '';
  const G=ui.G;
  const close=`<div class="acts"><button class="btn" data-act="closemodal">ปิด</button></div>`;
  if(m.t==='help')return `<div class="ov"><div class="dlg">${`<h2>กติกาโดยย่อ</h2>`}${rulesHTML(false)}${close}</div></div>`;
  if(m.t==='feedback'){
    const f=ui.fb;
    if(f.ok)return `<div class="ov"><div class="dlg narrow"><h2>ขอบคุณสำหรับข้อเสนอแนะ</h2><p>ส่งถึงผู้พัฒนาเรียบร้อยแล้ว</p><div class="acts"><button class="btn" data-act="fbagain">ส่งอีกข้อความ</button><button class="btn pri" data-act="closemodal">ปิด</button></div></div></div>`;
    return `<div class="ov"><div class="dlg narrow"><h2>ข้อเสนอแนะ</h2><p class="muted">อยากให้ปรับหรือเพิ่มอะไร พบจุดผิดปกติ หรือการ์ดใบไหนทำงานไม่ตรงข้อความ บอกได้ที่นี่ ผู้พัฒนาจะอ่านทุกข้อความ</p>
      <label class="fl">หัวข้อ<select data-fb="cat">${AF.feedback.CATEGORIES.map(([k,l])=>`<option value="${k}" ${f.cat===k?'selected':''}>${esc(l)}</option>`).join('')}</select></label>
      <label class="fl">ข้อความ<textarea data-fb="text" class="ta" maxlength="1500" rows="6" placeholder="พิมพ์ข้อเสนอแนะของคุณ">${esc(f.text)}</textarea></label>
      <label class="fl">ชื่อ (ไม่ใส่ก็ได้)<input data-fb="name" type="text" maxlength="60" value="${esc(f.name)}"></label>
      <label class="fl">ช่องทางติดต่อกลับ (ไม่ใส่ก็ได้)<input data-fb="contact" type="text" maxlength="100" value="${esc(f.contact)}" placeholder="อีเมล / ไอดีโซเชียล"></label>
      <input data-fb="website" type="text" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;opacity:0;height:0">
      ${f.msg?`<div class="warnbox">${esc(f.msg)}</div>`:''}
      <div class="acts"><button class="btn" data-act="closemodal">ยกเลิก</button><button class="btn pri" data-act="fbsend" ${f.busy?'disabled':''}>${f.busy?'กำลังส่ง…':'ส่งข้อเสนอแนะ'}</button></div></div></div>`;
  }
  if(m.t==='notes')return `<div class="ov"><div class="dlg"><h2>Update Note</h2><div class="list">${UPDATE_NOTES.map(u=>`<div class="note"><b>${esc(u.date)} · ${esc(u.title)}</b><ul style="margin:4px 0 0;padding-left:20px">${u.items.map(i=>`<li>${esc(i)}</li>`).join('')}</ul></div>`).join('')}</div>${close}</div></div>`;
  if(m.t==='discard'){
    const P=G.players[m.p];const pd=pdOf();
    const acts=pd&&pd.kind==='act'&&pd.p===m.p?pd.spec.actions.filter(a=>a.zone==='discard'):[];
    return `<div class="ov"><div class="dlg"><h2>กองทิ้งของ ${esc(P.name)} (${P.discard.length} ใบ)</h2><div class="cgrid">${[...P.discard].reverse().map(c=>{const a=acts.find(x=>x.uid===c.uid);return `<div class="pc" style="cursor:default"><div class="card ${cardArt(c.def.id)}" data-pop="${c.uid}"></div><small>${esc(c.def.name)}</small>${a?`<button class="btn sm" data-act="doactu" data-id="${c.uid}">${esc(a.label)}</button>`:''}</div>`}).join('')||'<span class="muted">ว่าง</span>'}</div>${close}</div></div>`;
  }
  if(m.t==='deck'){
    const P=G.players[m.p];
    return `<div class="ov"><div class="dlg"><h2>ดึงการ์ดจากเด็คขึ้นมือ</h2><p class="muted">เครื่องมือผู้ทดสอบ จะสับเด็คหลังดึง</p><div class="cgrid">${[...P.deck].sort((a,b)=>a.def.id.localeCompare(b.def.id)).map(c=>`<button class="pc" data-act="fetchc" data-id="${c.uid}"><div class="card ${cardArt(c.def.id)}" data-pop="${c.uid}"></div><small>${esc(c.def.name)}</small></button>`).join('')}</div>${close}</div></div>`;
  }
  if(m.t==='pile')return `<div class="ov"><div class="dlg narrow"><h2>Main Deck ของ ${esc(G.players[m.p].name)}</h2><p>เหลือ ${G.players[m.p].deck.length} ใบ</p>${close}</div></div>`;
  if(m.t==='pickdeck'){
    const i=+m.p,cur=ui.cfg.sel[i],all=allDecks();
    const grp=(t,a)=>a.length?`<h3>${t}</h3><div class="decks">${a.map(d=>deckTile(d,i,d.key===cur)).join('')}</div>`:'';
    const mine=all.filter(d=>!d.preset);
    return `<div class="ov"><div class="dlg"><h2>เปลี่ยนเด็ค${m.title?' · '+esc(m.title):''}</h2>
      <p class="muted">เลือกเด็คที่ต้องการใช้ เด็คของฉันมาจากแท็บ Deckbuilder (สร้างและแก้ไขที่นั่นที่เดียว)</p>
      ${grp('เด็คของฉัน (จาก Deckbuilder)',mine)}${mine.length?'':'<div class="note">ยังไม่มีเด็คของคุณ กด "สร้างเด็คที่ Deckbuilder" เพื่อสร้าง แล้วกลับมาเลือกที่นี่</div>'}
      ${grp('เด็คตัวอย่าง',all.filter(d=>d.preset))}
      <div class="acts"><button class="btn pri" data-act="closemodal" data-go="deck">＋ สร้างเด็คที่ Deckbuilder</button><button class="btn" data-act="closemodal">ปิด</button></div></div></div>`;
  }
  if(m.t==='data'){
    const st=DATA.status,iss=DATA.issues();
    const stTxt=st.state==='loading'?'กำลังโหลด…':st.state==='live'?'เชื่อมต่อ card-api สำเร็จ':st.state==='cache'?'ใช้การ์ดที่บันทึกไว้ในเบราว์เซอร์':'ใช้การ์ดที่ฝังมากับหน้านี้';
    const li=(a,f)=>a.length?a.map(d=>`<li><b>${esc(d.id)}</b> ${esc(d.name)}${f?f(d):''}</li>`).join(''):'<li class="muted">ไม่มี</li>';
    const diff=d=>`<details><summary class="muted">ดูส่วนที่ต่าง</summary>${DATA.diff(d.id).map(x=>`<div class="note"><b>${esc(x.label)}</b><br><span class="muted">ที่สคริปต์เขียนไว้:</span> ${esc(x.was)}<br><span class="muted">ใน card-api ตอนนี้:</span> ${esc(x.now)}</div>`).join('')||'<div class="muted">ไม่พบส่วนที่ต่าง</div>'}</details>`;
    return `<div class="ov"><div class="dlg"><h2>ข้อมูลการ์ด</h2>
      <div class="opt"><b>สถานะ:</b> ${esc(stTxt)} · ${st.count} ใบ${st.at?' · อัปเดต '+new Date(st.at).toLocaleTimeString('th-TH'):''}</div>
      ${st.err?`<div class="note"><b>ต่อ card-api ไม่ได้:</b> ${esc(st.err)}<br><span class="muted">หน้านี้จะเปิดผ่านโฮสต์ของคุณจึงจะเรียก API ได้ (หน้าตัวอย่างในแอปเรียกเว็บภายนอกไม่ได้) ระหว่างนี้ใช้ข้อมูลที่บันทึกไว้/ฝังไว้ได้ตามปกติ รูปการ์ดดึงจาก card-api เช่นกัน</span></div>`:''}
      ${DATA.pending?'<div class="note">มีข้อมูลใหม่จาก card-api รอใช้ จะอัปเดตเมื่อกลับหน้าตั้งค่า</div>':''}
      <label class="fl">ที่อยู่ card-api<input id="apiurl" type="url" value="${esc(ui.cfg.api)}"></label>
      <div class="acts" style="justify-content:flex-start"><button class="btn pri" data-act="apiapply">โหลดการ์ดใหม่</button><a class="btn" href="${esc(DATA.cardListUrl())}" ${DATA.cardListUrl()==='/cards/'?'data-go="cards"':'target="_blank" rel="noopener"'}>เปิด Card List ↗</a></div>
      <h3>การ์ดที่ไม่มีในชุดสำรอง (เพิ่มใหม่ใน card-api)</h3><ul class="dl">${li(iss.isNew)}</ul>
      <h3>ยังไม่มีสคริปต์เอฟเฟกต์</h3><p class="muted">เล่นได้ (Unit ใช้ค่า ATK/DEF/CRI ตามจริง) แต่เอฟเฟกต์บนการ์ดไม่ทำงาน ใช้แถบ "เครื่องมือ" ทำผลเอง หรือส่งรายการนี้ให้ Claude เขียนสคริปต์เพิ่ม (ไฟล์ js/effects/)</p><ul class="dl">${li(iss.unscripted)}</ul>
      <h3>ข้อความ/ค่าสถานะต่างจากที่สคริปต์เขียนไว้</h3><p class="muted">มีคนแก้การ์ดใน card-api หลังจากเขียนสคริปต์ เอฟเฟกต์อาจไม่ตรงกับข้อความใหม่</p><ul class="dl">${li(iss.stale,diff)}</ul>
      ${close}</div></div>`;
  }
  return '';
}
