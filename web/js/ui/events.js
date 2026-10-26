/* UI · การคลิก/เมาส์/คีย์บอร์ด และ handle() ของทุกปุ่ม (data-act) */
'use strict';
/* ------------------------------------------------------------------ interactions */
function openMenu(actions,el){const r=el.getBoundingClientRect();ui.menu={actions,x:r.left,y:r.bottom+4};render()}
function onCard(uid,el){
  const G=ui.G;const m=cardMap();const c=m[uid];if(!c)return;
  const _pdv=pdOf();if(!(_pdv&&_pdv.p===ui.viewer&&(_pdv.kind==='attack'||(_pdv.kind==='pick'&&(_pdv.spec.kind==='units'||_pdv.spec.kind==='attackTarget')))&&!ui.menu))showPop(c,el,true);
  const pd=pdOf();
  if(ui.cover!==null)return;
  if(pd&&pd.p===ui.viewer){
    if(pd.kind==='pick'&&(pd.spec.kind==='units'||pd.spec.kind==='attackTarget')){
      if(pd.spec.options.some(o=>o.id===uid))return answer([uid]);
      if(pd.spec.kind==='attackTarget'&&c.def.kind==='Avatar'&&c.owner!==pd.p&&pd.spec.options.some(o=>o.id==='avatar'))return answer(['avatar']);
    }
    if(pd.kind==='attack'){
      const o=pd.spec.options;
      if(ui.sel!=null){
        const cur=o.find(x=>x.attacker.uid===ui.sel);
        if(cur&&cur.units.some(u=>u.uid===uid))return answer({attacker:ui.sel,target:uid});
        if(cur&&cur.avatar&&c.def.kind==='Avatar'&&c.owner!==pd.p)return answer({attacker:ui.sel,target:'avatar'});
      }
      if(o.some(x=>x.attacker.uid===uid)){ui.sel=ui.sel===uid?null:uid;ui.inspect=c;return render()}
    }
    if(pd.kind==='act'){
      const acts=pd.spec.actions.filter(a=>a.uid===uid||(a.card&&a.card.host&&a.card.host.uid===uid));
      if(acts.length){ui.inspect=c;return openMenu(acts,el)}
      if(c.zone==='hand'&&c.owner===pd.p){const w=AF.whyNot(G,c.owner,c);ui.inspect=c;ui.tab='card';ui.menu={actions:[],x:el.getBoundingClientRect().left,y:el.getBoundingClientRect().bottom,why:w};return render()}
    }
  }
  ui.inspect=c;ui.menu=null;if(innerWidth<1050&&ui.tab!=='card')ui.tab='card';render();
}
const pop=document.createElement('div');pop.id='cardpop';pop.hidden=true;document.body.appendChild(pop);
let popPin=false;
function hidePop(){pop.hidden=true;popPin=false}
function pdefCard(id){const d=AF.defs[id];return d?{uid:0,def:d,zone:'pool',owner:-1}:null}
function showPop(c,el,pin,force){
  try{
    if(!c||!el){return hidePop()}
    if(!force){
    if(!ui.G||ui.screen!=='game'||ui.cover!==null){return hidePop()}
    if(c.zone==='hand'&&c.owner!==ui.viewer&&!ui.peek&&ui.cfg.mode!=='spec')return hidePop();
    if(c.zone==='deck')return hidePop();}
    pop.innerHTML=inspectorHTML(c);popPin=!!pin;pop.hidden=false;
    const r=el.getBoundingClientRect(),W=250,vw=innerWidth,vh=innerHeight;
    const sheet=vw<700;pop.classList.toggle('sheet',sheet);
    if(sheet)return;
    const menuW=pin&&ui.menu!==false?300:0;
    let x=r.right+8+(pin?menuW-r.width:0);
    if(x+W>vw-8)x=r.left-W-8;
    if(x<8)x=Math.max(8,vw-W-8);
    const h=pop.offsetHeight;let y=Math.min(Math.max(8,r.top-20),vh-h-8);
    pop.style.left=x+'px';pop.style.top=Math.max(8,y)+'px';
  }catch(e){hidePop()}
}
document.addEventListener('keydown',e=>{if(e.key==='Escape')hidePop()});
function setInspect(c){
  const pb=document.querySelector('.pbody');if(!c||(ui.inspect&&ui.inspect.uid===c.uid))return;
  ui.inspect=c;if(ui.tab==='card'&&pb)pb.innerHTML=inspectorHTML(c);
}
const canHover=matchMedia('(hover:hover)').matches;
root.addEventListener('mouseover',e=>{if(!ui.G||ui.screen!=='game'){const pd0=e.target.closest('[data-pdef]');if(pd0&&canHover)showPop(pdefCard(pd0.dataset.pdef),pd0,false,true);return}const pd0=e.target.closest('[data-pdef]');if(pd0){if(canHover)showPop(pdefCard(pd0.dataset.pdef),pd0,false,true);return}const pp=e.target.closest('[data-pop]');if(pp){const c=cardMap()[+pp.dataset.pop];if(c&&canHover)showPop(c,pp,false);return}const el=e.target.closest('[data-uid]');if(el){const c=cardMap()[+el.dataset.uid];if(c){setInspect(c);if(canHover)showPop(c,el,false)}}});
root.addEventListener('mouseout',e=>{if(popPin)return;const el=e.target.closest('[data-uid],[data-pop],[data-pdef]');if(el&&!(e.relatedTarget&&el.contains(e.relatedTarget)))hidePop()});
root.addEventListener('input',e=>{if(e.target.dataset&&e.target.dataset.fb){ui.fb[e.target.dataset.fb]=e.target.value;return}});
root.addEventListener('click',e=>{
  hidePop();
  const a=e.target.closest('[data-act]');
  if(a)return handle(a.dataset.act,a.dataset,a,e);
  const pdf=e.target.closest('[data-pdef]');if(pdf&&!e.target.closest('[data-act]')){showPop(pdefCard(pdf.dataset.pdef),pdf,false,true);popPin=true;return}
  const pp=e.target.closest('[data-pop]');if(pp){const c=cardMap()[+pp.dataset.pop];if(c)showPop(c,pp,false);popPin=true;return}
  const z=e.target.closest('[data-zone]');
  const u=e.target.closest('[data-uid]');
  if(u&&ui.screen==='game'&&!(z&&z.dataset.zone==='avatar'&&u===z))return onCard(+u.dataset.uid,u);
  if(z&&ui.screen==='game'){
    const p=+z.dataset.p;
    if(z.dataset.zone==='avatar'){const pd=pdOf();if(pd&&pd.kind==='attack'&&ui.sel!=null)return answer({attacker:ui.sel,target:'avatar'});if(pd&&pd.kind==='pick'&&pd.spec.kind==='attackTarget')return answer(['avatar'])}
    if(z.dataset.zone==='discard'){ui.modal={t:'discard',p};ui.menu=null;return render()}
    if(z.dataset.zone==='deck'){ui.modal={t:'pile',p};return render()}
  }
  if(ui.menu){ui.menu=null;render()}
});
function handle(act,d,el,e){
  const G=ui.G;const pd=pdOf();
  switch(act){
    case 'sel':ui.cfg.sel[+d.p]=d.k;ui.modal=null;saveCfg();return render();
    case 'chgdeck':ui.modal={t:'pickdeck',p:+d.p,title:ui.cfg.mode==='online'?'':(ui.cfg.mode==='bot'?['คุณ (ผู้เล่น 1)','บอท (ผู้เล่น 2)']:ui.cfg.mode==='hot'?['ผู้เล่น 1','ผู้เล่น 2']:['บอท A','บอท B'])[+d.p]};return render();
    case 'editdb':{const b=deckByKey(ui.cfg.sel[+d.p]);if(!b)return;
      if(b.preset)AFSite.openDeck({text:deckToText({name:'เด็คของฉัน – '+b.name,avatar:b.avatar,counts:b.counts,edeck:null}),name:'เด็คของฉัน – '+b.name});
      else AFSite.openDeck({id:b.id});return}
    case 'page':ui.page=d.v;ui.modal=null;return render();
    case 'data':ui.modal={t:'data'};return render();
    case 'apiapply':{const v=(document.getElementById('apiurl')||{}).value||'';if(/^https?:\/\//.test(v.trim()))ui.cfg.api=v.trim();DATA.setApi(ui.cfg.api);saveCfg();ui.modal=null;DATA.load();return render()}
    case 'mode':if(d.v!=='online')olLeave(true);ui.err='';ui.cfg.mode=d.v;return render();
    case 'olcreate':return olCreate();
    case 'oljoin':return olJoin();
    case 'olready':return olReady();
    case 'olleave':olLeave(true);ui.err='';return render();
    case 'olcopy':return olCopy(el);
    case 'first':ui.cfg.first=d.v;return render();
    case 'start':return startGame();
    case 'help':ui.modal={t:'help'};return render();
    case 'notes':ui.modal={t:'notes'};return render();
    case 'feedback':ui.fb.msg='';ui.fb.ok=false;ui.modal={t:'feedback'};return render();
    case 'fbagain':ui.fb=Object.assign(ui.fb,{text:'',msg:'',ok:false});return render();
    case 'fbsend':return sendFeedback();
    case 'closemodal':ui.modal=null;return render();
    case 'closemenu':ui.menu=null;return render();
    case 'closeover':ui.over=ui.over;ui.hideOver=true;ui.overShown=false;ui.over=null;return render();
    case 'restart':return startGame();
    case 'tosetup':olLeave(true);ui.token++;ui.screen='setup';ui.page='play';DATA.applyPending();fixSelections();ui.pending=null;ui.over=null;ui.modal=null;return render();
    case 'tab':ui.tab=d.v;return render();
    case 'settings':ui.settings=true;return render();
    case 'closesettings':ui.settings=false;return render();
    case 'setscale':applyScale(+d.v);return render();
    case 'surrender':{
      if(!confirm('ยอมแพ้และกลับไปหน้าแรก?'))return;
      olLeave(true);ui.token++;ui.screen='setup';ui.page='play';DATA.applyPending();fixSelections();ui.pending=null;ui.over=null;ui.modal=null;ui.menu=null;ui.settings=false;
      return render();
    }
    case 'dllog':{
      const G=ui.G;
      const head=`AvastFall Playtest – Battle Log\nผู้เล่น: ${G.players.map(P=>P.name).join(' vs ')}\nเทิร์นล่าสุด: ${G.turn}\nบันทึกเมื่อ: ${new Date().toLocaleString('th-TH')}\n${'='.repeat(40)}\n`;
      const body=G.log.map(l=>l.extra&&l.extra.divider?`\n----- ${l.text} -----`:`[T${l.turn}] ${l.text}`).join('\n');
      const blob=new Blob([head+body+'\n'],{type:'text/plain;charset=utf-8'});
      const a=document.createElement('a');
      a.href=URL.createObjectURL(blob);
      a.download='avastfall-battlelog-'+new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')+'.txt';
      document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(a.href),1000);
      return;
    }
    case 'ready':ui.viewer=ui.cover;ui.cover=null;return render();
    case 'speed':{const s=ui.cfg.speed;ui.cfg.speed=s>=800?0:s===0?250:s<300?550:1000;saveCfg();return render()}
    case 'pass':return answer({t:'pass'});
    case 'doact':{const a=ui.menu.actions[+d.i];return answer(a)}
    case 'doactu':{const a=pd.spec.actions.find(x=>x.uid===+d.id&&x.zone==='discard');return answer(a)}
    case 'endatk':return answer(null);
    case 'unsel':ui.sel=null;return render();
    case 'skip':return answer([]);
    case 'mull':return answer(d.v==='1');
    case 'respond':return answer(d.id===''?null:+d.id);
    case 'choice':{const o=pd.spec.options.find(x=>String(x.id)===d.id);return answer([o?o.id:d.id])}
    case 'payel':{const s=pd.spec;const o=s.options.find(x=>x.id===d.id);if(!o)return;if(pd.order.filter(k=>k===o.id).length>=o.count)return;pd.order.push(o.id);if(pd.order.length>=s.n)return answer(pd.order.slice());return render()}
    case 'payclear':pd.order=[];return render();
    case 'pickc':{const id=+d.id;const s=pd.spec;const max=s.max||1;const i=pd.order.indexOf(id);if(i>=0)pd.order.splice(i,1);else{if(max===1)pd.order=[id];else if(pd.order.length<max)pd.order.push(id)}return render()}
    case 'pickok':return answer(pd.order.slice());
    case 'pickskip':return answer([]);
    case 'ord':{const id=+d.id;const i=pd.order.indexOf(id);if(i>=0)pd.order.splice(i,1);else pd.order.push(id);return render()}
    case 'ordreset':pd.order=[];return render();
    case 'ordkeep':return answer(pd.spec.cards.map(c=>c.uid));
    case 'ordok':return answer(pd.order.slice());
  }
}
// answer the pick for names: engine expects option ids (names)
window.addEventListener('keydown',e=>{if(e.key==='Escape'){if(ui.settings){ui.settings=false;render();return}if(ui.modal){ui.modal=null;render()}}});
// สไลเดอร์ขนาดหน้าจอ: ปรับสดโดยไม่ render ใหม่ (กันสไลเดอร์สะดุดขณะลาก)
root.addEventListener('input',e=>{if(e.target.id!=='scalerange')return;applyScale(+e.target.value);const l=document.getElementById('scaleval');if(l)l.textContent=ui.scale+'%'});

/* ส่งข้อเสนอแนะ (ตัวส่งจริงอยู่ที่ js/data/feedback-api.js) */
async function sendFeedback(){
  const f=ui.fb;if(f.busy)return;
  if(f.text.trim().length<3){f.msg='กรุณาพิมพ์ข้อความอย่างน้อย 3 ตัวอักษร';return render()}
  f.busy=true;f.msg='';render();
  const website=(document.querySelector('[data-fb=website]')||{}).value||'';
  try{
    await AF.feedback.send({category:f.cat,text:f.text,name:f.name,contact:f.contact,website,
      context:{หน้า:ui.screen==='game'?'ในเกม':ui.page==='guide'?'วิธีเล่น':'ตั้งค่า',จอ:innerWidth+'x'+innerHeight,ภาษา:navigator.language||''}});
    f.ok=true;f.text='';
  }catch(e){f.msg=e.message}
  f.busy=false;render();
}
