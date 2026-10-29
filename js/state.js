import { $, esc, pl, uid, today, parseKey, addDays, toMin, fromMin, fmtHM, mondayOf, CHECK } from './utils.js';
import { setAmbienceMedia, stopAmbienceMedia, haptic, playZenBell } from './media.js';
export { haptic, playZenBell };

export var KEY='brewer.v1';

/* ---------- estado ---------- */
export var UI={agDay:null,agView:'dia',revView:'hoje',showDone:false,pick:false,open:{},colView:'set',giveUp:false,catRange:7,asking:false,tkKind:'pessoal',tkP:'pend',tkF:'new',mdCfg:false,mdBusy:false,mdErr:'',showIgn:false,listening:false,pre:null,preTimer:0,sg:[],sgDay:'',dismissed:{},hideSug:'',amb:'off',homeSub:'prio'};
export var SH={};
export function setSH(val){SH=val}

export function fresh(){return {v:3,tasks:[],blocks:{},routines:[],rdone:{},log:{},urges:[],focus:null,wait:null,draft:{taskId:'',mins:25,kind:'total',cupModel:null},tab:'hoje',cups:[],unlocked:[],goal:240,goalStart:'',weekly1:true,testWeeks:0,keepAwake:true,interruptions:[],integrations:{googleCalendar:{status:'off'}},forceModel:null,testMode:false,sessions:[],sessMig:false,estLog:[],inbox:[],moodle:{baseUrl:'',token:'',ignored:{},confirmed:{},lastSync:0,lastResult:null},cats:['Estudo','Trabalho','Projeto pessoal','Saúde','Casa','Outro'],gateShortcut:'Liberar Instagram'}}

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
export function setDone(t,on){
  t.done=!!on;
  t.status=on?'done':'pending';
  t.doneAt=on?today():'';
  t.doneTs=on?Date.now():0;
  estRecord(t,on);
  try{if(on)haptic('success');else haptic('tap')}catch(e){}
}
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
  if(s.focus&&s.focus.mode!=='focus'&&s.focus.mode!=='break'){s.lastFocus=s.focus;s.focus=null}
  if(!s.sessMig){(s.cups||[]).forEach(function(c){s.sessions.push({id:'m'+c.id,d:c.d,t0:0,t1:0,mins:c.mins||0,mode:'total',ok:!!c.ok,cupId:c.id,model:c.model,cat:c.cat||'',label:c.label||'',taskId:'',src:'manual',blockId:'',ext:'',approx:true,sim:!!c.sim})});s.sessMig=true}
  var mo=s.moodle;if(!mo.ignored)mo.ignored={};if(!mo.confirmed)mo.confirmed={};
  return s;
}
export var S=load();
export function resetState(){S=fresh()}
var _saveListeners = [];
export function onStateSave(fn){ if(typeof fn==='function')_saveListeners.push(fn); }
export function save(){
  try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}
  _saveListeners.forEach(function(fn){ try{ fn(S); }catch(err){ console.warn(err); } });
}
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

/* ---------- avisos, som ambiente, tela ligada e modal ---------- */
var lock=null;
export function holdScreen(){if(!S.keepAwake)return;try{if('wakeLock' in navigator){navigator.wakeLock.request('screen').then(function(l){lock=l}).catch(function(){})}}catch(e){}}
export function releaseLock(){try{if(lock)lock.release()}catch(e){}lock=null;if(!S.focus||(S.focus.mode!=='focus'&&S.focus.mode!=='break'))stopAmbience()}


