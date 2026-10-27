import { $, esc, pl, uid, today, parseKey, toMin, fromMin, nowMin, cap, fmtLong, fmtDur, ceil5, dueLabel, DAYL, DAYN, daysText, seg } from '../utils.js';
import { S, UI, SH, setSH, save, cmp, findTask, estStats, dayItems, routineRow, openSheet } from '../state.js';
import { gcalHint, gcalPanelHTML } from '../sync.js';

/* ---------- planejador local: sugestões (sem duração inventada, sem IA externa) ---------- */
export var DAY_START=8*60,DAY_END=21*60;
export function freeWindows(k,from){
  var cur=from!=null?from:DAY_START,end=DAY_END,out=[];
  var busy=dayItems(k).filter(function(i){return !i.allDay}).map(function(i){return [toMin(i.start),toMin(i.end)]}).sort(function(a,b){return a[0]-b[0]});
  busy.forEach(function(b){if(b[1]<=cur)return;if(b[0]>cur){var e=Math.min(b[0],end);if(e-cur>=15)out.push([cur,e])}cur=Math.max(cur,b[1])});
  if(end-cur>=15)out.push([cur,end]);
  return out;
}
export function dueDays(t,k){return t.due?Math.round((parseKey(t.due)-parseKey(k))/864e5):null}
export function taskScore(t,k){
  var s={1:30,2:20,3:10}[t.prio]||20,dd=dueDays(t,k);
  if(dd!==null)s+=dd<0?45:dd===0?40:dd===1?30:dd<=3?18:dd<=7?8:0;
  if(t.plan===k)s+=12;
  return s;
}
export function estNote(t){
  var st=estStats(t.cat);if(!t.est||!st||st.n<5)return '';
  var pct=Math.round((st.ratio-1)*100);
  return Math.abs(pct)>=10?'Você costuma levar cerca de '+Math.abs(pct)+'% '+(pct>0?'mais':'menos')+' que o estimado em tarefas desta categoria.':'';
}
export function suggestionsFor(k,fromMin){
  var from=(k===today())?Math.max(DAY_START,ceil5(fromMin!=null?fromMin:nowMin())):DAY_START;
  var wins=freeWindows(k,from),already=(S.blocks[k]||[]).map(function(b){return b.taskId}).filter(Boolean);
  var cand=S.tasks.filter(function(t){return !t.done&&already.indexOf(t.id)<0&&!UI.dismissed[k+'|'+t.id]}).sort(function(a,b){return taskScore(b,k)-taskScore(a,k)});
  var used={},out=[];
  wins.forEach(function(w){
    if(out.length>=4)return;
    var len=w[1]-w[0],top=cand.filter(function(t){return !used[t.id]})[0];
    var fit=cand.filter(function(t){return !used[t.id]&&t.est>0&&t.est<=len})[0];
    if(fit){
      used[fit.id]=1;
      var note=(top&&top!==fit&&top.est>len)?'A tarefa mais urgente, "'+top.text+'", tem estimativa de '+fmtDur(top.est)+' e a janela tem '+fmtDur(len)+'.':'';
      out.push({win:w,len:len,task:fit,fits:true,note:note});return;
    }
    if(!top)return;
    used[top.id]=1;out.push({win:w,len:len,task:top,fits:top.est>0?false:null,note:''});
  });
  return out;
}
export function placeSuggestion(k,s){
  var t=s.task,st=s.win[0];
  (S.blocks[k]=S.blocks[k]||[]).push({id:uid(),start:fromMin(st),end:fromMin(st+t.est),title:t.text,taskId:t.id,source:'local',extId:''});
  save();
}
export function plannerSheet(k){
  UI.sgDay=k;var list=suggestionsFor(k);UI.sg=list;
  var h='<p class="muted small">'+esc(cap(fmtLong(k)))+'</p>';
  if(!list.length)h+='<p class="lead" style="margin-top:12px">Não encontrei um horário livre com uma tarefa que caiba. Defina o tempo estimado das tarefas ou libere espaço na agenda.</p>';
  list.forEach(function(s,i){
    var t=s.task,pw={1:'alta',2:'média',3:'baixa'}[t.prio]||'média',dd=dueDays(t,k),meta=['prioridade '+pw];
    if(dd!==null)meta.push('prazo: '+dueLabel(t.due));
    meta.push(t.est?fmtDur(t.est)+' estimados':'sem estimativa');
    h+='<div class="icard"><p><b>Você tem '+fmtDur(s.len)+' livres às '+fromMin(s.win[0])+'.</b></p><p style="margin-top:6px">'+esc(t.text)+'</p><p class="muted small">'+esc(meta.join(', '))+'</p>';
    var nt=estNote(t);
    if(s.fits===true)h+='<p class="small" style="margin-top:8px">Uma tarefa importante cabe neste horário.</p>'+(s.note?'<p class="small muted">'+esc(s.note)+'</p>':'')+(nt?'<p class="small muted">'+esc(nt)+'</p>':'')+'<div class="row"><button class="btn small" data-act="sg-place" data-i="'+i+'">Colocar na agenda</button><button class="btn quiet small" data-act="sg-no" data-i="'+i+'">Agora não</button></div>';
    else if(s.fits===null)h+='<p class="small" style="margin-top:8px">Sem estimativa de tempo: o Brewer não sabe quanto isso leva.</p><div class="row"><button class="btn small" data-act="sg-edit" data-id="'+t.id+'">Definir tempo</button><button class="btn quiet small" data-act="sg-no" data-i="'+i+'">Agora não</button></div>';
    else h+='<p class="small" style="margin-top:8px">Essa é uma prioridade, mas a estimativa é de '+fmtDur(t.est)+' e a janela tem '+fmtDur(s.len)+'.</p><div class="row"><button class="btn quiet small" data-act="sg-edit" data-id="'+t.id+'">Editar tarefa</button><button class="btn quiet small" data-act="sg-no" data-i="'+i+'">Agora não</button></div>';
    h+='</div>';
  });
  var nfit=list.filter(function(s){return s.fits===true}).length;
  h+='<div class="stack">'+(nfit>1?'<button class="btn quiet block" data-act="sg-all">Colocar todas que cabem ('+nfit+')</button>':'')+'<button class="btn quiet block" data-act="sheet-close">Fechar</button></div>';
  openSheet('Sugestões para o dia',h);
}
export function nowSuggestion(){
  var list=suggestionsFor(today(),nowMin()),s=list[0];
  if(!s||s.win[0]>ceil5(nowMin())+4)return null;
  return s;
}
export function sugCardHTML(){
  if(UI.hideSug===today())return '';
  var s=nowSuggestion();if(!s||s.fits===false)return '';
  var t=s.task,pw={1:'alta',2:'média',3:'baixa'}[t.prio]||'média';
  var line=s.fits===true?'Uma tarefa de prioridade '+pw+' cabe aqui: <b>'+esc(t.text)+'</b> ('+fmtDur(t.est)+').':'Sugestão: <b>'+esc(t.text)+'</b>. Sem estimativa de tempo.';
  return '<div class="nudge"><h3>Você tem '+fmtDur(s.len)+' livres agora.</h3><p style="margin-top:4px">'+line+'</p><div class="row"><button class="btn small" data-act="sg-focus" data-id="'+t.id+'">Preparar café</button><button class="btn quiet small" data-act="sg-hide">Agora não</button></div></div>';
}

