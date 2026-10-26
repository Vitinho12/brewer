import { $, mmss, uid, today, addDays, toMin, nowMin, fmtShort, mondayOf } from './utils.js';
import { S, UI, SH, resetState, save, L, cmp, findTask, normTask, setDone, planned, setPlan, archiveFocus, currentGoal, updateTheme, screenStatusHTML, CUP_ASSETS, cupMeta, addCup, cupFallback, heroFallbackHTML, holdScreen, releaseLock, alertUser, toast, closeSheet } from './state.js';
import { gcCfg, gcResetToken, gcRun, gcDiag, gcDisconnect, mdSync, mdFile, confirmInbox, ignoreInbox } from './sync.js';
import { renderHoje } from './views/hoje.js';
import { suggestionsFor, placeSuggestion, plannerSheet, blockSheet, PRESETS, dayChips, routineSheet, renderAgenda } from './views/agenda.js';
import { prioChips, applyPhrase, startVoice, readForm, taskSheet, inboxSheet, renderTarefas } from './views/tarefas.js';
import { AWAY_ASK_MS, breakFocus, completeFocus, endPartial, checkReturn, answerReturn, pauseFocus, resumeFocus, effCat, effTaskId, openRitual, beginFocus, startFocus, updateDur, setKindUI, renderFoco } from './views/foco.js';
import { WX, WY, startWait, logUrge, finishWait, renderVontade } from './views/vontade.js';
import { renderRevisao } from './views/revisao.js';
import { renderColecao } from './views/colecao.js';
import { renderJornada, simSession, testAdd, testRem, testSkip, testJump, testClear } from './views/jornada.js';

/* ---------- navegação ---------- */
export var TABS=['hoje','agenda','tarefas','foco','vontade','revisao','colecao','jornada'];

export function go(tab){
  var f=S.focus;
  if(f&&f.mode==='failed'&&((S.tab==='foco'&&tab!=='foco')||(S.tab!=='foco'&&tab==='foco')))archiveFocus();
  S.tab=tab;save();render();
  var sc=document.getElementById('scroll');if(sc)sc.scrollTop=0;
  window.scrollTo(0,0);
}
export function render(){
  if(TABS.indexOf(S.tab)<0)S.tab='hoje';
  TABS.forEach(function(t){$('#tab-'+t).hidden=(t!==S.tab)});
  document.querySelectorAll('.bar button').forEach(function(b){b.setAttribute('aria-current',b.dataset.tab===(['colecao','jornada','foco'].indexOf(S.tab)>-1?'hoje':S.tab)?'page':'false')});
  updateTheme();
  ({hoje:renderHoje,agenda:renderAgenda,tarefas:renderTarefas,foco:renderFoco,vontade:renderVontade,revisao:renderRevisao,colecao:renderColecao,jornada:renderJornada})[S.tab]();
  renderRun();
  updateLive();
}
export function renderRun(){
  var f=S.focus,el=$('#runpill');
  if(f&&f.mode==='focus'&&S.tab!=='foco'){
    el.innerHTML='<button data-act="tab" data-tab="foco">Foco em andamento: <b id="runTime">'+mmss(f.endTime-Date.now())+'</b></button>';
  }else el.innerHTML='';
}

/* ---------- fallback de imagens ---------- */
document.addEventListener('error',function(e){
  var i=e.target;if(!i||i.tagName!=='IMG')return;
  var d=document.createElement('div');
  if(i.dataset.model!==undefined){
    d.className=i.className+' cup-fb';if(i.dataset.act){d.dataset.act=i.dataset.act;d.dataset.id=i.dataset.id}
    d.setAttribute('role','img');d.setAttribute('aria-label',i.alt);d.innerHTML=cupFallback(cupMeta(+i.dataset.model).color,i.dataset.ok==='0');i.replaceWith(d);
  }else if(i.classList.contains('hero-img')){
    d.className='hero-fb';d.innerHTML=heroFallbackHTML();i.replaceWith(d);
  }
},true);

