import { $, esc, pl, today, addDays, parseKey, toMin, nowMin, fmtHM, CHECK } from '../utils.js';
import { S, UI, L, cmp, planned, dayItems, routineRow, streakInfo, phaseIdx, PHASES, cupCard } from '../state.js';
import { sugCardHTML } from './agenda.js';
import { focusBuilderHTML, renderPreHTML, activeFocusHTML } from './foco.js';

/* ---------- HOJE (Compacto estilo Forest, sem rolagem longa) ---------- */
export function greeting(){var h=new Date().getHours();return h<12?'Bom dia':h<18?'Boa tarde':'Boa noite'}

export function compactHeaderHTML(lg){
  var s=streakInfo(),i=phaseIdx(s.n),p=PHASES[i];
  return '<div class="hoje-top">'+
    '<div>'+
      '<div class="mark"><svg width="20" height="18" viewBox="0 0 24 22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 8h13v5a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6V8z"/><path d="M16 10h2.5a2.5 2.5 0 0 1 0 5H16"/><path d="M7 2c-1 1.4 1 2.6 0 4M11 2c-1 1.4 1 2.6 0 4"/></svg>Brewer</div>'+
      '<p class="small muted" style="margin-top:2px">'+greeting()+' · <b>'+fmtHM(lg.focus)+'</b> focado hoje</p>'+
    '</div>'+
    '<button class="phase-badge sm" data-act="tab" data-tab="jornada">'+esc(p.name)+' · '+s.n+'d &rsaquo;</button>'+
  '</div>';
}

export function renderHoje(){
  var k=today(),nm=nowMin(),hr=new Date().getHours();
  var items=dayItems(k).filter(function(i){return !i.allDay});
  var cur=items.find(function(i){return toMin(i.start)<=nm&&nm<toMin(i.end)});
  var nxt=items.find(function(i){return toMin(i.start)>nm});
  var pl3=planned(k);
  var yest=L(addDays(k,-1)).next;
  var lg=L(k);

  /* Estação de foco compacta estilo Forest no topo */
  var topFocus='';
  if(S.focus){
    topFocus='<div class="forest-card">'+activeFocusHTML()+'</div>';
  }else if(UI.pre){
    topFocus='<div class="forest-card">'+renderPreHTML()+'</div>';
  }else{
    topFocus=focusBuilderHTML(true);
  }

  /* Avisos compactos de 1 linha (Revisão noturna / Combinado de ontem) */
  var reviewDone=lg.screen!==null||lg.win||lg.next;
  var nudge=(hr>=20&&!reviewDone)?'<div class="nudge-bar"><span>🌙 <b>Hora da revisão do dia</b></span><button class="btn sun small" data-act="tab" data-tab="revisao">Revisar</button></div>':'';
  var yline=(yest&&!lg.focus)?'<div class="nudge-bar"><span class="small">Ontem você combinou começar por: <b>'+esc(yest)+'</b></span></div>':'';

  /* Gaveta inferior compacta com abas rápidas para não precisar scrollar a tela inteira */
  var sub=UI.homeSub||'prio';
  var done3=pl3.filter(function(t){return t.done}).length;
  var todayCups=S.cups.filter(function(c){return c.d===k&&c.ok}).length;

  var subTabs='<div class="seg home-seg" role="tablist" aria-label="Resumo do dia">'+
    '<button data-act="home-sub" data-v="prio" aria-pressed="'+(sub==='prio')+'">Suas 3 ('+done3+'/'+pl3.length+')</button>'+
    '<button data-act="home-sub" data-v="ag" aria-pressed="'+(sub==='ag')+'">Agenda</button>'+
    '<button data-act="home-sub" data-v="col" aria-pressed="'+(sub==='col')+'">Xícaras ('+todayCups+')</button>'+
  '</div>';

  var subBody='';
  if(sub==='prio'){
    var rows=pl3.map(function(t){
      return '<li class="task'+(t.done?' done':'')+'"><button class="check" data-act="toggle" data-id="'+t.id+'" aria-label="'+(t.done?'Desmarcar':'Marcar como feita')+': '+esc(t.text)+'">'+CHECK+'</button><span class="ttext">'+esc(t.text)+'</span>'+(t.done?'':'<button class="ghost" data-act="focus-task" data-id="'+t.id+'">Focar</button>')+'</li>';
    }).join('');
    var pickList='';
    if(UI.pick){
      var cands=S.tasks.filter(function(t){return !t.done&&t.plan!==k}).sort(cmp);
      pickList='<ul class="tasks">'+(cands.length?cands.map(function(t){return '<li class="task"><span class="ttext">'+esc(t.text)+'</span><button class="ghost" data-act="plan" data-id="'+t.id+'">Pôr em hoje</button></li>'}).join(''):'<li class="muted small" style="padding:10px 0">Nenhuma tarefa na lista.</li>')+'</ul>';
    }
    var addBtns=pl3.length<3?'<div class="row" style="margin-top:10px"><button class="btn quiet small" data-act="task-new-today">+ Nova</button><button class="btn quiet small" data-act="pick">'+(UI.pick?'Fechar':'Escolher da lista')+'</button></div>'+pickList:'';
    subBody='<div class="home-panel">'+(pl3.length?'<ul class="tasks">'+rows+'</ul>':'<p class="muted small">Escolha até 3 prioridades para hoje.</p>')+addBtns+'</div>';
  }else if(sub==='ag'){
    var focusItem=cur||nxt;
    var nowHTML='';
    if(focusItem){
      var when=cur?'Agora, até '+cur.end:'A seguir, às '+nxt.start;
      var act=focusItem.kind==='bloco'
        ?'<button class="btn small" data-act="focus-block" data-k="'+k+'" data-id="'+focusItem.id+'">Focar</button>'
        :'<button class="btn small" data-act="r-open" data-k="'+k+'" data-r="'+focusItem.id+'">Abrir</button>';
      nowHTML='<div class="home-ag-row"><div><b>'+esc(focusItem.title)+'</b><p class="muted small">'+when+'</p></div>'+act+'</div>';
    }else{
      nowHTML='<div class="home-ag-row"><div><b>Agenda livre</b><p class="muted small">Quer encaixar tarefas nos horários livres?</p></div><button class="btn small" data-act="auto-plan">Montar dia</button></div>';
    }
    var wd=parseKey(k).getDay();
    var todays=S.routines.filter(function(r){return r.days.indexOf(wd)>-1});
    var rHTML=todays.length?'<ul style="margin-top:8px;border-top:1px solid var(--line);padding-top:6px">'+todays.map(function(r){return '<li style="padding:2px 0">'+routineRow(r,k)+'</li>'}).join('')+'</ul>':'';
    subBody='<div class="home-panel">'+nowHTML+sugCardHTML()+rHTML+'</div>';
  }else{
    subBody='<div class="home-panel">'+cupCard()+'</div>';
  }

  $('#tab-hoje').innerHTML=
    compactHeaderHTML(lg)+
    nudge+yline+
    topFocus+
    subTabs+subBody;
}
