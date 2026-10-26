import { $, esc, pl, today, parseKey, addDays, fmtHM, DAYL, DAYN, lastDays, seg } from '../utils.js';
import { S, UI, L, planned, routinePct, currentGoal, qualifies, screenStatusHTML } from '../state.js';
import { catHTML, catBars, interruptLine } from './foco.js';

/* ---------- REVISÃO ---------- */
export function bars(days,vals,max,fmt,sun){
  return days.map(function(k,i){
    var v=vals[i];var w=(v!=null&&max)?Math.round(v/max*100):0;
    return '<div class="brow"><span class="bday">'+DAYL[parseKey(k).getDay()]+'</span><span class="btrack"><span class="bfill'+(sun?' sun':'')+'" style="width:'+w+'%"></span></span><span class="bval">'+(v==null?'sem dado':fmt(v))+'</span></div>';
  }).join('');
}
export function renderRevisao(){
  var el=$('#tab-revisao'),k=today();
  var head='<h1>Revisão</h1>'+seg('rev-view',UI.revView,[['hoje','Hoje'],['semana','Semana']]);
  if(UI.revView==='hoje'){
    var lg=L(k),pl3=planned(k),doneToday=S.tasks.filter(function(t){return t.doneAt===k}).length;
    var rp=routinePct(k);
    var sh=lg.screen!=null?Math.floor(lg.screen/60):'',sm=lg.screen!=null?lg.screen%60:'';
    el.innerHTML=head+
      '<div class="sec" style="margin-top:26px"><h2>Como foi o dia</h2>'+
      '<p class="sumline">'+pl(doneToday,'tarefa feita','tarefas feitas')+(pl3.length?', '+pl3.filter(function(t){return t.done}).length+' das '+pl3.length+' que você escolheu':'')+'.</p>'+
      '<p class="sumline">'+fmtHM(lg.focus)+' de foco. '+pl(lg.resisted,'vontade que passou','vontades que passaram')+(lg.gave?', '+pl(lg.gave,'cedida','cedidas'):'')+'.</p>'+
      (rp?'<p class="sumline">Rotinas: '+rp.dn+' de '+rp.tot+' passos.</p>':'')+catHTML([k])+'</div>'+
      '<label class="flabel" for="fScreenH" style="margin-top:28px">Tempo de tela de hoje</label>'+
      '<div class="pair"><input class="field" id="fScreenH" data-f="screenH" type="number" inputmode="numeric" min="0" max="23" placeholder="horas" value="'+sh+'" aria-label="Horas"><input class="field" id="fScreenM" data-f="screenM" type="number" inputmode="numeric" min="0" max="59" placeholder="minutos" value="'+sm+'" aria-label="Minutos"></div>'+
      '<p class="small muted" style="margin-top:8px">Veja o número em Ajustes &gt; Tempo de Uso (iPhone) ou Bem-estar digital (Android). O app não consegue ler esse dado sozinho.</p>'+
      '<div id="screenStatus" class="nudge" style="margin-top:14px">'+screenStatusHTML()+'</div>'+
      '<label class="flabel" for="fGoalH">Meta inicial de tela</label><div class="pair"><input class="field" id="fGoalH" data-f="goalH" type="number" inputmode="numeric" min="0" max="23" value="'+Math.floor(S.goal/60)+'" aria-label="Horas da meta"><input class="field" id="fGoalM" data-f="goalM" type="number" inputmode="numeric" min="0" max="59" value="'+(S.goal%60)+'" aria-label="Minutos da meta"></div><p class="small muted" style="margin-top:8px">Esta é a meta inicial: com o 1% melhor por semana, a desta semana é '+fmtHM(currentGoal())+'. Dentro da meta soma na sequência; fora da meta ou sem registro, zera tudo.</p>'+
      '<label class="flabel" for="fWin">Maior vitória do dia</label><input class="field" id="fWin" data-f="win" maxlength="120" value="'+esc(lg.win)+'" placeholder="Até uma coisa pequena conta">'+
      '<label class="flabel" for="fNext">Amanhã eu começo por</label><input class="field" id="fNext" data-f="next" maxlength="120" value="'+esc(lg.next)+'" placeholder="Uma ação concreta, não uma intenção">'+
      '<p class="small muted" style="margin-top:8px">Amanhã de manhã isso aparece no topo do Hoje.</p>';
    return;
  }
  var days=lastDays(7),prev=lastDays(7,addDays(k,-7));
  var focus=days.map(function(d){return L(d).focus});
  var screen=days.map(function(d){var v=S.log[d]?S.log[d].screen:null;return v==null?null:v});
  var maxF=Math.max.apply(null,focus.concat([1])),maxS=Math.max.apply(null,screen.map(function(v){return v||0}).concat([1]));
  var sc=screen.filter(function(v){return v!=null}),psc=prev.map(function(d){var v=S.log[d]?S.log[d].screen:null;return v}).filter(function(v){return v!=null});
  var avg=function(a){return a.reduce(function(x,y){return x+y},0)/a.length};
  var tl='';
  if(sc.length>=3){
    tl='<p class="sumline">Média de tela: '+fmtHM(avg(sc))+' por dia'+(psc.length>=3?' (semana anterior: '+fmtHM(avg(psc))+')':'')+'.</p>';
  }else tl='<p class="sumline muted">Registre o tempo de tela na revisão do dia. Com 3 dias já aparece a média.</p>';
  var totF=focus.reduce(function(a,b){return a+b},0);
  var best=focus.indexOf(Math.max.apply(null,focus));
  var doneW=S.tasks.filter(function(t){return t.doneAt&&days.indexOf(t.doneAt)>-1}).length;
  var from=Date.now()-7*864e5;
  var ur=S.urges.filter(function(u){return u.t>=from});
  var sur=ur.filter(function(u){return u.res!=='gave'}).length,gav=ur.length-sur;
  var cnt={},per={'manhã':0,'tarde':0,'noite':0};
  ur.forEach(function(u){if(u.feel)cnt[u.feel]=(cnt[u.feel]||0)+1;var h=new Date(u.t).getHours();per[h<12?'manhã':h<18?'tarde':'noite']++});
  var topFeel=Object.keys(cnt).sort(function(a,b){return cnt[b]-cnt[a]})[0];
  var topPer=Object.keys(per).sort(function(a,b){return per[b]-per[a]})[0];
  var urgeHtml=ur.length?'<p class="sumline">'+pl(ur.length,'vez que a vontade bateu','vezes que a vontade bateu')+': você esperou a vontade passar '+sur+' vezes e cedeu '+gav+'.</p>'+(topFeel?'<p class="sumline">O que mais estava por trás: '+esc(topFeel.toLowerCase())+'. Ela bate mais de '+topPer+'.</p>':''):'<p class="sumline muted">Nenhuma vontade registrada nesta semana.</p>';
  var wd0=days.map(function(){return 0}),tot=0,dn=0;
  days.forEach(function(d){var r=routinePct(d);if(r){tot+=r.tot;dn+=r.dn}});
  el.innerHTML=head+
    '<div class="sec" style="margin-top:26px"><h2>Últimos 7 dias</h2>'+
    '<p class="sumline">'+fmtHM(totF)+' de foco'+(totF?', melhor dia: '+DAYN[parseKey(days[best]).getDay()]+' ('+fmtHM(focus[best])+')':'')+'.</p>'+
    '<p class="sumline">'+pl(doneW,'tarefa feita','tarefas feitas')+'.</p>'+
    (tot?'<p class="sumline">Rotinas: '+Math.round(dn/tot*100)+'% dos passos feitos.</p>':'')+'<p class="sumline">'+days.filter(qualifies).length+' de 7 dias dentro da meta de tela.</p>'+tl+'</div>'+
    '<p class="bcap">Foco por dia</p>'+bars(days,focus,maxF,function(v){return v?fmtHM(v):'0'},false)+
    '<p class="bcap">Tela por dia</p>'+bars(days,screen,maxS,fmtHM,true)+
    '<div class="sec"><h2>Para onde foi o foco</h2>'+seg('cat-range',String(UI.catRange),[['7','7 dias'],['30','30 dias']])+catBars(lastDays(UI.catRange))+'</div>'+
    '<div class="sec"><h2>Vontades</h2><div style="margin-top:8px">'+urgeHtml+interruptLine()+'</div></div>';
}