/* ---------- ao vivo ---------- */
var lastTick=Date.now();
export function updateLive(){
  var now=Date.now(),f=S.focus,s=S.wait,title='Brewer';
  if(f&&(f.mode==='focus'||f.mode==='break')){
    var rem=f.pausedAt?f.endTime-f.pausedAt:f.endTime-now;
    var ft=$('#focusTime');if(ft)ft.textContent=mmss(rem);
    var b=$('#focusBar');if(b)b.style.width=Math.max(0,Math.min(100,(1-rem/(f.total*1000))*100))+'%';
    var rt=$('#runTime');if(rt)rt.textContent=mmss(rem);
    title=(f.pausedAt?'Pausa · ':'')+mmss(rem)+' · Brewer';
  }
  if(s&&s.phase==='wait'){
    var st=$('#waitTime');if(st)st.textContent=mmss(s.end-now);
    var p=Math.max(0,Math.min(1,1-(s.end-now)/(s.total*1000)));
    var t0=s.ext?.55:0,t=t0+p*(1-t0);
    var c=$('#curveClip');if(c)c.setAttribute('width',WX(t).toFixed(1));
    var d=$('#curveDot');if(d){d.setAttribute('cx',WX(t).toFixed(1));d.setAttribute('cy',WY(t).toFixed(1))}
    var bl=$('#breathLabel');if(bl){var e=(now-(s.end-s.total*1000))%10000;bl.textContent=e<4000?'Inspira':'Solta'}
  }
  document.title=title;
}
setInterval(function(){
  var now=Date.now(),ch=false,f=S.focus,gap=now-lastTick;lastTick=now;
  if(f&&f.mode==='focus'&&f.kind!=='parcial'&&!f.pausedAt&&!f.hiddenAt&&gap>AWAY_ASK_MS&&!document.hidden){f.hiddenAt=now-gap;save()}
  if(f&&f.mode==='focus'&&f.hiddenAt&&!document.hidden)checkReturn();
  if(f&&f.mode==='focus'&&!f.pausedAt&&!f.hiddenAt&&!UI.asking&&(f.kind==='parcial'||!document.hidden)&&now>=f.endTime){completeFocus();return}
  if(f&&f.mode==='break'&&now>=f.endTime){f.mode='breakdone';ch=true;alertUser()}
  if(S.wait&&S.wait.phase==='wait'&&now>=S.wait.end){S.wait.phase='end';ch=true;alertUser();releaseLock()}
  if(ch){save();render()}else updateLive();
},250);
function markAway(){var f=S.focus;if(f&&f.mode==='focus'&&f.kind!=='parcial'&&!f.pausedAt&&!f.hiddenAt){f.hiddenAt=Date.now();save()}}
document.addEventListener('visibilitychange',function(){
  var f=S.focus;
  if(document.hidden){markAway();return}
  if((f&&f.mode==='focus'&&!f.pausedAt)||(S.wait&&S.wait.phase==='wait'))holdScreen();
  checkReturn();updateLive();
});
window.addEventListener('pagehide',markAway);
window.addEventListener('pageshow',function(){checkReturn()});

