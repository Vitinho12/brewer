import { $, esc, today, addDays, toMin, nowMin, fmtHM, CHECK } from '../utils.js';
import { S, L, cmp, planned, dayItems, streakInfo, phaseIdx, PHASES, openSheet } from '../state.js';
import { suggestionsFor } from './agenda.js';
import { focusBuilderHTML } from './foco.js';
import { notifyPermission } from '../notifications.js';

/* ---------- HOJE (Compacto estilo Forest + Sugestão Inteligente Agenda/Moodle) ---------- */
export function greeting(){var h=new Date().getHours();return h<12?'Bom dia':h<18?'Boa tarde':'Boa noite'}

export function prioSheet(){
  var k=today(),pl3=planned(k);
  var rows=pl3.map(function(t){
    return '<li class="task'+(t.done?' done':'')+'"><button class="check" data-act="toggle-sh" data-id="'+t.id+'" aria-label="'+(t.done?'Desmarcar':'Marcar como feita')+': '+esc(t.text)+'">'+CHECK+'</button><span class="ttext">'+esc(t.text)+'</span>'+(t.done?'':'<button class="ghost" data-act="focus-task" data-id="'+t.id+'">Focar</button>')+'</li>';
  }).join('');
  var cands=pl3.length<3?S.tasks.filter(function(t){return !t.done&&t.plan!==k}).sort(cmp).slice(0,6):[];
  var pickHTML=pl3.length<3
    ?'<p class="flabel" style="margin-top:16px">Adicionar para hoje ('+pl3.length+'/3)</p>'+
      (cands.length?'<ul class="tasks">'+cands.map(function(t){return '<li class="task"><span class="ttext">'+esc(t.text)+(t.kind==='faculdade'?' <span class="tag">Projeto</span>':'')+'</span><button class="ghost" data-act="plan-sh" data-id="'+t.id+'">+ Hoje</button></li>'}).join('')+'</ul>':'<p class="muted small" style="margin-top:6px">Nenhuma tarefa pendente na fila.</p>')+
      '<div class="row" style="margin-top:12px"><button class="btn quiet small" data-act="task-new-today">+ Criar nova tarefa</button></div>'
    :'';
  openSheet('Suas 3 de hoje',
    (pl3.length?'<ul class="tasks">'+rows+'</ul>':'<p class="muted small">Escolha até 3 prioridades para focar hoje.</p>')+
    pickHTML+
    '<div class="stack" style="margin-top:18px"><button class="btn block" data-act="sheet-close">Fechar</button></div>'
  );
}

export function compactHeaderHTML(lg){
  var s=streakInfo(),i=phaseIdx(s.n),p=PHASES[i];
  var totalCups=S.cups.filter(function(c){return c.ok}).length;
  var notifPill = notifyPermission()==='default' ? '<button class="phase-badge sm" data-act="notify-enable" aria-label="Ativar notificações">🔔 Alertas</button>' : '';
  return '<div class="hoje-top">'+
    '<div>'+
      '<div class="mark"><svg width="20" height="18" viewBox="0 0 24 22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 8h13v5a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6V8z"/><path d="M16 10h2.5a2.5 2.5 0 0 1 0 5H16"/><path d="M7 2c-1 1.4 1 2.6 0 4M11 2c-1 1.4 1 2.6 0 4"/></svg>Brewer</div>'+
      '<p class="small muted" style="margin-top:2px">'+greeting()+' · <b>'+fmtHM(lg.focus)+'</b> hoje</p>'+
    '</div>'+
    '<div class="top-pills">'+
      notifPill+
      '<button class="phase-badge sm" data-act="tab" data-tab="colecao" aria-label="Abrir prateleira de xícaras">☕ '+totalCups+'</button>'+
      '<button class="phase-badge sm" data-act="tab" data-tab="jornada">'+esc(p.name)+' · '+s.n+'d &rsaquo;</button>'+
    '</div>'+
  '</div>';
}

