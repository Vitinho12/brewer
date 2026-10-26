import { $, esc, pl, today, addDays, parseKey, toMin, nowMin, cap, fmtLong, fmtHM, CHECK } from '../utils.js';
import { S, UI, L, cmp, planned, dayItems, routineRow, phaseBadge, cupCard } from '../state.js';
import { sugCardHTML } from './agenda.js';
import { focusBuilderHTML, renderPreHTML, activeFocusHTML } from './foco.js';

/* ---------- HOJE (Com Estação de Foco estilo Forest no topo) ---------- */
export function greeting(){var h=new Date().getHours();return h<12?'Bom dia':h<18?'Boa tarde':'Boa noite'}

export function renderHoje(){
  var k=today(),nm=nowMin(),hr=new Date().getHours();
  var items=dayItems(k).filter(function(i){return !i.allDay});
  var cur=items.find(function(i){return toMin(i.start)<=nm&&nm<toMin(i.end)});
  var nxt=items.find(function(i){return toMin(i.start)>nm});
  var pl3=planned(k);
  var yest=L(addDays(k,-1)).next;

  /* Se houver ritual ou foco ativo no momento, destaca no topo do Hoje */
  var topFocus='';
  if(S.focus){
    topFocus='<div class="forest-card">'+activeFocusHTML()+'</div>';
  }else if(UI.pre){
    topFocus='<div class="forest-card">'+renderPreHTML()+'</div>';
  }else{
    topFocus=focusBuilderHTML(true);
  }

  var now='';
  var focusItem=cur||nxt;
  if(focusItem){
    var when=cur?'Agora na agenda, até '+cur.end:'A seguir na agenda, às '+nxt.start;
    var act=focusItem.kind==='bloco'
      ?'<div class="row"><button class="btn small" data-act="focus-block" data-k="'+k+'" data-id="'+focusItem.id+'">Focar neste compromisso</button></div>'
      :'<div class="row"><button class="btn small" data-act="r-open" data-k="'+k+'" data-r="'+focusItem.id+'">Abrir rotina</button></div>';
    now='<div class="now-block"><h2>'+esc(focusItem.title)+'</h2><p class="muted">'+when+'</p>'+act+'</div>';
  }else{
    now='<div class="now-block"><h2>Agenda livre</h2><p class="muted">Nada marcado para o resto do dia. Quer ver sugestões do que cabe nos horários livres?</p><div class="row"><button class="btn small" data-act="auto-plan">Montar meu dia</button></div></div>';
  }

  var rows=pl3.map(function(t){
    return '<li class="task'+(t.done?' done':'')+'"><button class="check" data-act="toggle" data-id="'+t.id+'" aria-label="'+(t.done?'Desmarcar':'Marcar como feita')+': '+esc(t.text)+'">'+CHECK+'</button><span class="ttext">'+esc(t.text)+'</span>'+(t.done?'':'<button class="ghost" data-act="focus-task" data-id="'+t.id+'">Focar</button>')+'</li>';
  }).join('');
  var pickList='';
  if(UI.pick){
    var cands=S.tasks.filter(function(t){return !t.done&&t.plan!==k}).sort(cmp);
    pickList='<ul class="tasks">'+(cands.length?cands.map(function(t){return '<li class="task"><span class="ttext">'+esc(t.text)+'</span><button class="ghost" data-act="plan" data-id="'+t.id+'">Pôr em hoje</button></li>'}).join(''):'<li class="muted" style="padding:12px 0">Nenhuma tarefa na lista. Crie uma nova.</li>')+'</ul>';
  }
  var addBtns=pl3.length<3?'<div class="row"><button class="btn quiet small" data-act="task-new-today">Nova tarefa</button><button class="btn quiet small" data-act="pick">'+(UI.pick?'Fechar lista':'Escolher da lista')+'</button></div>'+pickList:'';
  var prio='<div class="sec"><h2>Suas 3 de hoje</h2>'+(pl3.length?'<ul class="tasks" style="margin-top:12px">'+rows+'</ul>':'<p class="lead">Escolha até 3 coisas. O resto pode esperar.</p>')+addBtns+'</div>';

  var wd=parseKey(k).getDay();
  var todays=S.routines.filter(function(r){return r.days.indexOf(wd)>-1});
  var routines=todays.length?'<div class="sec"><h2>Rotinas de hoje</h2><ul>'+todays.map(function(r){return '<li style="border-bottom:1px solid var(--line);padding:4px 0">'+routineRow(r,k)+'</li>'}).join('')+'</ul></div>':'';

  var lg=L(k);
  var stats='<p>'+fmtHM(lg.focus)+' de foco e '+pl(lg.resisted,'vontade que passou','vontades que passaram')+'.</p>';
  if(lg.gave)stats+='<p class="muted">Você cedeu '+pl(lg.gave,'vez','vezes')+'. Sem drama: o que conta é voltar.</p>';

  var reviewDone=lg.screen!==null||lg.win||lg.next;
  var nudge=(hr>=20&&!reviewDone)?'<div class="nudge"><h3>Hora da revisão do dia</h3><p class="muted" style="margin-top:4px">Dois minutos: tempo de tela, uma vitória e por onde começar amanhã.</p><div class="row"><button class="btn sun small" data-act="tab" data-tab="revisao">Fazer revisão</button></div></div>':'';
  var yline=yest?'<div class="nudge"><p class="muted small">Ontem você combinou começar por:</p><p style="margin-top:4px"><b>'+esc(yest)+'</b></p></div>':'';

  $('#tab-hoje').innerHTML=
    '<div class="mark"><svg width="24" height="22" viewBox="0 0 24 22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 8h13v5a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6V8z"/><path d="M16 10h2.5a2.5 2.5 0 0 1 0 5H16"/><path d="M7 2c-1 1.4 1 2.6 0 4M11 2c-1 1.4 1 2.6 0 4"/></svg>Brewer</div>'+
    phaseBadge()+'<h1>'+greeting()+'.</h1><p class="lead">'+cap(fmtLong(k))+'</p>'+
    topFocus+
    yline+nudge+sugCardHTML()+prio+now+routines+cupCard()+
    '<div class="sec"><h2>Hoje até agora</h2><div style="margin-top:8px">'+stats+'</div></div>';
}