/* ---------- ações ---------- */
document.addEventListener('click',function(e){
  if(e.target&&e.target.id==='sheetBack'){if(UI.asking)return;closeSheet();return}
  var el=e.target.closest('[data-act]');if(!el)return;
  var a=el.dataset.act,id=el.dataset.id,t,k;
  switch(a){
    case 'tab':go(el.dataset.tab);break;
    case 'toggle':t=findTask(id);if(t){setDone(t,!t.done);save();render()}break;
    case 'plan':t=findTask(id);if(t){if(setPlan(t,t.plan!==today())){save();render()}}break;
    case 'pick':UI.pick=!UI.pick;render();break;
    case 'task-new':taskSheet('',false);break;
    case 'task-new-today':taskSheet('',true,'pessoal');break;
    case 'task-edit':taskSheet(id);break;
    case 'task-save':
      var fm=readForm(),txt=fm.text;
      if(!txt){toast('Escreva o que precisa ser feito.');break}
      var wantToday=$('#fToday').checked,due=fm.due;
      t=SH.id?findTask(SH.id):null;
      if(!t){t=normTask({id:uid(),text:txt,done:false,doneAt:'',due:due,prio:SH.prio,plan:'',spent:0,cat:'',kind:SH.tk||'pessoal',createdAt:Date.now()})}
      var was=t.plan===today();
      if(wantToday&&!was&&planned(today()).length>=3){toast('Só 3 por dia. Já tem 3 em hoje.');break}
      t.text=txt;t.due=due;t.prio=SH.prio;t.cat=fm.cat;t.est=fm.est;t.note=fm.note;if(t.kind==='faculdade')t.subject=fm.subject;
      if(wantToday)t.plan=today();else if(was)t.plan='';
      if(!SH.id)S.tasks.push(t);
      save();closeSheet();render();break;
    case 'task-del':S.tasks=S.tasks.filter(function(x){return x.id!==id});save();closeSheet();render();break;
    case 'task-focus':closeSheet();S.draft.taskId=id;S.draft.cat='';save();go('foco');break;
    case 'sh-prio':SH.prio=+el.dataset.v;$('#fPrio').innerHTML=prioChips(SH.prio);break;
    case 'sheet-close':closeSheet();break;
    case 'tk-kind':UI.tkKind=el.dataset.v;render();break;
    case 'tk-sub':if(UI.tkKind==='pessoal')UI.tkP=el.dataset.v;else UI.tkF=el.dataset.v;render();break;
    case 'voice':startVoice();break;
    case 'phrase-fill':var ph=$('#fPhrase');applyPhrase(ph?ph.value:'');break;
    case 'ib-confirm':var ic=S.inbox.find(function(x){return x.id===id});if(ic){confirmInbox(ic);save();render();toast('Confirmada. Ela está em Faculdade, Pendentes.')}break;
    case 'ib-edit':inboxSheet(id);break;
    case 'ib-ignore':var ii=S.inbox.find(function(x){return x.id===id});if(ii){ignoreInbox(ii);save();closeSheet();render();toast('Ignorada. Dá para restaurar em "Ver ignoradas".')}break;
    case 'ib-ign-toggle':UI.showIgn=!UI.showIgn;render();break;
    case 'ib-restore':var rest=null;Object.keys(S.moodle.ignored).forEach(function(k){var e2=S.moodle.ignored[k];if(e2.item&&e2.item.id===id){rest=e2.item;delete S.moodle.ignored[k]}});if(rest){rest.edited=true;S.inbox.push(rest);save();render()}break;
    case 'ib-save':
    case 'ib-save-confirm':
      var f2=readForm(),it2=S.inbox.find(function(x){return x.id===SH.id});
      if(!it2){closeSheet();break}
      if(!f2.text){toast('Escreva o título da atividade.');break}
      it2.title=f2.text;it2.subject=f2.subject;it2.due=f2.due;it2.est=f2.est;it2.prio=SH.prio;it2.note=f2.note;it2.edited=true;
      if(a==='ib-save-confirm'){confirmInbox(it2);toast('Confirmada. Ela está em Faculdade, Pendentes.')}
      save();closeSheet();render();break;
    case 'md-ics':var fi=$('#mdIcs');if(fi)fi.click();break;
    case 'md-cfg':UI.mdCfg=!UI.mdCfg;render();break;
    case 'md-save':
      var mu=($('#mdUrl').value||'').trim(),mt=($('#mdTok').value||'').trim();
      if(mu&&!/^https?:\/\//i.test(mu))mu='https://'+mu;
      S.moodle.baseUrl=mu;if(mt)S.moodle.token=mt;save();toast('Conexão salva neste aparelho.');render();break;
    case 'md-clear':S.moodle.token='';save();toast('Token apagado.');render();break;
    case 'md-sync':mdSync();break;
    case 'focus-task':S.draft.taskId=id;S.draft.cat='';save();go('foco');break;
    case 'dur-minus':S.draft.mins=Math.max(5,(S.draft.mins<5?5:Math.round(S.draft.mins/5)*5)-5);save();updateDur();break;
    case 'dur-plus':S.draft.mins=Math.min(720,(S.draft.mins<5?0:Math.round(S.draft.mins/5)*5)+5);save();updateDur();break;
    case 'dur-test':S.draft.mins=0.1667;save();updateDur();break;
    case 'kind-set':S.draft.kind=el.dataset.v==='parcial'?'parcial':'total';save();setKindUI();break;
    case 'start-focus':
      var cl2=$('#customLabel'),tid=effTaskId(),tk=tid?findTask(tid):null;
      openRitual({mins:S.draft.mins,kind:S.draft.kind,taskId:tid,label:tk?tk.text:((cl2&&cl2.value.trim())||'Foco livre'),cat:effCat()||'Sem categoria',src:'manual'});break;
    case 'pre-kind':if(UI.pre){UI.pre.cfg.kind=el.dataset.v==='parcial'?'parcial':'total';render()}break;
    case 'pre-go':if(UI.pre){UI.pre.step='v60';clearTimeout(UI.preTimer);UI.preTimer=setTimeout(beginFocus,2400);render()}break;
    case 'pre-skip':clearTimeout(UI.preTimer);beginFocus();break;
    case 'pre-back':clearTimeout(UI.preTimer);UI.pre=null;render();break;
    case 'end-partial':endPartial();break;
    case 'sg-place':var sp=UI.sg[+el.dataset.i];if(sp){placeSuggestion(UI.sgDay,sp);toast('Colocado na agenda.');render();plannerSheet(UI.sgDay)}break;
    case 'sg-no':var sn=UI.sg[+el.dataset.i];if(sn){UI.dismissed[UI.sgDay+'|'+sn.task.id]=true;plannerSheet(UI.sgDay)}break;
    case 'sg-edit':closeSheet();taskSheet(id);break;
    case 'sg-all':for(var gd=0;gd<8;gd++){var gl=suggestionsFor(UI.sgDay).filter(function(x){return x.fits===true});if(!gl.length)break;placeSuggestion(UI.sgDay,gl[0])}toast('Colocadas as que cabem.');render();plannerSheet(UI.sgDay);break;
    case 'sg-focus':var gt=findTask(id);if(gt)openRitual({mins:gt.est>0?gt.est:S.draft.mins,kind:S.draft.kind,taskId:gt.id,label:gt.text,cat:gt.cat||'Sem categoria',src:'manual'});break;
    case 'sg-hide':UI.hideSug=today();render();break;
    case 'gc-save-id':var cid=($('#gcClientId').value||'').trim();if(!/\.apps\.googleusercontent\.com$/.test(cid)){toast('Isso não parece um Client ID do Google (termina em .apps.googleusercontent.com).');break}gcCfg().clientId=cid;gcCfg().status='ready';save();render();break;
    case 'gc-change-id':gcCfg().clientId='';gcCfg().status='off';gcResetToken(false);save();render();break;
    case 'gc-sync':gcRun();break;
    case 'gc-diag':gcDiag();break;
    case 'gc-switch':UI.gcSelect=true;gcResetToken(true);gcRun();break;
    case 'gc-disconnect':gcDisconnect();break;
    case 'give-up':UI.giveUp=true;render();break;
    case 'stop-focus':UI.giveUp=false;breakFocus('gaveup');break;
    case 'pause':pauseFocus();break;
    case 'resume':resumeFocus();break;
    case 'ret-lock':answerReturn('lock');break;
    case 'ret-phone':answerReturn('phone');break;
    case 'ret-quit':answerReturn('quit');break;
    case 'sim-away':if(S.focus&&S.focus.mode==='focus'){S.focus.hiddenAt=Date.now()-(+el.dataset.v)*1000;checkReturn()}break;
    case 'to-urge':go('vontade');break;
    case 'done-task':
      if(S.focus){t=findTask(S.focus.taskId);if(t){setDone(t,true)}S.focus.taskId=''}
      save();render();break;
    case 'more-block':startFocus(25,{taskId:S.focus?S.focus.taskId:'',label:S.focus?S.focus.label:''});break;
    case 'start-break':S.focus={mode:'break',taskId:'',label:'Pausa',total:300,startTime:Date.now(),endTime:Date.now()+300000,starter:false};save();render();break;
    case 'skip-break':S.focus=null;save();render();break;
    case 'feel':startWait(el.dataset.v);break;
    case 'wait-pass':finishWait('resisted');break;
    case 'wait-gave':finishWait('gave');break;
    case 'wait-more':S.wait.phase='wait';S.wait.total=300;S.wait.end=Date.now()+300000;S.wait.ext=true;holdScreen();save();render();break;
    case 'do-two':
      var first=S.tasks.filter(function(x){return !x.done}).sort(function(a,b){return ((b.plan===today())-(a.plan===today()))||cmp(a,b)})[0];
      L().resisted++;logUrge(S.wait?S.wait.feel:'','redirect');S.wait=null;releaseLock();
      startFocus(2,{taskId:first?first.id:'',starter:true,label:'Só 2 minutos'});break;
    case 'wait-back':S.wait=null;save();go('foco');break;
    /* agenda */
    case 'ag-view':UI.agView=el.dataset.v;render();break;
    case 'day-prev':UI.agDay=addDays(UI.agDay||today(),-1);render();break;
    case 'day-next':UI.agDay=addDays(UI.agDay||today(),1);render();break;
    case 'day-today':UI.agDay=null;render();break;
    case 'r-open':
      k=el.dataset.k||today();UI.open[k+'|'+el.dataset.r]=!UI.open[k+'|'+el.dataset.r];
      if(S.tab==='hoje'&&el.textContent.indexOf('Abrir rotina')>-1)UI.open[k+'|'+el.dataset.r]=true;
      render();break;
    case 'step':
      k=el.dataset.k;var rk=k+'|'+el.dataset.r,arr=S.rdone[rk]||[],ix=arr.indexOf(el.dataset.s);
      if(ix>-1)arr.splice(ix,1);else arr.push(el.dataset.s);
      S.rdone[rk]=arr;save();render();break;
    case 'auto-plan':
    case 'auto-plan-k':plannerSheet(a==='auto-plan'?today():(UI.agDay||today()));break;
    case 'block-new':blockSheet(UI.agDay||today());break;
    case 'block-save':
      var st=$('#bStart').value,en=$('#bEnd').value,tk=$('#bTask').value,tt=($('#bTitle').value||'').trim();
      if(!tt&&tk){var tobj=findTask(tk);if(tobj)tt=tobj.text}
      if(!tt){toast('Dê um nome ao bloco.');break}
      if(!st||!en||toMin(en)<=toMin(st)){toast('O fim precisa ser depois do início.');break}
      (S.blocks[SH.k]=S.blocks[SH.k]||[]).push({id:uid(),start:st,end:en,title:tt,taskId:tk||'',source:'local',extId:''});
      save();closeSheet();render();break;
    case 'block-del':
      k=el.dataset.k;var gone=(S.blocks[k]||[]).find(function(b){return b.id===id});if(gone&&gone.extId&&gone.source!=='gcal'){gcCfg().pendingDelete.push(gone.extId)}S.blocks[k]=(S.blocks[k]||[]).filter(function(b){return b.id!==id});save();render();break;
    case 'focus-block':
      k=el.dataset.k;var b=(S.blocks[k]||[]).find(function(x){return x.id===id});
      if(b){
        var s0=toMin(b.start),e0=toMin(b.end),nmn=nowMin(),dur=Math.max(5,e0-s0);
        if(k===today()&&nmn>=s0&&nmn<e0)dur=Math.max(5,e0-nmn);   /* evento em andamento: usa o que falta, sem teto de 60 min */
        var tk2=b.taskId?findTask(b.taskId):null;
        openRitual({mins:dur,kind:b.source==='gcal'?'parcial':'total',taskId:b.taskId||'',label:b.title,cat:(tk2&&tk2.cat)||'Sem categoria',src:'agenda',blockId:b.id,blockDay:k,ext:b.extId||'',gcal:b.source==='gcal'});
      }break;
    /* rotinas */
    case 'r-new':routineSheet('');break;
    case 'r-edit':routineSheet(id);break;
    case 'preset':
      var p=PRESETS[el.dataset.v];
      $('#rName').value=p.name;$('#rTime').value=p.time;$('#rDur').value=p.dur;SH.days=p.days.slice();$('#rDays').innerHTML=dayChips(SH.days);$('#rSteps').value=p.steps.join('\n');break;
    case 'sh-day':
      var di=+el.dataset.v,pos=SH.days.indexOf(di);if(pos>-1)SH.days.splice(pos,1);else SH.days.push(di);
      $('#rDays').innerHTML=dayChips(SH.days);break;
    case 'r-save':
      var nm=($('#rName').value||'').trim(),lines=($('#rSteps').value||'').split('\n').map(function(x){return x.trim()}).filter(Boolean);
      if(!nm){toast('Dê um nome à rotina.');break}
      if(!SH.days.length){toast('Escolha pelo menos um dia.');break}
      if(!lines.length){toast('Adicione pelo menos um passo.');break}
      var ro=SH.id?S.routines.find(function(x){return x.id===SH.id}):null;
      var old=ro?ro.steps:[];
      var steps=lines.map(function(tx){var m=old.find(function(s){return s.text===tx});return {id:m?m.id:uid(),text:tx}});
      var obj={id:ro?ro.id:uid(),name:nm,time:$('#rTime').value||'07:00',dur:Math.max(5,+$('#rDur').value||30),days:SH.days.slice(),steps:steps,created:ro?ro.created:today()};
      if(ro)S.routines[S.routines.indexOf(ro)]=obj;else S.routines.push(obj);
      save();closeSheet();render();break;
    case 'r-del':S.routines=S.routines.filter(function(x){return x.id!==id});save();closeSheet();render();break;
    /* revisão */
    case 'rev-view':UI.revView=el.dataset.v;render();break;
    /* jogo */
    case 'cat':S.draft.cat=el.dataset.v;save();render();break;
    case 'cat-new':var cn=(prompt('Nome da nova categoria:')||'').trim();if(cn){if(S.cats.indexOf(cn)<0)S.cats.push(cn);S.draft.cat=cn;save();render()}break;
    case 'cat-range':UI.catRange=+el.dataset.v;render();break;
    case 'col-view':UI.colView=el.dataset.v;render();break;
    case 'cup-info':var bd=S.cups.find(function(x){return x.id===id});if(bd)toast('Xícara '+cupMeta(bd.model).name+(bd.ok?' (inteira)':' (quebrada)')+': '+(bd.label||'bloco de foco')+(bd.cat&&bd.cat!=='Sem categoria'?' ['+bd.cat+']':'')+(bd.mins?', '+bd.mins+' min':'')+', '+fmtShort(bd.d));break;
    case 'weekly-toggle':S.weekly1=!S.weekly1;if(S.weekly1)S.goalStart=mondayOf(today());save();render();break;
    case 't-week':var wv=+el.dataset.v;S.testWeeks=wv===0?0:Math.max(0,(S.testWeeks||0)+wv);save();render();break;
    case 't-model':var mv=$('#tModel').value;S.forceModel=mv===''?null:+mv;save();toast(mv===''?'Modelo automático.':'Próximo modelo: '+cupMeta(+mv).name);break;
    case 't-unlock':S.unlocked=CUP_ASSETS.good.map(function(_,i){return i});save();render();break;
    case 't-lockall':S.unlocked=[];save();render();break;
    case 'test-toggle':S.testMode=!S.testMode;save();render();break;
    case 't-add':testAdd();save();render();break;
    case 't-rem':testRem();save();render();break;
    case 't-skip':testSkip();save();render();break;
    case 't-jump':testJump(+$('#tPhase').value);save();render();break;
    case 't-clear':testClear();save();render();break;
    case 't-win':simSession(addCup(true,null,true));save();render();break;
    case 't-fail':simSession(addCup(false,null,true));save();render();break;
    case 't-clearb':S.cups=S.cups.filter(function(b){return !b.sim});S.sessions=S.sessions.filter(function(s){return !s.sim});save();render();break;
    case 't-reset':if(confirm('Apagar todos os dados do Brewer neste navegador?')){resetState();save();render()}break;
  }
});
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'&&!$('#sheetBack').hidden&&!UI.asking){closeSheet();return}
  if(e.key==='Enter'&&e.target&&e.target.id==='fText'){e.preventDefault();var b=$('[data-act="task-save"]');if(b)b.click()}
});
document.addEventListener('change',function(e){
  var t=e.target;if(!t)return;
  if(t.id==='taskSel'){S.draft.taskId=t.value;S.draft.cat='';save();render();return}
  if(t.id==='fAwake'){S.keepAwake=t.checked;save();return}
  if(t.id==='durRange'){save();return}
  if(t.id==='gcMoodle'){gcCfg().moodleCals=t.value.split(',').map(function(x){return x.trim()}).filter(Boolean);save();toast('Calendários do Moodle salvos. Toque em Sincronizar.');return}
  if(t.id==='mdIcs'){mdFile(t);return}
  if(t.id==='gcPush'){gcCfg().push=t.checked;save();return}
  if(t.id==='gcExtra'){gcCfg().extraCals=t.value.split(',').map(function(x){return x.trim()}).filter(Boolean);save();toast('Calendários extras salvos. Toque em Sincronizar.');return}
  var f=t.dataset&&t.dataset.f;if(!f)return;
  var lg=L();
  if(f==='screenH'||f==='screenM'){
    var h=$('#fScreenH').value,m=$('#fScreenM').value;
    lg.screen=(h===''&&m==='')?null:Math.max(0,(+h||0)*60+(+m||0));lg.goal=currentGoal();
  }else if(f==='goalH'||f==='goalM'){
    S.goal=Math.max(30,(+$('#fGoalH').value||0)*60+(+$('#fGoalM').value||0));S.goalStart=mondayOf(today());S.testWeeks=0;
    if(lg.screen!=null)lg.goal=currentGoal();
  }else if(f==='win'){lg.win=t.value.trim()}
  else if(f==='next'){lg.next=t.value.trim()}
  save();var ss=$('#screenStatus');if(ss)ss.innerHTML=screenStatusHTML();updateTheme();
});

document.addEventListener('input',function(e){var t=e.target;if(t&&t.id==='durRange'){S.draft.mins=+t.value;updateDur()}});
render();
checkReturn();
