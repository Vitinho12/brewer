import { $, esc, pl, uid, today, parseKey, addDays, toMin, fromMin, fmtHM, mondayOf, CHECK } from './utils.js';

export var KEY='brewer.v1';

/* ---------- estado ---------- */
export var UI={agDay:null,agView:'dia',revView:'hoje',showDone:false,pick:false,open:{},colView:'set',giveUp:false,catRange:7,asking:false,tkKind:'pessoal',tkP:'pend',tkF:'new',mdCfg:false,mdBusy:false,mdErr:'',showIgn:false,listening:false,pre:null,preTimer:0,sg:[],sgDay:'',dismissed:{},hideSug:''};
export var SH={};
export function setSH(val){SH=val}

export function fresh(){return {v:3,tasks:[],blocks:{},routines:[],rdone:{},log:{},urges:[],focus:null,wait:null,draft:{taskId:'',mins:25,kind:'total'},tab:'hoje',cups:[],unlocked:[],goal:240,goalStart:'',weekly1:true,testWeeks:0,keepAwake:true,interruptions:[],integrations:{googleCalendar:{status:'off'}},forceModel:null,testMode:false,sessions:[],sessMig:false,estLog:[],inbox:[],moodle:{baseUrl:'',token:'',ignored:{},confirmed:{},lastSync:0,lastResult:null},cats:['Estudo','Trabalho','Projeto pessoal','Saúde','Casa','Outro'],gateShortcut:'Liberar Instagram'}}

/* tarefa: campos novos sem remover nenhum dos antigos */
export function normTask(t){
  if(t.kind!=='pessoal'&&t.kind!=='faculdade')t.kind='pessoal';
  t.status=t.done?'done':'pending';
  if(t.est==null)t.est=0;if(t.note==null)t.note='';if(t.subject==null)t.subject='';if(t.dueTime==null)t.dueTime='';
  if(!t.origin)t.origin='manual';if(t.extId==null)t.extId='';if(t.url==null)t.url='';
  if(!t.createdAt){var n=parseInt(String(t.id||'').slice(0,-4),36);t.createdAt=(n>1.5e12&&n<4e12)?n:0}
  if(t.doneTs==null)t.doneTs=(t.done&&t.doneAt)?parseKey(t.doneAt).getTime()+43200000:0;
  return t;
}
export function setDone(t,on){t.done=!!on;t.status=on?'done':'pending';t.doneAt=on?today():'';t.doneTs=on?Date.now():0;estRecord(t,on)}
/* aprende com o próprio usuário: guarda estimado x realizado (sem IA; só ajusta a nota quando há amostras suficientes) */
export function estRecord(t,on){
  S.estLog=(S.estLog||[]).filter(function(r){return r.taskId!==t.id});
  if(on&&t.est>0&&t.spent>0)S.estLog.push({taskId:t.id,cat:t.cat||'',kind:t.kind,est:t.est,real:t.spent,t:Date.now()});
}
export function estStats(cat){
  var a=(S.estLog||[]).filter(function(r){return r.cat===(cat||'')});
  if(!a.length)return null;
  var e=0,r=0;a.forEach(function(x){e+=x.est;r+=x.real});
  return {n:a.length,ratio:e?r/e:1};
}
export function load(){
  var s=null;
  try{var r=localStorage.getItem(KEY);if(r)s=JSON.parse(r)}catch(e){}
  if(!s||typeof s!=='object')s=fresh();
  var f=fresh();for(var k in f){if(!(k in s))s[k]=f[k]}
  s.tasks=(s.tasks||[]).map(normTask);
  if(!s.draft)s.draft={taskId:'',mins:25};if(!s.draft.kind)s.draft.kind='total';
  if(!s.sessMig){(s.cups||[]).forEach(function(c){s.sessions.push({id:'m'+c.id,d:c.d,t0:0,t1:0,mins:c.mins||0,mode:'total',ok:!!c.ok,cupId:c.id,model:c.model,cat:c.cat||'',label:c.label||'',taskId:'',src:'manual',blockId:'',ext:'',approx:true,sim:!!c.sim})});s.sessMig=true}
  var mo=s.moodle;if(!mo.ignored)mo.ignored={};if(!mo.confirmed)mo.confirmed={};
  return s;
}
export var S=load();
export function resetState(){S=fresh()}
export function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
export function L(d){d=d||today();if(!S.log[d])S.log[d]={focus:0,resisted:0,gave:0,screen:null,win:'',next:'',cats:{},gateCount:0};if(S.log[d].gateCount==null)S.log[d].gateCount=0;return S.log[d]}
export function cmp(a,b){var x=a.due||'9999',y=b.due||'9999';return (a.prio-b.prio)||(x<y?-1:x>y?1:0)}
export function findTask(id){return S.tasks.find(function(t){return t.id===id})}
export function planned(k){return S.tasks.filter(function(t){return t.plan===k})}
export function setPlan(t,on){
  var k=today();
  if(on&&t.plan!==k&&planned(k).length>=3){toast('Só 3 por dia. Tire uma de hoje antes.');return false}
  t.plan=on?k:'';return true;
}
export function subjects(){var m={};S.tasks.forEach(function(t){if(t.subject)m[t.subject]=1});S.inbox.forEach(function(t){if(t.subject)m[t.subject]=1});return Object.keys(m).sort()}