export function smartBannerHTML(k,cur,nxt,pl3,hr,reviewDone){
  var done3=pl3.filter(function(t){return t.done}).length;
  var pBtn='<button class="btn quiet small" data-act="prio-sheet">Suas 3 ('+done3+'/'+pl3.length+')</button>';

  /* À noite (a partir das 20h): se a revisão ainda não foi feita, o card inteligente vira o convite da Revisão */
  if(hr>=20 && !reviewDone){
    return '<div class="smart-card smart-review">'+
      '<div class="smart-info"><span class="smart-eyebrow">🌙 Revisão do Dia</span><b>Registrar tempo de tela e vitórias</b></div>'+
      '<div class="smart-acts"><button class="btn sun small" data-act="tab" data-tab="revisao">Revisar agora</button>'+pBtn+'</div>'+
    '</div>';
  }

  /* Compromisso em andamento ou a seguir na agenda */
  var focusItem=cur||nxt;
  if(focusItem){
    var when=cur?'Agora na agenda (até '+cur.end+')':'A seguir na agenda ('+nxt.start+')';
    var act=focusItem.kind==='bloco'
      ?'<button class="btn small" data-act="focus-block" data-k="'+k+'" data-id="'+focusItem.id+'">Focar agora</button>'
      :'<button class="btn small" data-act="tab" data-tab="agenda">Ver rotina</button>';
    return '<div class="smart-card">'+
      '<div class="smart-info"><span class="smart-eyebrow">📅 '+when+'</span><b>'+esc(focusItem.title)+'</b></div>'+
      '<div class="smart-acts">'+act+pBtn+'</div>'+
    '</div>';
  }
  /* Motor inteligente: cruza janelas livres da Agenda com tarefas pendentes */
  var sugs=suggestionsFor(k).filter(function(x){return x.fits===true});
  if(sugs.length){
    var s0=sugs[0];
    return '<div class="smart-card">'+
      '<div class="smart-info"><span class="smart-eyebrow">💡 Janela livre ('+s0.start+'–'+s0.end+')</span><b>Adiantar: '+esc(s0.task.text)+'</b></div>'+
      '<div class="smart-acts"><button class="btn small" data-act="sg-focus" data-id="'+s0.task.id+'" data-dur="'+s0.dur+'">Focar ('+s0.dur+'m)</button><button class="btn quiet small" data-act="auto-plan">Agenda</button>'+pBtn+'</div>'+
    '</div>';
  }
  /* 4. Prioridade do dia (Suas 3 de hoje) pendente */
  var nextPrio=pl3.find(function(t){return !t.done});
  if(nextPrio){
    return '<div class="smart-card">'+
      '<div class="smart-info"><span class="smart-eyebrow">🎯 Prioridade de hoje</span><b>'+esc(nextPrio.text)+'</b></div>'+
      '<div class="smart-acts"><button class="btn small" data-act="sg-focus" data-id="'+nextPrio.id+'" data-dur="25">Focar agora</button>'+pBtn+'</div>'+
    '</div>';
  }

  /* 5. Se ainda não escolheu as 3 de hoje: sugere a tarefa mais prioritária da lista geral */
  var anyPending = S.tasks.filter(function(t){ return !t.done }).sort(cmp)[0];
  if(anyPending){
    var tag = (anyPending.kind === 'faculdade' || anyPending.kind === 'projeto') ? 'Projeto' : (anyPending.cat || 'Tarefa');
    return '<div class="smart-card">'+
      '<div class="smart-info"><span class="smart-eyebrow">🎯 Próximo Foco · '+esc(tag)+'</span><b>'+esc(anyPending.text)+'</b></div>'+
      '<div class="smart-acts"><button class="btn small" data-act="sg-focus" data-id="'+anyPending.id+'" data-dur="25">Focar agora</button>'+pBtn+'</div>'+
    '</div>';
  }

  /* 6. Fallback final quando não há nenhuma tarefa pendente no app */
  return '<div class="smart-card">'+
    '<div class="smart-info"><span class="smart-eyebrow">☕ Hora do Café</span><b>Pronto para um bloco de foco livre de 25m?</b></div>'+
    '<div class="smart-acts"><button class="btn small" data-act="start-focus">Preparar café</button>'+pBtn+'</div>'+
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

  var reviewDone=lg.screen!==null||lg.win||lg.next;
  var yline=(yest&&!lg.focus&&hr<20)?'<div class="nudge-bar"><span class="small">Meta de ontem p/ começar hoje: <b>'+esc(yest)+'</b></span></div>':'';

  $('#tab-hoje').innerHTML=
    compactHeaderHTML(lg)+
    yline+
    smartBannerHTML(k,cur,nxt,pl3,hr,reviewDone)+
    focusBuilderHTML(true);
}
