import { $, esc, key, today, fmtShort, fmtHM, dueLabel, stripAcc, CHECK, STAR, MIC, seg } from '../utils.js';
import { S, UI, SH, setSH, cmp, findTask, subjects, toast, openSheet } from '../state.js';
import { moodlePanelHTML } from '../sync.js';

/* ---------- TAREFAS: pessoais e faculdade ---------- */
export var GN=['Atrasadas','Para hoje','Próximas','Sem prazo'];
export function groupOf(t,k){if(t.due&&t.due<k)return 0;if(t.plan===k||t.due===k)return 1;if(t.due)return 2;return 3}
export function taskRow(t,k){
  var meta=[];
  if(t.kind==='faculdade'&&t.subject)meta.push(t.subject);
  if(t.prio===1)meta.push('Prioridade alta');
  if(t.due)meta.push('Prazo: '+dueLabel(t.due)+(t.dueTime?' às '+t.dueTime:''));
  if(t.est)meta.push(fmtHM(t.est)+' estimados');
  if(t.spent)meta.push(t.spent+' min de foco');
  if(t.done&&t.doneAt)meta.push('Concluída em '+fmtShort(t.doneAt));
  if(t.done&&t.est&&t.spent)meta.push('estimado '+fmtHM(t.est)+', real '+fmtHM(t.spent));
  return '<li class="task'+(t.done?' done':'')+'"><button class="check" data-act="toggle" data-id="'+t.id+'" aria-label="'+(t.done?'Desmarcar':'Marcar como feita')+': '+esc(t.text)+'">'+CHECK+'</button>'+
    '<button class="ttext" data-act="task-edit" data-id="'+t.id+'">'+esc(t.text)+(meta.length?'<small class="muted">'+esc(meta.join(', '))+'</small>':'')+'</button>'+
    (t.done?'':'<button class="star" data-act="plan" data-id="'+t.id+'" aria-pressed="'+(t.plan===k)+'" aria-label="'+(t.plan===k?'Tirar de hoje':'Fazer hoje')+': '+esc(t.text)+'">'+STAR+'</button>')+'</li>';
}
export function pendingList(kind,k){
  var openT=S.tasks.filter(function(t){return !t.done&&t.kind===kind}).sort(cmp);
  if(!openT.length)return '';
  var groups=[[],[],[],[]],html='';
  openT.forEach(function(t){groups[groupOf(t,k)].push(t)});
  groups.forEach(function(g,i){if(g.length)html+='<p class="gtitle">'+GN[i]+'</p><ul class="tasks">'+g.map(function(t){return taskRow(t,k)}).join('')+'</ul>'});
  return html;
}
export function doneList(kind,k){
  var d=S.tasks.filter(function(t){return t.done&&t.kind===kind}).sort(function(a,b){return (b.doneTs||0)-(a.doneTs||0)});
  return d.length?'<ul class="tasks" style="margin-top:18px">'+d.map(function(t){return taskRow(t,k)}).join('')+'</ul>':'';
}
export function inboxSort(a,b){var x=a.due||'9999',y=b.due||'9999';return x<y?-1:x>y?1:0}
export function inboxCard(it){
  var meta=[];if(it.subject)meta.push(esc(it.subject));
  meta.push(it.due?'Entrega: '+fmtShort(it.due)+' ('+dueLabel(it.due)+')'+(it.dueTime?' às '+it.dueTime:''):'Sem prazo');
  if(it.est)meta.push(fmtHM(it.est)+' estimados');
  if(it.prio===1)meta.push('prioridade alta');
  if(it.gone)meta.push('não apareceu na última sincronização');
  return '<div class="icard"><b>'+esc(it.title)+'</b><p class="muted small" style="margin-top:2px">'+meta.join(', ')+'</p><div class="row" style="margin-top:12px"><button class="btn small" data-act="ib-confirm" data-id="'+it.id+'">Confirmar</button><button class="btn quiet small" data-act="ib-edit" data-id="'+it.id+'">Editar</button><button class="btn quiet small" data-act="ib-ignore" data-id="'+it.id+'">Ignorar</button></div></div>';
}
export function ignoredHTML(){
  var seen={},list=[];
  Object.keys(S.moodle.ignored).forEach(function(k){var it=S.moodle.ignored[k].item;if(it&&!seen[it.id]){seen[it.id]=1;list.push(it)}});
  if(!list.length)return '';
  var h='<div class="row"><button class="ghost small" data-act="ib-ign-toggle">'+(UI.showIgn?'Esconder ignoradas':'Ver ignoradas ('+list.length+')')+'</button></div>';
  if(UI.showIgn)h+=list.map(function(it){return '<div class="icard"><b>'+esc(it.title)+'</b><p class="muted small" style="margin-top:2px">'+(it.subject?esc(it.subject)+', ':'')+(it.due?'Entrega: '+fmtShort(it.due):'Sem prazo')+'</p><div class="row" style="margin-top:12px"><button class="btn quiet small" data-act="ib-restore" data-id="'+esc(it.id)+'">Restaurar em Entrada</button></div></div>'}).join('');
  return h;
}
export function renderTarefas(){
  var k=today(),kind=UI.tkKind,sub=kind==='pessoal'?UI.tkP:UI.tkF,body='';
  var s1=seg('tk-kind',kind,[['pessoal','Pessoais'],['faculdade','Projetos']]);
  var s2=(kind==='pessoal'?seg('tk-sub',sub,[['pend','Pendentes'],['done','Concluídas']]):seg('tk-sub',sub,[['new','Entrada'+(S.inbox.length?' ('+S.inbox.length+')':'')],['pend','Pendentes'],['done','Concluídas']])).replace('class="seg"','class="seg" style="margin-top:10px"');
  if(sub==='new'){
    body=moodlePanelHTML()+(S.inbox.length?S.inbox.slice().sort(inboxSort).map(inboxCard).join(''):'<p class="lead" style="margin-top:18px">Nenhuma atividade na Entrada. Importe da Agenda ou envie arquivos para ver o que chegou; nada vira tarefa sem a sua confirmação.</p>')+ignoredHTML();
  }else if(sub==='pend'){
    var l=pendingList(kind,k);
    body='<div class="row"><button class="btn small" data-act="task-new">Nova tarefa</button></div>'+(l||'<p class="lead" style="margin-top:22px">'+(kind==='pessoal'?'Nenhuma tarefa aberta. Anote o que está na sua cabeça, assim ela para de ocupar espaço lá.':'Nenhuma tarefa pendente neste projeto. Confirme atividades em Entrada ou crie uma aqui.')+'</p>');
  }else{
    body=doneList(kind,k)||'<p class="lead" style="margin-top:22px">Nenhuma tarefa concluída ainda.</p>';
  }
  $('#tab-tarefas').innerHTML='<h1>Tarefas</h1><p class="lead">Toque na estrela para pôr uma tarefa nas suas 3 de hoje.</p>'+s1+s2+body;
}