/* a tela de resultado de um foco quebrado é "consumida" ao sair/entrar na aba Foco; os dados da sessão ficam em S.sessions, S.cups e S.lastFocus */
export function archiveFocus(){var f=S.focus;if(!f||f.mode==='focus')return;S.lastFocus=f;S.focus=null}

/* ---------- avisos, tela ligada e modal ---------- */
var lock=null;
export function holdScreen(){if(!S.keepAwake)return;try{if('wakeLock' in navigator){navigator.wakeLock.request('screen').then(function(l){lock=l}).catch(function(){})}}catch(e){}}
export function releaseLock(){try{if(lock)lock.release()}catch(e){}lock=null}
export function alertUser(){
  try{if(navigator.vibrate)navigator.vibrate([200,100,200])}catch(e){}
  try{
    var A=window.AudioContext||window.webkitAudioContext;var c=new A();
    var o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.frequency.value=660;
    g.gain.setValueAtTime(.0001,c.currentTime);g.gain.exponentialRampToValueAtTime(.2,c.currentTime+.05);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+.9);
    o.start();o.stop(c.currentTime+1);
  }catch(e){}
}
var toastT;
export function toast(m){var t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(function(){t.hidden=true},2800)}

export function openSheet(title,html){
  $('#sheetTitle').textContent=title;$('#sheetBody').innerHTML=html;
  $('#sheetBack').hidden=false;document.body.classList.add('locked');
  var i=$('#sheetBody input.field,#sheetBody textarea');if(i&&i.type!=='date'&&i.type!=='time')try{i.focus()}catch(e){}
}
export function closeSheet(){$('#sheetBack').hidden=true;document.body.classList.remove('locked');SH={}}

/* ---------- agenda e rotinas: dados compartilhados ---------- */
export function dayItems(k){
  var wd=parseKey(k).getDay(),items=[];
  (S.blocks[k]||[]).forEach(function(b){items.push({kind:'bloco',id:b.id,start:b.start,end:b.end,title:b.title,taskId:b.taskId||'',source:b.source||'local',allDay:!!b.allDay})});
  S.routines.forEach(function(r){
    if(r.days.indexOf(wd)>-1)items.push({kind:'rotina',id:r.id,start:r.time,end:fromMin(toMin(r.time)+(r.dur||30)),title:r.name,r:r});
  });
  items.sort(function(a,b){return ((b.allDay?1:0)-(a.allDay?1:0))||(toMin(a.start)-toMin(b.start))});
  return items;
}
export function stepsDone(k,r){
  var d=S.rdone[k+'|'+r.id]||[];
  return d.filter(function(id){return r.steps.some(function(s){return s.id===id})});
}
export function routineRow(r,k){
  var done=stepsDone(k,r),open=!!UI.open[k+'|'+r.id];
  var steps=open?'<ul class="steps">'+r.steps.map(function(st){
    var d=done.indexOf(st.id)>-1;
    return '<li class="'+(d?'done':'')+'"><button class="check sm" data-act="step" data-k="'+k+'" data-r="'+r.id+'" data-s="'+st.id+'" aria-label="'+(d?'Desmarcar':'Marcar')+': '+esc(st.text)+'">'+CHECK+'</button><span>'+esc(st.text)+'</span></li>';
  }).join('')+'</ul>':'';
  return '<button class="rhead" data-act="r-open" data-k="'+k+'" data-r="'+r.id+'" aria-expanded="'+open+'"><span><b>'+esc(r.name)+'</b><small class="muted">'+r.time+', '+(r.dur||30)+' min</small></span><span class="muted">'+done.length+'/'+r.steps.length+'</span></button>'+steps;
}
export function routinePct(k){
  var wd=parseKey(k).getDay(),tot=0,dn=0;
  S.routines.forEach(function(r){if(r.days.indexOf(wd)>-1&&(!r.created||r.created<=k)){tot+=r.steps.length;dn+=stepsDone(k,r).length}});
  return tot?{tot:tot,dn:dn}:null;
}