/* ---------- formulários de blocos e rotinas ---------- */
export function blockSheet(k){
  var st=(k===today())?Math.min(22*60,Math.ceil((nowMin()+5)/15)*15):9*60;
  var tasks=S.tasks.filter(function(t){return !t.done}).sort(cmp);
  setSH({kind:'block',k:k});
  openSheet('Novo bloco',
    '<label class="flabel" for="bTitle">Nome do bloco</label><input class="field" id="bTitle" maxlength="80" placeholder="Ex.: estudar inglês">'+
    '<div class="pair"><div><label class="flabel" for="bStart">Início</label><input class="field" id="bStart" type="time" value="'+fromMin(st)+'"></div><div><label class="flabel" for="bEnd">Fim</label><input class="field" id="bEnd" type="time" value="'+fromMin(Math.min(1439,st+45))+'"></div></div>'+
    '<label class="flabel" for="bTask">Ligar a uma tarefa (opcional)</label><select class="field" id="bTask"><option value="">Nenhuma</option>'+tasks.map(function(t){return '<option value="'+t.id+'">'+esc(t.text)+'</option>'}).join('')+'</select>'+
    '<div class="stack"><button class="btn block" data-act="block-save">Salvar</button><button class="btn quiet block" data-act="sheet-close">Cancelar</button></div>');
}
export var PRESETS={
  manha:{name:'Manhã',time:'07:00',dur:40,days:[1,2,3,4,5],steps:['Beber um copo de água','Arrumar a cama','Tomar café sem celular','Olhar a agenda e as 3 prioridades do dia']},
  noite:{name:'Noite',time:'22:00',dur:30,days:[0,1,2,3,4,5,6],steps:['Deixar o celular carregando longe da cama','Fazer a revisão do dia no Brewer','Separar o que vai usar amanhã','Desligar as telas 30 min antes de dormir']},
  estudo:{name:'Estudo',time:'19:00',dur:90,days:[1,2,3,4,5],steps:['Celular de tela para baixo','Escolher o que estudar','Bloco de foco de 45 min','Pausa de 5 min','Bloco de foco de 45 min']}
};
export function dayChips(sel){return DAYL.map(function(l,i){return '<button class="chip dayc" data-act="sh-day" data-v="'+i+'" aria-pressed="'+(sel.indexOf(i)>-1)+'" aria-label="'+DAYN[i]+'">'+l+'</button>'}).join('')}
export function routineSheet(id){
  var r=id?S.routines.find(function(x){return x.id===id}):null;
  var days=r?r.days.slice():[1,2,3,4,5];
  setSH({kind:'routine',id:id||'',days:days});
  openSheet(r?'Editar rotina':'Nova rotina',
    (r?'':'<p class="muted small">Comece por um modelo:</p><div class="presets"><button class="chip" data-act="preset" data-v="manha">Manhã</button><button class="chip" data-act="preset" data-v="noite">Noite</button><button class="chip" data-act="preset" data-v="estudo">Estudo</button></div>')+
    '<label class="flabel" for="rName">Nome</label><input class="field" id="rName" maxlength="40" value="'+esc(r?r.name:'')+'" placeholder="Ex.: Manhã">'+
    '<div class="pair"><div><label class="flabel" for="rTime">Horário</label><input class="field" id="rTime" type="time" value="'+(r?r.time:'07:00')+'"></div><div><label class="flabel" for="rDur">Duração (min)</label><input class="field" id="rDur" type="number" inputmode="numeric" min="5" max="480" value="'+(r?(r.dur||30):30)+'"></div></div>'+
    '<p class="flabel">Dias</p><div class="chips" id="rDays">'+dayChips(SH.days)+'</div>'+
    '<label class="flabel" for="rSteps">Passos (um por linha)</label><textarea class="field" id="rSteps" placeholder="Um passo por linha">'+esc(r?r.steps.map(function(s){return s.text}).join('\n'):'')+'</textarea>'+
    '<div class="stack"><button class="btn block" data-act="r-save">Salvar</button>'+(r?'<button class="btn quiet block danger" data-act="r-del" data-id="'+r.id+'">Excluir rotina</button>':'')+'<button class="btn quiet block" data-act="sheet-close">Cancelar</button></div>');
}

