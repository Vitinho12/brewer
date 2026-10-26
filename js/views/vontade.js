import { $, esc, mmss, today } from '../utils.js';
import { S, L, save, cmp, holdScreen, releaseLock } from '../state.js';
import { render } from '../app.js';

/* ---------- curva da vontade ---------- */
export function inten(t){return .05+.95*Math.exp(-Math.pow(t-.3,2)/(2*.16*.16))}
export function WX(t){return 6+t*308}
export function WY(t){return 108-inten(t)*86}
export var curvePath=(function(){var d='';for(var i=0;i<=60;i++){var t=i/60;d+=(i?'L':'M')+WX(t).toFixed(1)+' '+WY(t).toFixed(1)}return d})();
export var curveArea=curvePath+'L'+WX(1).toFixed(1)+' 112L'+WX(0).toFixed(1)+' 112Z';
export function curveSVG(){
  return '<svg class="curve" viewBox="0 0 320 130" role="img" aria-label="A vontade sobe, chega ao pico e passa">'+
  '<defs><clipPath id="wc"><rect id="curveClip" x="0" y="0" width="0" height="130"/></clipPath></defs>'+
  '<path d="'+curveArea+'" fill="var(--sea)" opacity=".18" clip-path="url(#wc)"/>'+
  '<path d="'+curvePath+'" fill="none" stroke="var(--line)" stroke-width="3" stroke-linecap="round"/>'+
  '<path d="'+curvePath+'" fill="none" stroke="var(--sea)" stroke-width="3.5" stroke-linecap="round" clip-path="url(#wc)"/>'+
  '<circle id="curveDot" r="7" cx="6" cy="'+WY(0).toFixed(1)+'" fill="var(--sun)" stroke="var(--bg)" stroke-width="3"/>'+
  '<text x="'+WX(.08).toFixed(0)+'" y="126">sobe</text><text x="'+WX(.3).toFixed(0)+'" y="126">pico</text><text x="'+WX(.72).toFixed(0)+'" y="126">passa</text>'+
  '</svg>';
}

/* ---------- VONTADE ---------- */
export var FEELS={
  'Tédio':'Levante, beba um copo de água e olhe pela janela por um minuto. O tédio também passa.',
  'Ansiedade':'Solte o ar mais devagar do que puxou. Escreva em uma linha só o que está te preocupando.',
  'Fugindo de uma tarefa':'Combine consigo: só 2 minutos nela. Começar é a parte difícil, e depois o impulso costuma ceder.',
  'Cansaço':'Alongue pescoço e ombros por 1 minuto. Se o cansaço é real, 10 min sem tela descansam mais que rolar o feed.',
  'Só hábito':'O polegar foi sozinho. Vire o celular de tela para baixo e conte 10 respirações.'
};
export function startWait(feel){S.wait={phase:'wait',feel:feel,total:600,end:Date.now()+600000,ext:false};holdScreen();save();render()}
export function logUrge(feel,res){S.urges.push({t:Date.now(),feel:feel||'',res:res});if(S.urges.length>400)S.urges=S.urges.slice(-400)}
export function finishWait(res){
  var feel=S.wait?S.wait.feel:'';
  if(res==='resisted')L().resisted++;else L().gave++;
  logUrge(feel,res);
  S.wait={phase:'result',result:res,feel:feel};releaseLock();save();render();
}
export function renderVontade(){
  var el=$('#tab-vontade'),s=S.wait;
  if(!s){
    var chips=Object.keys(FEELS).map(function(k){return '<button class="feel" data-act="feel" data-v="'+esc(k)+'">'+esc(k)+'</button>'}).join('');
    el.innerHTML='<h1>Bateu a vontade. Normal.</h1><p class="lead">A vontade é como a água passando pelo filtro: leva alguns minutos, chega ao pico e passa. Você não precisa obedecer. Só esperar.</p>'+
      '<p class="label">O que está por trás dela?</p><div class="feels">'+chips+'</div>';
    return;
  }
  if(s.phase==='wait'){
    var first=S.tasks.filter(function(t){return !t.done}).sort(function(a,b){return ((b.plan===today())-(a.plan===today()))||cmp(a,b)})[0];
    var elapsed=Date.now()-(s.end-s.total*1000);
    var extra=(s.feel==='Fugindo de uma tarefa')?'<div style="margin-top:14px"><button class="btn sun small" data-act="do-two">Fazer 2 minutos agora'+(first?': '+esc(first.text.length>22?first.text.slice(0,22)+'…':first.text):'')+'</button></div>':'';
    el.innerHTML='<h2>Deixando a vontade passar</h2>'+curveSVG()+
      '<div class="wait-time" id="waitTime">'+mmss(s.end-Date.now())+'</div>'+
      '<div class="breath"><div class="orb-box"><div class="orb" style="animation-delay:-'+(elapsed%10000)+'ms"></div></div><div><b id="breathLabel">Inspira</b><p class="muted small">4 segundos para puxar, 6 para soltar</p></div></div>'+
      '<div class="suggest"><p>'+esc(FEELS[s.feel]||'')+'</p>'+extra+'</div>'+
      '<div class="stack"><button class="btn block" data-act="wait-pass">Já passou</button><button class="btn quiet block" data-act="wait-gave">Cedi</button></div>';
  }else if(s.phase==='end'){
    el.innerHTML='<h1>A vontade passou. Ou quase.</h1><p class="lead">Como você está agora?</p>'+
      '<div class="stack"><button class="btn block" data-act="wait-pass">Passou, vou voltar</button><button class="btn quiet block" data-act="wait-more">Ainda quero. Mais 5 min</button><button class="btn quiet block" data-act="wait-gave">Cedi</button></div>';
  }else{
    var ok=s.result==='resisted';
    el.innerHTML='<h1>'+(ok?'Vontade vencida.':'Registrado.')+'</h1><p class="lead">'+(ok?'Isso é treino: cada vontade que você espera deixa a próxima mais fácil.':'Sem culpa. Combine consigo: 5 minutos de celular e volta para o que estava fazendo.')+'</p>'+
      '<div class="stack"><button class="btn block" data-act="wait-back">'+(S.focus&&S.focus.mode==='focus'?'Voltar para o foco':'Ir para o foco')+'</button></div>';
  }
}
