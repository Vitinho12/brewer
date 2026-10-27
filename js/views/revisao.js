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
  var head='<h1>Revisão</h1>'+seg('rev-view',UI.revView,[['hoje','Fechar o Dia'],['semana','Gráficos (7d)'],['raiox','Raio-X']]);
  if(UI.revView==='hoje'){
    var lg=L(k),pl3=planned(k),doneToday=S.tasks.filter(function(t){return t.doneAt===k}).length;
    var sh=lg.screen!=null?Math.floor(lg.screen/60):'',sm=lg.screen!=null?lg.screen%60:'';
    el.innerHTML=head+
      '<div class="smart-card" style="margin-top:14px">'+
        '<div class="smart-info"><span class="smart-eyebrow">Resumo de hoje</span><b>'+fmtHM(lg.focus)+' de foco · '+pl(doneToday,'tarefa feita','tarefas feitas')+(pl3.length?' ('+pl3.filter(function(t){return t.done}).length+'/'+pl3.length+' prioridades)':'')+'</b></div>'+
      '</div>'+
      '<label class="flabel" for="fScreenH" style="margin-top:16px">Tempo de tela de hoje</label>'+
      '<div class="pair"><input class="field field-sm" id="fScreenH" data-f="screenH" type="number" inputmode="numeric" min="0" max="23" placeholder="horas" value="'+sh+'" aria-label="Horas"><input class="field field-sm" id="fScreenM" data-f="screenM" type="number" inputmode="numeric" min="0" max="59" placeholder="minutos" value="'+sm+'" aria-label="Minutos"></div>'+
      '<div id="screenStatus" class="nudge" style="margin-top:10px;padding:10px 14px">'+screenStatusHTML()+'</div>'+
      '<label class="flabel" for="fWin" style="margin-top:14px">Maior vitória do dia</label><input class="field field-sm" id="fWin" data-f="win" maxlength="120" value="'+esc(lg.win)+'" placeholder="Até uma coisa pequena conta">'+
      '<label class="flabel" for="fNext" style="margin-top:14px">Amanhã eu começo por</label><input class="field field-sm" id="fNext" data-f="next" maxlength="120" value="'+esc(lg.next)+'" placeholder="Uma ação concreta para começar o dia">';
    return;
  }
  var days=lastDays(7),prev=lastDays(7,addDays(k,-7));
  var focus=days.map(function(d){return L(d).focus});
  var screen=days.map(function(d){var v=S.log[d]?S.log[d].screen:null;return v==null?null:v});
  var maxF=Math.max.apply(null,focus.concat([1])),maxS=Math.max.apply(null,screen.map(function(v){return v||0}).concat([1]));
  var sc=screen.filter(function(v){return v!=null}),psc=prev.map(function(d){var v=S.log[d]?S.log[d].screen:null;return v}).filter(function(v){return v!=null});
  var avg=function(a){return a.reduce(function(x,y){return x+y},0)/a.length};
  var tl=sc.length>=3?'Média de tela: '+fmtHM(avg(sc))+'/dia'+(psc.length>=3?' (sem. ant.: '+fmtHM(avg(psc))+')':''):'Registre 3 dias de tela para ver a média.';
  var totF=focus.reduce(function(a,b){return a+b},0);
  var best=focus.indexOf(Math.max.apply(null,focus));
  var doneW=S.tasks.filter(function(t){return t.doneAt&&days.indexOf(t.doneAt)>-1}).length;

  if(UI.revView==='semana'){
    el.innerHTML=head+
      '<div class="smart-card" style="margin-top:14px">'+
        '<div class="smart-info"><span class="smart-eyebrow">Últimos 7 dias</span><b>'+fmtHM(totF)+' focado · '+pl(doneW,'tarefa','tarefas')+' · '+days.filter(qualifies).length+'/7 na meta</b><p class="muted small" style="margin-top:2px">'+tl+(totF?' · Melhor dia: '+DAYN[parseKey(days[best]).getDay()]:'')+'</p></div>'+
      '</div>'+
      '<p class="bcap" style="margin-top:16px">Foco por dia</p>'+bars(days,focus,maxF,function(v){return v?fmtHM(v):'0'},false)+
      '<p class="bcap" style="margin-top:16px">Tela por dia</p>'+bars(days,screen,maxS,fmtHM,true);
    return;
  }

  /* Raio-X: Categorias, Vontades e Meta da Semana */
  var from=Date.now()-7*864e5;
  var ur=S.urges.filter(function(u){return u.t>=from});
  var sur=ur.filter(function(u){return u.res!=='gave'}).length,gav=ur.length-sur;
  var cnt={},per={'manhã':0,'tarde':0,'noite':0};
  ur.forEach(function(u){if(u.feel)cnt[u.feel]=(cnt[u.feel]||0)+1;var h=new Date(u.t).getHours();per[h<12?'manhã':h<18?'tarde':'noite']++});
  var topFeel=Object.keys(cnt).sort(function(a,b){return cnt[b]-cnt[a]})[0];
  var topPer=Object.keys(per).sort(function(a,b){return per[b]-per[a]})[0];
  var urgeHtml=ur.length?'<p class="sumline">'+pl(ur.length,'vontade','vontades')+': resistiu '+sur+'x e cedeu '+gav+'x.</p>'+(topFeel?'<p class="sumline">Gatilho principal: '+esc(topFeel.toLowerCase())+' ('+topPer+').</p>':''):'<p class="sumline muted">Nenhuma vontade registrada nesta semana.</p>';
  el.innerHTML=head+
    '<div class="sec" style="margin-top:16px;padding-top:12px"><h2>Para onde foi o foco</h2>'+seg('cat-range',String(UI.catRange),[['7','7 dias'],['30','30 dias']])+catBars(lastDays(UI.catRange))+'</div>'+
    '<div class="sec" style="margin-top:16px;padding-top:12px"><h2>Vontades &amp; Interrupções</h2><div style="margin-top:6px">'+urgeHtml+interruptLine()+'</div></div>'+
    '<div class="sec" style="margin-top:16px;padding-top:12px"><h2>Meta inicial de tela</h2><div class="pair"><input class="field field-sm" id="fGoalH" data-f="goalH" type="number" inputmode="numeric" min="0" max="23" value="'+Math.floor(S.goal/60)+'" aria-label="Horas da meta"><input class="field field-sm" id="fGoalM" data-f="goalM" type="number" inputmode="numeric" min="0" max="59" value="'+(S.goal%60)+'" aria-label="Minutos da meta"></div><p class="small muted" style="margin-top:6px">Com 1% melhor por semana, a meta desta semana é '+fmtHM(currentGoal())+'.</p></div>';
}