/* ---------- AGENDA ---------- */
export function renderAgenda(){
  var el=$('#tab-agenda');
  var head='<h1>Agenda</h1>'+seg('ag-view',UI.agView,[['dia','Dia'],['rotinas','Rotinas'],['gcal','Google Agenda']]);
  if(UI.agView==='gcal'){
    el.innerHTML=head+gcalPanelHTML();
    return;
  }
  if(UI.agView==='rotinas'){
    var list=S.routines.length?'<ul style="margin-top:22px">'+S.routines.map(function(r){
      return '<li class="rl"><div><b>'+esc(r.name)+'</b><p class="muted small">'+r.time+', '+(r.dur||30)+' min, '+daysText(r.days)+'</p><p class="muted small">'+pl(r.steps.length,'passo','passos')+'</p></div><button class="ghost" data-act="r-edit" data-id="'+r.id+'">Editar</button></li>';
    }).join('')+'</ul>':'<p class="lead" style="margin-top:22px">Rotinas são o que você repete: manhã, noite, estudo. Crie uma e ela aparece na agenda nos dias certos, com passos para marcar.</p>';
    el.innerHTML=head+list+'<div class="stack"><button class="btn block" data-act="r-new">Nova rotina</button></div>';
    return;
  }
  var k=UI.agDay||today(),isT=k===today(),nm=nowMin();
  var items=dayItems(k);
  var rows=items.map(function(i){
    var isNow=isT&&!i.allDay&&toMin(i.start)<=nm&&nm<toMin(i.end);
    var time=i.allDay?'<div class="tt">Dia<br><span class="muted">todo</span></div>':'<div class="tt">'+i.start+'<br><span class="muted">'+i.end+'</span></div>';
    if(i.kind==='rotina')return '<li class="tl'+(isNow?' now':'')+'">'+time+'<div>'+routineRow(i.r,k)+'</div></li>';
    var tk=i.taskId?findTask(i.taskId):null;
    return '<li class="tl'+(isNow?' now':'')+'">'+time+'<div><b>'+esc(i.title)+'</b>'+(i.source==='gcal'?'<span class="tag">Google</span>':'')+(tk&&tk.done?' <span class="muted small">(feita)</span>':'')+
      '<div class="acts">'+(i.allDay?'':'<button class="ghost" data-act="focus-block" data-k="'+k+'" data-id="'+i.id+'">Focar</button>')+(i.source==='gcal'?'':'<button class="x" data-act="block-del" data-k="'+k+'" data-id="'+i.id+'" aria-label="Remover '+esc(i.title)+'">&times;</button>')+'</div></div></li>';
  }).join('');
  var label=(isT?'Hoje, ':'')+fmtLong(k);
  var body=items.length?'<ul class="tlist" style="margin-top:18px;border-top:1px solid var(--line)">'+rows+'</ul>':'<p class="lead" style="margin-top:16px">Nada marcado para este dia. Toque em &ldquo;Montar meu dia&rdquo; para encaixar tarefas nos horários livres.</p>';
  el.innerHTML=head+
    '<div class="daynav"><button class="navb" data-act="day-prev" aria-label="Dia anterior">&lsaquo;</button><div class="daylabel">'+esc(cap(label))+'</div><button class="navb" data-act="day-next" aria-label="Próximo dia">&rsaquo;</button></div>'+
    (isT?'':'<p style="text-align:center;margin-top:6px"><button class="ghost" data-act="day-today">Voltar para hoje</button></p>')+
    body+gcalHint(k)+
    '<div class="stack"><button class="btn block" data-act="auto-plan-k">Montar meu dia</button><button class="btn quiet block" data-act="block-new">Novo bloco</button></div>';
}