/* ---------- formulários de tarefas e voz ---------- */
export function prioChips(cur){return [[1,'Alta'],[2,'Média'],[3,'Baixa']].map(function(p){return '<button class="chip" data-act="sh-prio" data-v="'+p[0]+'" aria-pressed="'+(cur===p[0])+'">'+p[1]+'</button>'}).join('')}
var NUMW={um:1,uma:1,dois:2,duas:2,tres:3,quatro:4,cinco:5,seis:6,sete:7,oito:8,nove:9,dez:10,onze:11,doze:12};
var NUMR='\\d+|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze';
var WDAYS={domingo:0,segunda:1,terca:2,quarta:3,quinta:4,sexta:5,sabado:6};
var MONTHS=['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
function nv(s){s=String(s||'').trim();return /^\d+$/.test(s)?+s:(NUMW[s]!=null?NUMW[s]:0)}
/* interpreta uma frase em português e devolve só o que reconheceu (nada é salvo aqui) */
export function parseTaskPhrase(raw){
  var orig=String(raw||'').trim(),n=stripAcc(orig).toLowerCase();
  if(n.length!==orig.length)orig=n;
  var w=n,spans=[],out={title:'',due:'',prio:0,est:0,subject:''},m;
  var take=function(re){var x=re.exec(w);if(!x)return null;spans.push([x.index,x.index+x[0].length]);w=w.slice(0,x.index)+new Array(x[0].length+1).join(' ')+w.slice(x.index+x[0].length);return x};
  if((m=take(/(?:com\s+)?prioridade\s+(alta|media|baixa|urgente|maxima|minima)\b/)))out.prio={alta:1,urgente:1,maxima:1,media:2,baixa:3,minima:3}[m[1]];
  else if(take(/\burgente\b/))out.prio=1;
  var lead='(?:(?:acho que|talvez|deve|vai|vou)\\s+)*(?:levar|leva|demorar|demora|durar|dura|precisar de|preciso de|tempo estimado(?: de)?|estimativa(?: de)?)\\s*(?:uns|umas|cerca de|mais ou menos|em torno de|aproximadamente)?\\s*';
  var pats=[
    ['(\\d+)\\s*h\\s*(\\d{1,2})\\b',function(x){return +x[1]*60+ +x[2]},true],
    ['('+NUMR+')\\s*horas?\\s*e\\s*meia',function(x){return nv(x[1])*60+30},false],
    ['meia\\s*hora',function(){return 30},false],
    ['('+NUMR+')\\s*horas?(?:\\s*e\\s*('+NUMR+')\\s*min(?:utos?)?)?',function(x){return nv(x[1])*60+(x[2]?nv(x[2]):0)},false],
    ['(\\d+)\\s*h\\b',function(x){return +x[1]*60},true],
    ['quarenta\\s*e\\s*cinco\\s*min(?:utos?)?',function(){return 45},false],
    ['(\\d+|quinze|vinte|trinta|quarenta)\\s*min(?:utos?)?',function(x){return {quinze:15,vinte:20,trinta:30,quarenta:40}[x[1]]||+x[1]},false]
  ];
  for(var i=0;i<pats.length&&!out.est;i++){
    var re=new RegExp((pats[i][2]?'(?:'+lead+')':'(?:'+lead+')?')+pats[i][0]);
    if((m=re.exec(w))){out.est=pats[i][1](m);take(re)}
  }
  var dl='(?:(?:para|pra|ate|entregar|entrega|entregue|prazo(?:\\s+e|\\s+de)?|vence|vencimento|na|no|em)\\s+)?';
  var t0=new Date();t0.setHours(0,0,0,0);
  var addD=function(k){var d=new Date(t0);d.setDate(d.getDate()+k);return key(d)};
  if(take(new RegExp(dl+'depois\\s+de\\s+amanha\\b')))out.due=addD(2);
  else if(take(new RegExp(dl+'amanha\\b')))out.due=addD(1);
  else if(take(new RegExp(dl+'hoje\\b')))out.due=addD(0);
  else if((m=take(new RegExp(dl+'(?:proxim[ao]\\s+)?(segunda|terca|quarta|quinta|sexta|sabado|domingo)(?:\\s*-?\\s*feira)?\\b'))))out.due=addD((WDAYS[m[1]]-t0.getDay()+7)%7||7);
  else if((m=take(new RegExp(dl+'(?:dia\\s+)?(\\d{1,2})\\s*/\\s*(\\d{1,2})(?:\\s*/\\s*(\\d{2,4}))?\\b')))){
    var y=m[3]?(+m[3]<100?2000+ +m[3]:+m[3]):t0.getFullYear(),d1=new Date(y,+m[2]-1,+m[1]);
    if(!m[3]&&(t0-d1)>60*864e5)d1.setFullYear(y+1);
    if(d1.getDate()===+m[1])out.due=key(d1);
  }else if((m=take(new RegExp(dl+'dia\\s+(\\d{1,2})(?:\\s+de\\s+('+MONTHS.join('|')+'))?\\b')))){
    var d2;
    if(m[2]){d2=new Date(t0.getFullYear(),MONTHS.indexOf(m[2]),+m[1]);if((t0-d2)>60*864e5)d2.setFullYear(d2.getFullYear()+1)}
    else{d2=new Date(t0.getFullYear(),t0.getMonth(),+m[1]);if(d2<t0)d2.setMonth(d2.getMonth()+1)}
    if(d2.getDate()===+m[1])out.due=key(d2);
  }
  subjects().sort(function(a,b){return b.length-a.length}).some(function(s){var q=stripAcc(s).toLowerCase();if(q&&n.indexOf(q)>-1){out.subject=s;return true}return false});
  var keep=orig.split('');spans.forEach(function(sp){for(var j=sp[0];j<sp[1];j++)keep[j]=' '});
  var t=keep.join('').replace(/\s+/g,' ').replace(/\s*[,;]\s*/g,', ').replace(/(,\s*)+/g,', ').replace(/^[\s,;.]+|[\s,;.]+$/g,'').replace(/\s+(e|para|pra|ate|de)$/i,'').trim();
  out.title=t?t.charAt(0).toUpperCase()+t.slice(1):'';
  return out;
}
export function applyPhrase(txt){
  var p=parseTaskPhrase(txt),set=function(id,v){var e=$(id);if(e)e.value=v},got=[];
  if(p.title){set('#fText',p.title);got.push('título')}
  if(p.due){set('#fDue',p.due);got.push('prazo')}
  if(p.est){set('#fEstH',Math.floor(p.est/60)||'');set('#fEstM',p.est%60||'');got.push('tempo')}
  if(p.prio){SH.prio=p.prio;var fp=$('#fPrio');if(fp)fp.innerHTML=prioChips(SH.prio);got.push('prioridade')}
  if(p.subject&&$('#fSubject')){set('#fSubject',p.subject);got.push('disciplina')}
  toast(got.length?'Preenchi: '+got.join(', ')+'. Confira antes de salvar.':'Não reconheci campos nessa frase. Preencha à mão.');
}
export function startVoice(){
  var SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){toast('Este navegador não tem reconhecimento de voz. Use o microfone do teclado e toque em Preencher campos.');return}
  if(UI.listening){try{UI.rec&&UI.rec.stop()}catch(e){}return}
  var r=new SR();UI.rec=r;r.lang='pt-BR';r.interimResults=false;r.continuous=false;r.maxAlternatives=1;
  var done=function(){UI.listening=false;var b=$('#micBtn');if(b)b.innerHTML=MIC+' Falar'};
  r.onresult=function(e){var t=(e.results&&e.results[0]&&e.results[0][0]&&e.results[0][0].transcript)||'',ph=$('#fPhrase');if(ph)ph.value=t;if(t)applyPhrase(t)};
  r.onerror=function(e){done();var er=e&&e.error;toast((er==='not-allowed'||er==='service-not-allowed')?'O microfone não foi liberado para o app. Use o microfone do teclado do iPhone e toque em Preencher campos.':er==='no-speech'?'Não ouvi nada. Tente de novo.':'Não consegui reconhecer a voz.')};
  r.onend=done;
  try{r.start();UI.listening=true;var b=$('#micBtn');if(b)b.innerHTML=MIC+' Ouvindo... toque para parar'}catch(e){done();toast('Não consegui iniciar o microfone.')}
}
export function formFields(o){
  var eh=o.est?Math.floor(o.est/60):'',em=o.est?o.est%60:'';
  return '<label class="flabel" for="fPhrase" style="margin-top:4px">Falar ou colar uma frase</label>'+
    '<textarea class="field" id="fPhrase" style="min-height:64px" placeholder="Ex.: terminar o relatório, entregar sexta, prioridade alta, leva 2 horas"></textarea>'+
    '<div class="row" style="margin-top:8px"><button class="btn quiet small" data-act="voice" id="micBtn">'+MIC+' Falar</button><button class="btn quiet small" data-act="phrase-fill">Preencher campos</button></div>'+
    '<p class="small muted" style="margin-top:6px">Nada é salvo sozinho: confira os campos antes de salvar.</p>'+
    '<label class="flabel" for="fText">Título</label><input class="field" id="fText" maxlength="90" value="'+esc(o.text)+'" placeholder="Ex.: enviar relatório">'+
    (o.showSubject?'<label class="flabel" for="fSubject">Disciplina</label><input class="field" id="fSubject" maxlength="60" list="subjList" value="'+esc(o.subject)+'" placeholder="Ex.: Operações Unitárias"><datalist id="subjList">'+subjects().map(function(s){return '<option value="'+esc(s)+'">'}).join('')+'</datalist>':'')+
    '<label class="flabel" for="fDue">Prazo (opcional)</label><input class="field" id="fDue" type="date" value="'+(o.due||'')+'">'+
    '<p class="flabel">Tempo estimado</p><div class="pair"><input class="field" id="fEstH" type="number" inputmode="numeric" min="0" max="99" placeholder="horas" value="'+eh+'" aria-label="Horas estimadas"><input class="field" id="fEstM" type="number" inputmode="numeric" min="0" max="59" placeholder="minutos" value="'+em+'" aria-label="Minutos estimados"></div>'+
    '<p class="flabel">Prioridade</p><div class="chips" id="fPrio">'+prioChips(SH.prio)+'</div>'+
    (o.showCat?'<label class="flabel" for="fCat">Categoria (para onde vai o tempo)</label><select class="field" id="fCat"><option value="">Sem categoria</option>'+S.cats.map(function(n){return '<option value="'+esc(n)+'"'+(o.cat===n?' selected':'')+'>'+esc(n)+'</option>'}).join('')+'</select>':'')+
    '<label class="flabel" for="fNote">Observação</label><textarea class="field" id="fNote" style="min-height:80px" placeholder="Ex.: fazer introdução e resultados">'+esc(o.note)+'</textarea>';
}
export function readForm(){
  var gv=function(id){var e=$(id);return e?e.value:''};
  var h=+gv('#fEstH')||0,m=+gv('#fEstM')||0;
  return {text:gv('#fText').trim(),subject:gv('#fSubject').trim(),due:gv('#fDue')||'',est:Math.max(0,h*60+m),prio:SH.prio,note:gv('#fNote').trim(),cat:gv('#fCat')};
}
export function taskSheet(id,presetToday,kind){
  var t=id?findTask(id):null,tk=t?t.kind:(kind||UI.tkKind||'pessoal');
  setSH({kind:'task',id:id||'',prio:t?t.prio:2,tk:tk});
  var plan=t?(t.plan===today()):!!presetToday;
  openSheet(t?'Editar tarefa':'Nova tarefa',
    formFields({text:t?t.text:'',due:t?t.due:'',est:t?t.est:0,note:t?t.note:'',showCat:true,cat:t?t.cat:''})+
    '<label class="check-row"><input type="checkbox" id="fToday"'+(plan?' checked':'')+'> Fazer hoje (conta nas suas 3)</label>'+
    (t&&t.url?'<p class="small" style="margin-top:12px"><a href="'+esc(t.url)+'" target="_blank" rel="noopener" style="color:var(--sea)">Abrir link de origem</a></p>':'')+
    '<div class="stack"><button class="btn block" data-act="task-save">Salvar</button>'+
    (t?'<button class="btn quiet block" data-act="task-focus" data-id="'+t.id+'">Focar nisso agora</button><button class="btn quiet block danger" data-act="task-del" data-id="'+t.id+'">Excluir</button>':'')+
    '<button class="btn quiet block" data-act="sheet-close">Cancelar</button></div>');
  try{document.activeElement.blur()}catch(e){}
}
export function inboxSheet(id){
  var it=S.inbox.find(function(x){return x.id===id});if(!it)return;
  setSH({kind:'inbox',id:id,prio:it.prio||2});
  openSheet('Editar atividade',
    formFields({text:it.title,due:it.due,est:it.est,note:it.note,showCat:false})+
    (it.url?'<p class="small" style="margin-top:12px"><a href="'+esc(it.url)+'" target="_blank" rel="noopener" style="color:var(--sea)">Abrir link de origem</a></p>':'')+
    '<div class="stack"><button class="btn block" data-act="ib-save-confirm">Salvar e confirmar</button><button class="btn quiet block" data-act="ib-save">Salvar e manter em Entrada</button><button class="btn quiet block danger" data-act="ib-ignore" data-id="'+id+'">Ignorar</button><button class="btn quiet block" data-act="sheet-close">Cancelar</button></div>');
  try{document.activeElement.blur()}catch(e){}
}