/* ---------- fases (torra), meta de 1%, sequência ---------- */
export var PHASES=[
 {min:0,name:'Primeiro Gole',desc:'O começo de tudo. Um gole de cada vez.'},
 {min:1,name:'Primeiro Grão',desc:'Você plantou a semente do hábito.'},
 {min:3,name:'Pré-infusão',desc:'A água encontra o café. Tudo começa a despertar.'},
 {min:7,name:'Extração Limpa',desc:'Uma semana inteira de consistência.'},
 {min:14,name:'Ritual do Café',desc:'Já virou parte da rotina.'},
 {min:21,name:'Moagem Consciente',desc:'Três semanas. Cada detalhe importa.'},
 {min:30,name:'Mestre do Filtro',desc:'Um mês de controle. A base está firme.'},
 {min:45,name:'Café Especial',desc:'Qualidade que só vem com repetição.'},
 {min:60,name:'Barista',desc:'Você domina o preparo. E a atenção.'},
 {min:90,name:'Mestre do V60',desc:'O domínio total do ritual.'}];
export function phaseIdx(n){var x=0;PHASES.forEach(function(p,i){if(n>=p.min)x=i});return x}
export function weekIdx(k){
  if(!S.weekly1)return 0;
  if(!S.goalStart)S.goalStart=mondayOf(today());
  var w=Math.round((parseKey(mondayOf(k||today()))-parseKey(S.goalStart))/(7*864e5));
  return Math.max(0,w+(S.testWeeks||0));
}
export function goalAt(w){var g=S.goal;for(var i=0;i<w;i++)g=Math.max(30,Math.min(g-1,Math.round(g*0.99)));return g}
export function currentGoal(k){return goalAt(weekIdx(k))}
export function nextGoal(){return S.weekly1?goalAt(weekIdx()+1):S.goal}
export function qualifies(k){var l=S.log[k];return !!l&&l.screen!=null&&l.screen<=(l.goal||currentGoal(k))}
export function streakInfo(){
  var t=today(),has=S.log[t]&&S.log[t].screen!=null,end=has?t:addDays(t,-1),n=0,d=end;
  while(qualifies(d)&&n<4000){n++;d=addDays(d,-1)}
  var best=0,run=0,prev=null;
  Object.keys(S.log).filter(qualifies).sort().forEach(function(k){run=(prev&&addDays(prev,1)===k)?run+1:1;if(run>best)best=run;prev=k});
  return {n:n,end:end,best:Math.max(best,n)};
}
export function updateTheme(){
  document.body.setAttribute('data-theme',phaseIdx(streakInfo().n));
  try{var m=document.querySelector('meta[name="theme-color"]'),c=getComputedStyle(document.body).getPropertyValue('--bg').trim();if(m&&c)m.setAttribute('content',c)}catch(e){}
}
export function screenStatusHTML(){
  var lg=L(),s=streakInfo(),g=fmtHM(lg.goal||currentGoal());
  if(lg.screen==null)return '<p><b>Hoje ainda não conta.</b></p><p class="muted small">Registre o tempo e fique dentro de '+fmtHM(currentGoal())+' (meta desta semana) para somar um dia. Sequência atual: '+pl(s.n,'dia','dias')+'.</p>';
  if(qualifies(today()))return '<p><b>Dentro da meta. Dia contado.</b></p><p class="muted small">'+fmtHM(lg.screen)+' de '+g+'. Sequência: '+pl(s.n,'dia','dias')+'.</p>';
  return '<p><b>Acima da meta. A sequência zerou.</b></p><p class="muted small">'+fmtHM(lg.screen)+' de '+g+'. Amanhã você recomeça do dia 1.</p>';
}
export function phaseBadge(){
  var s=streakInfo(),i=phaseIdx(s.n),p=PHASES[i],nx=PHASES[i+1];
  var pct=nx?Math.round((s.n-p.min)/(nx.min-p.min)*100):100;
  return '<button class="phase-badge" data-act="tab" data-tab="jornada">'+esc(p.name)+', '+pl(s.n,'dia','dias')+' &rsaquo;</button><div class="pbar" aria-hidden="true"><span style="width:'+pct+'%"></span></div>';
}

