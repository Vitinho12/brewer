import { $, esc, pl, uid, today, addDays, fmtHM } from '../utils.js';
import { S, L, PHASES, phaseIdx, weekIdx, currentGoal, nextGoal, qualifies, streakInfo, CUP_ASSETS, cupMeta } from '../state.js';

/* ---------- JORNADA ---------- */
export function goalPanelHTML(){
  var cur=currentGoal(),nx=nextGoal(),base=S.goal,w=weekIdx(),red=base-cur,pct=base?red/base*100:0;
  return '<div class="sec"><h2>1% melhor por semana</h2>'+
    (S.weekly1?'<p class="sumline">Meta desta semana: <b>'+fmtHM(cur)+'</b></p><p class="sumline">Meta da próxima semana: <b>'+fmtHM(nx)+'</b> ('+(cur-nx)+' min a menos)</p>'+
    '<p class="sumline">Progresso: semana '+(w+1)+', '+red+' min a menos que a meta inicial de '+fmtHM(base)+' ('+pct.toFixed(1).replace('.',',')+'%).</p><div class="pbar" style="max-width:none" aria-hidden="true"><span style="width:'+Math.min(100,pct*4)+'%"></span></div><p class="small muted">A barra enche com 25% de redução.</p>'
    :'<p class="sumline">Desligado. A meta fica fixa em <b>'+fmtHM(base)+'</b>.</p>')+
    '<div class="row"><button class="btn quiet small" data-act="weekly-toggle">'+(S.weekly1?'Desligar 1% melhor':'Ligar 1% melhor')+'</button></div></div>';
}
export function renderJornada(){
  var s=streakInfo(),ci=phaseIdx(s.n),nx=PHASES[ci+1];
  var tl=PHASES.map(function(p,i){
    var cls=i===ci?'current':i<ci?'done':'locked',fut=i>ci;
    return '<div class="t-node '+cls+'"><div class="t-dot"></div><div><h3>'+(fut?'[ ? ] Desbloqueia no dia '+p.min:esc(p.name))+'</h3><p class="small muted">'+(fut?'Continue para descobrir.':esc(p.desc))+'</p></div></div>';
  }).join('');
  var po=PHASES.slice(1).map(function(p,i){return '<option value="'+(i+1)+'">'+esc(p.name)+' (dia '+p.min+')</option>'}).join('');
  var mo='<option value="">Automático</option>'+CUP_ASSETS.good.map(function(_,i){return '<option value="'+i+'">'+esc(cupMeta(i).name)+'</option>'}).join('');
  var test=S.testMode?'<div class="test-panel"><h3>Modo teste</h3><p class="small muted" style="margin-top:4px">Mexe nos dados de verdade. Serve para testar fases, xícaras, foco e meta.</p>'+
    '<p class="small" style="margin-top:10px">Sequência atual: <b>'+s.n+'</b>. Semanas simuladas: <b>'+(S.testWeeks||0)+'</b></p>'+
    '<div class="row"><button class="btn quiet small" data-act="t-add">+1 dia</button><button class="btn quiet small" data-act="t-rem">-1 dia</button><button class="btn quiet small" data-act="t-skip">Perder um dia</button></div>'+
    '<select class="field" id="tPhase" aria-label="Fase" style="margin-top:12px">'+po+'</select><div class="row"><button class="btn quiet small" data-act="t-jump">Ir para a fase</button><button class="btn quiet small" data-act="t-clear">Limpar dias simulados</button></div><hr>'+
    '<div class="row" style="margin-top:0"><button class="btn quiet small" data-act="t-week" data-v="1">+1 semana</button><button class="btn quiet small" data-act="t-week" data-v="-1">-1 semana</button><button class="btn quiet small" data-act="t-week" data-v="0">Zerar semanas</button></div><hr>'+
    '<div class="row" style="margin-top:0"><button class="btn quiet small" data-act="t-win">+ Xícara boa</button><button class="btn quiet small" data-act="t-fail">+ Xícara quebrada</button><button class="btn quiet small" data-act="t-clearb">Limpar xícaras simuladas</button></div>'+
    '<select class="field" id="tModel" aria-label="Modelo" style="margin-top:12px">'+mo+'</select><div class="row"><button class="btn quiet small" data-act="t-model">Usar no próximo foco ou xícara</button><button class="btn quiet small" data-act="t-unlock">Descobrir todas</button><button class="btn quiet small" data-act="t-lockall">Esconder todas</button></div>'+
    '<p class="small muted" style="margin-top:10px">No Foco aparece a opção de 10 segundos (teste), e durante o bloco você pode simular uma ausência de 30 s ou 2 min.</p><hr><button class="btn quiet small danger" data-act="t-reset">Apagar todos os dados</button></div>':'';
  $('#tab-jornada').innerHTML='<h1>Sua jornada</h1><p class="lead">Registre o tempo de tela e fique dentro da meta de '+fmtHM(currentGoal())+' (desta semana) para avançar. Um dia fora da meta ou sem registro zera a sequência.</p>'+
    '<p style="margin-top:16px">Sequência atual: <b>'+pl(s.n,'dia','dias')+'</b>. Maior: '+s.best+'.</p><p class="muted">'+(nx?'Faltam '+pl(nx.min-s.n,'dia','dias')+' para '+esc(nx.name)+'.':'Você chegou ao topo.')+'</p>'+
    '<div class="row"><button class="btn small" data-act="tab" data-tab="revisao">Registrar hoje</button></div>'+goalPanelHTML()+'<div class="timeline">'+tl+'</div>'+
    '<div class="row"><button class="btn quiet small" data-act="test-toggle" aria-pressed="'+S.testMode+'">'+(S.testMode?'Fechar modo teste':'Modo teste')+'</button></div>'+test;
}
export function simSession(c){S.sessions.push({id:uid(),d:c.d,t0:Date.now(),t1:Date.now(),mins:25,mode:'total',ok:c.ok,cupId:c.id,model:c.model,cat:'',label:'Teste',taskId:'',src:'manual',blockId:'',ext:'',approx:false,sim:true})}
export function simDay(k){var l=L(k);l.screen=Math.max(30,currentGoal()-30);l.goal=currentGoal();l.sim=true}
export function testAdd(){var s=streakInfo();simDay(addDays(s.end,-s.n))}
export function testRem(){var s=streakInfo();if(s.n>0){var l=L(addDays(s.end,-(s.n-1)));l.screen=null;l.sim=false}}
export function testSkip(){L(addDays(today(),-1)).screen=null}
export function testJump(i){var n=PHASES[i].min;for(var j=0;j<n;j++){var k=addDays(today(),-j);if(!qualifies(k))simDay(k)}}
export function testClear(){Object.keys(S.log).forEach(function(k){if(S.log[k].sim){S.log[k].screen=null;S.log[k].sim=false}})}