export function stopAmbience(){
  stopAmbienceMedia();
}
export function setAmbience(mode){
  setAmbienceMedia(mode);
}
export function alertUser(){
  try{haptic('success')}catch(e){}
  try{playZenBell()}catch(e){}
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
export var CAT_COLORS={'Estudo':'#4A7FAE','Trabalho':'#C8654B','Projeto pessoal':'#E3AE3C','Saúde':'#2A8E69','Casa':'#8A9A4B','Outro':'#7A4524'};
export function catColor(cat){return CAT_COLORS[cat]||'#9A7B5B'}
export function pickModel(){
  var n=CUP_ASSETS.good.length;
  if(S.forceModel!=null){var m=S.forceModel%n;S.forceModel=null;return m}
  if(S.draft&&S.draft.cupModel!=null&&S.unlocked.indexOf(+S.draft.cupModel)>-1)return +S.draft.cupModel;
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
export function v60CarafeSVG(anim){
  return '<svg class="v60-carafe'+(anim?' is-anim':'')+'" viewBox="0 0 200 200" width="100%" height="100%" aria-hidden="true">'+
    /* sombra da base */
    '<ellipse cx="100" cy="184" rx="54" ry="7" fill="rgba(42,29,20,.14)"/>'+
    /* vapor suave ou bico de ganso quando animando */
    (anim
      ?'<path d="M166 8c-20 0-32 7-45 14l-15 6" fill="none" stroke="#3A2416" stroke-width="4.5" stroke-linecap="round"/>'+
       '<line class="v60-stream" x1="103" y1="28" x2="100" y2="48" stroke="#C98A24" stroke-width="3" stroke-linecap="round"/>'+
       '<path class="v60-steam1" d="M82 36c-3-6 3-11 0-17" fill="none" stroke="#9A8470" stroke-width="1.8" stroke-linecap="round" opacity=".55"/>'
      :'<path class="v60-steam1" d="M88 38c-3-6 3-12 0-18" fill="none" stroke="#9A8470" stroke-width="1.8" stroke-linecap="round" opacity=".45"/>'+
       '<path class="v60-steam2" d="M112 36c-3-6 3-12 0-18" fill="none" stroke="#9A8470" stroke-width="1.8" stroke-linecap="round" opacity=".45"/>')+
    /* filtro V60 plissado (estilo clean original que o usuário curtiu) */
    '<path d="M44 46h112l-38 60H82z" fill="#FBF6EC" stroke="#D5C4AC" stroke-width="2" stroke-linejoin="round"/>'+
    '<ellipse cx="100" cy="46" rx="56" ry="5.5" fill="#FBF6EC" stroke="#D5C4AC" stroke-width="2"/>'+
    '<ellipse cx="100" cy="46" rx="48" ry="3.6" fill="#5C3A21"/>'+
    /* dobras plissadas do papel do filtro */
    '<line x1="56" y1="50" x2="86" y2="105" stroke="#E2D4C0" stroke-width="1.4"/>'+
    '<line x1="68" y1="51" x2="90" y2="105" stroke="#E2D4C0" stroke-width="1.4"/>'+
    '<line x1="82" y1="52" x2="94" y2="105" stroke="#E2D4C0" stroke-width="1.4"/>'+
    '<line x1="96" y1="52" x2="99" y2="105" stroke="#E2D4C0" stroke-width="1.4"/>'+
    '<line x1="110" y1="52" x2="103" y2="105" stroke="#E2D4C0" stroke-width="1.4"/>'+
    '<line x1="124" y1="51" x2="108" y2="105" stroke="#E2D4C0" stroke-width="1.4"/>'+
    '<line x1="138" y1="50" x2="112" y2="105" stroke="#E2D4C0" stroke-width="1.4"/>'+
    /* anel de madeira/cerâmica (suporte do V60 sobre a jarra) */
    '<rect x="72" y="104" width="56" height="6" rx="3" fill="#7B4F2E"/>'+
    /* alça da jarra de vidro (lado direito) */
    '<path d="M126 115h14a10 10 0 0 1 9 12l-5 30a10 10 0 0 1-10 8h-8" fill="none" stroke="#8C6E54" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'+
    /* corpo da jarrinha de vidro (formato cônico/arredondado estilo Hario Server) */
    '<path d="M74 110 L68 113 L73 118 L54 156 Q49 176 68 178 L132 178 Q151 176 146 156 L127 110 Z" fill="rgba(255,251,244,.65)" stroke="#C8B69E" stroke-width="2.2" stroke-linejoin="round"/>'+
    /* gotas caindo dentro da jarra */
    (anim
      ?'<circle class="v60-drop1" cx="100" cy="116" r="3" fill="#5C3A21"/>'+
       '<circle class="v60-drop2" cx="100" cy="116" r="2.5" fill="#5C3A21"/>'
      :'<circle cx="100" cy="121" r="2.6" fill="#5C3A21"/>')+
    /* café passado no fundo arredondado da jarra */
    '<path d="M60 148 Q100 151 140 148 L143 158 Q147 174 130 175 L70 175 Q53 174 57 158 Z" fill="#5C3A21"/>'+
    /* brilho sutil do vidro e marcações de ml */
    '<path d="M75 120 L63 154" fill="none" stroke="rgba(255,255,255,.75)" stroke-width="2.2" stroke-linecap="round"/>'+
    '<line x1="116" y1="136" x2="123" y2="136" stroke="#C8B69E" stroke-width="1.5" stroke-linecap="round"/>'+
    '<line x1="119" y1="146" x2="126" y2="146" stroke="#C8B69E" stroke-width="1.5" stroke-linecap="round"/>'+
  '</svg>';
}
export function heroFallbackHTML(){return v60CarafeSVG(false)}
export function chunk(a){var r=[];for(var i=0;i<a.length;i+=7)r.push(a.slice(i,i+7));return r}
export function cupShow(f){
  var c=f&&f.cupId?S.cups.find(function(x){return x.id===f.cupId}):null;
  return c?'<div class="cup-show'+(c.ok?'':' broke')+'">'+cupImg(c,'cup-hero',false)+'</div>':'';
}
export function focusHero(){return '<div class="hero">'+v60CarafeSVG(false)+'</div>'}
export function cupCard(){
  var ch=chunk(S.cups),last=ch[ch.length-1]||[],dots='';
  for(var i=0;i<7;i++){var b=last[i];dots+='<span class="bd'+(b?(b.ok?' ok':' bad'):'')+'"></span>'}
  return '<div class="sec"><h2>Preparar xícara</h2><p class="lead">'+(last.length?pl(last.length,'xícara','xícaras')+' no conjunto atual.':'Cada bloco de foco completo vira uma xícara na sua coleção.')+'</p><div class="dots" role="img" aria-label="'+last.length+' de 7 no conjunto">'+dots+'</div><div class="row"><button class="btn small" data-act="tab" data-tab="foco">Começar foco</button><button class="btn quiet small" data-act="tab" data-tab="colecao">Ver coleção</button></div></div>';
}