/* ---------- xícaras: registro central dos assets ---------- */
export var CUP_ASSETS={
  good:[
    'assets/cups/cup-01-good.webp','assets/cups/cup-02-good.webp','assets/cups/cup-03-good.webp','assets/cups/cup-04-good.webp',
    'assets/cups/cup-05-good.webp','assets/cups/cup-06-good.webp','assets/cups/cup-07-good.webp','assets/cups/cup-08-good.webp',
    'assets/cups/cup-09-good.webp','assets/cups/cup-10-good.webp','assets/cups/cup-11-good.webp','assets/cups/cup-12-good.webp'],
  broken:'assets/cups/cup-broken.webp'
};
export var CUP_META=[{name:'Terracota',color:'#C8654B'},{name:'Azul',color:'#4A7FAE'},{name:'Mostarda',color:'#E3AE3C'},{name:'Oliva',color:'#8A9A4B'},{name:'Grafite',color:'#2E2E30'},{name:'Vinho',color:'#7A2A3E'},{name:'Céu',color:'#A9C9E4'},{name:'Esmeralda',color:'#2A8E69'},{name:'Caramelo',color:'#7A4524'},{name:'Areia',color:'#E2C7AE'},{name:'Noite',color:'#3A3C48'},{name:'Rosa',color:'#E8B4B8'}];
export var FOCUS_ASSETS={hero:'assets/focus/v60.webp'};
export function cupMeta(i){return CUP_META[i]||{name:'Xícara '+(i+1),color:'#9A7B5B'}}
export function cupSrc(c){
  if(c.ok)return CUP_ASSETS.good[c.model]||'';
  var b=CUP_ASSETS.broken;return Array.isArray(b)?(b[c.model]||b[0]||''):(b||'');
}
export function pickModel(){
  var n=CUP_ASSETS.good.length;
  if(S.forceModel!=null){var m=S.forceModel%n;S.forceModel=null;return m}
  for(var i=0;i<n;i++)if(S.unlocked.indexOf(i)<0)return i;
  return S.cups.length%n;
}
export function addCup(ok,f,sim){
  var m=(f&&f.model!=null)?f.model:pickModel();
  var c={id:uid(),ok:!!ok,model:m,d:today(),mins:f?Math.max(1,f.mins||Math.round(f.total/60)):0,label:f?f.label:'',cat:f?f.cat:'',sim:!!sim};
  S.cups.push(c);if(ok&&S.unlocked.indexOf(m)<0)S.unlocked.push(m);
  return c;
}
export function cupImg(c,cls,act){
  var m=cupMeta(c.model);
  return '<img src="'+esc(cupSrc(c))+'" class="'+cls+'" alt="'+esc('Xícara '+m.name+(c.ok?', inteira':', quebrada'))+'" data-model="'+c.model+'" data-ok="'+(c.ok?1:0)+'"'+(act?' data-act="cup-info" data-id="'+c.id+'"':'')+'>';
}
export function cupFallback(color,broken){
  var c=broken?'#8d877f':color;
  return '<svg viewBox="0 0 200 200" width="100%" height="100%" aria-hidden="true"><ellipse cx="100" cy="168" rx="72" ry="14" fill="rgba(0,0,0,.3)"/><path d="M148 92h10a16 16 0 0 1 0 32h-14" fill="none" stroke="'+c+'" stroke-width="9"/><path d="M42 78h112v26a52 38 0 0 1-52 44h-8a52 38 0 0 1-52-44z" fill="'+c+'"/><ellipse cx="98" cy="78" rx="56" ry="11" fill="'+(broken?'#a39d94':'#3a2416')+'"/>'+(broken?'<path d="M96 82l-6 22 9 14-7 24" fill="none" stroke="#2a2622" stroke-width="3"/>':'')+'</svg>';
}
export function heroFallbackHTML(){
  return '<svg viewBox="0 0 200 200" width="100%" height="100%" aria-hidden="true"><path d="M30 52h140l-46 74H76z" fill="#f6f0e4" stroke="#c8baa0" stroke-width="2"/><rect x="70" y="132" width="60" height="46" rx="8" fill="#52341f"/></svg>';
}
export function chunk(a){var r=[];for(var i=0;i<a.length;i+=7)r.push(a.slice(i,i+7));return r}
export function cupShow(f){
  var c=f&&f.cupId?S.cups.find(function(x){return x.id===f.cupId}):null;
  return c?'<div class="cup-show'+(c.ok?'':' broke')+'">'+cupImg(c,'cup-hero',false)+'</div>':'';
}
export function focusHero(){return '<div class="hero"><img class="hero-img" src="'+FOCUS_ASSETS.hero+'" alt="" aria-hidden="true"></div>'}
export function cupCard(){
  var ch=chunk(S.cups),last=ch[ch.length-1]||[],dots='';
  for(var i=0;i<7;i++){var b=last[i];dots+='<span class="bd'+(b?(b.ok?' ok':' bad'):'')+'"></span>'}
  return '<div class="sec"><h2>Preparar xícara</h2><p class="lead">'+(last.length?pl(last.length,'xícara','xícaras')+' no conjunto atual.':'Cada bloco de foco completo vira uma xícara na sua coleção.')+'</p><div class="dots" role="img" aria-label="'+last.length+' de 7 no conjunto">'+dots+'</div><div class="row"><button class="btn small" data-act="tab" data-tab="foco">Começar foco</button><button class="btn quiet small" data-act="tab" data-tab="colecao">Ver coleção</button></div></div>';
}
