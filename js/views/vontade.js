import { $, esc, mmss, today } from '../utils.js';
import { S, L, save, cmp, holdScreen, releaseLock, toast } from '../state.js';
import { render, go } from '../app.js';

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

/* ---------- VONTADE & MODO SCREENZEN (GATE) ---------- */
export var GATE_STEPS=[15,20,25,30];
export var FEELS={
  'Só hábito':'O polegar foi no piloto automático. Respire fundo 3 vezes.',
  'Tédio':'Levante, beba água ou olhe pela janela. O tédio passa rápido.',
  'Ansiedade':'Solte o ar bem devagar. Escreva em 1 linha o que te preocupa.',
  'Procrastinando':'Combine consigo: só 2 minutos na tarefa. Começar é o segredo.',
  'Responder alguém':'Entre, responda quem precisa e saia direto sem olhar o feed.',
  'Lazer consciente':'Tudo bem descansar no seu tempo livre. Aproveite os 5 min com foco.'
};
export var FEEL_ICONS={
  'Só hábito':'📱',
  'Tédio':'🥱',
  'Ansiedade':'⚡',
  'Procrastinando':'🏃',
  'Responder alguém':'💬',
  'Lazer consciente':'☕'
};
export var LEISURE_FEELS={'Responder alguém':1,'Lazer consciente':1,'Lazer / tempo livre':1};

export function gateSeconds(){
  var c=L().gateCount||0;
  return GATE_STEPS[Math.min(GATE_STEPS.length-1,c)];
}
export function clearGateURL(){
  try{
    if(window.history&&history.replaceState&&(location.search.indexOf('gate')>-1||location.hash.indexOf('gate')>-1||location.search.indexOf('app')>-1||location.hash.indexOf('app')>-1)){
      history.replaceState(null,'',location.pathname);
    }
  }catch(e){}
}
export function getAppScheme(app){
  var a=(app||'').toLowerCase();
  if(a.includes('twit')||a==='x')return 'twitter://';
  if(a.includes('insta'))return 'instagram://';
  if(a.includes('you'))return 'youtube://';
  if(a.includes('tik'))return 'tiktok://';
  if(a.includes('reddit'))return 'reddit://';
  if(a.includes('link'))return 'linkedin://';
  return null;
}
export function startGate(app){
  var secs=gateSeconds(),now=Date.now();
  var a=(app||'').trim();
  var label=a?String(a).charAt(0).toUpperCase()+String(a).slice(1):'Instagram';
  if(label==='1'||label==='True'||!label)label='Instagram';
  if(label.toLowerCase()==='x')label='Twitter';
  S.wait={phase:'gate',app:label,feel:'',total:secs,start:now,end:now+secs*1000,attempt:(L().gateCount||0)+1,notified:false};
  holdScreen();save();
}
export function selectFeel(feel){
  if(S.wait&&S.wait.phase==='gate'){
    S.wait.feel=feel;save();render();return;
  }
  startWait(feel);
}
export function start10m(){
  var feel=(S.wait&&S.wait.feel)||'Só hábito';
  startWait(feel);
}
export function gateStay(){
  var feel=(S.wait&&S.wait.feel)||'Só hábito';
  L().resisted++;
  logUrge(feel,'resisted');
  S.wait=null;releaseLock();clearGateURL();save();
  toast('Boa escolha! +1 vontade que passou.');
  go(S.focus&&S.focus.mode==='focus'?'foco':'hoje');
}
export function gateOpenApp(targetApp){
  var s=S.wait;
  if(!s||s.phase!=='gate'||Date.now()<s.end||!s.feel)return;
  var lg=L();
  lg.gateCount=(lg.gateCount||0)+1;
  if(!LEISURE_FEELS[s.feel]){
    lg.gave++;
    logUrge(s.feel,'gave');
  }else{
    logUrge(s.feel,'leisure');
  }
  var appTarget=targetApp||s.app||'Instagram';
  var isTw=appTarget.toLowerCase().indexOf('twit')>-1||appTarget.toLowerCase()==='x';
  var shName=isTw?'Liberar Twitter':(S.gateShortcut||'Liberar Instagram');

  S.wait=null;S.tab='vontade';releaseLock();clearGateURL();save();render();

  try{
    window.location.href='shortcuts://run-shortcut?name='+encodeURIComponent(shName)+'&input=text&text='+encodeURIComponent(appTarget);
  }catch(e){}
}
export function gateConfig(){
  var cur=S.gateShortcut||'Liberar Instagram';
  var nv=prompt('Nome exato do Atalho no iPhone que libera os 5 min e abre o Instagram:',cur);
  if(nv!==null&&nv.trim()){
    S.gateShortcut=nv.trim();save();render();
    toast('Atalho salvo: '+S.gateShortcut);
  }
}
export function startWait(feel){S.wait={phase:'wait',feel:feel,total:600,end:Date.now()+600000,ext:false};holdScreen();save();render()}
export function logUrge(feel,res){S.urges.push({t:Date.now(),feel:feel||'',res:res});if(S.urges.length>400)S.urges=S.urges.slice(-400)}
export function finishWait(res){
  var feel=S.wait?S.wait.feel:'';
  if(res==='resisted')L().resisted++;else L().gave++;
  logUrge(feel,res);
  S.wait={phase:'result',result:res,feel:feel};releaseLock();clearGateURL();save();render();
}
export function gateBtnText(s,rem){
  var app=s.app||'Instagram';
  if(rem>0){
    var sec=Math.ceil(rem/1000);
    return 'Aguarde '+sec+'s...';
  }
  if(!s.feel)return 'Toque em um motivo acima para liberar';
  return 'Liberar '+app+' por 5 min';
}
export function renderVontade(){
  var el=$('#tab-vontade');
  if(!S.wait)startGate('Instagram');
  var s=S.wait;
  if(s.phase==='gate'){
    var now=Date.now(),rem=Math.max(0,s.end-now),elapsed=Math.max(0,now-(s.start||(s.end-s.total*1000)));
    var pct=Math.max(0,Math.min(100,(1-rem/(s.total*1000))*100));
    var f=S.focus,focusWarn='';
    if(f&&f.mode==='focus'){
      focusWarn=f.kind==='parcial'
        ?'<div class="nudge" style="width:100%"><h3>Foco parcial em andamento</h3><p class="small" style="margin-top:4px">Você está em <b>'+esc(f.label)+'</b>. Quer mesmo interromper agora?</p></div>'
        :'<div class="nudge gate-warn" style="width:100%"><h3>Atenção: xícara em risco!</h3><p class="small" style="margin-top:4px">Você está no foco <b>'+esc(f.label)+'</b>. Ir para o '+esc(s.app||'Instagram')+' agora vai quebrar sua xícara.</p></div>';
    }
    /* FASE 1: Enquanto o tempo corre, tela 100% clean (só respiração e contador) */
    if(rem>0){
      el.innerHTML=
        '<div class="gate-clean">'+
          '<div class="gate-badge">'+s.attempt+'ª abertura de hoje · pausa de '+s.total+'s</div>'+
          '<h1>Respire fundo.</h1>'+
          '<p class="lead" style="max-width:340px">Uma pausa rápida antes de decidir se você realmente quer entrar.</p>'+
          focusWarn+
          '<div class="wait-time" id="waitTime" style="margin-top:24px">'+mmss(rem)+'</div>'+
          '<div class="bar-track"><div class="bar-fill" id="gateBar" style="width:'+pct+'%"></div></div>'+
          '<div class="breath" style="margin-top:28px"><div class="orb-box"><div class="orb" style="animation-delay:-'+(elapsed%10000)+'ms"></div></div><div><b id="breathLabel">'+(elapsed%10000<4000?'Inspira':'Solta')+'</b><p class="muted small">4 segundos para puxar, 6 para soltar</p></div></div>'+
        '</div>';
      return;
    }
    /* FASE 2: Tempo zerou (00:00) -> revela os motivos e os botões de decisão */
    var ready=!!s.feel;
    var chips=Object.keys(FEELS).map(function(k){
      var ico=FEEL_ICONS[k]||'✨';
      return '<button class="feel" data-act="feel" data-v="'+esc(k)+'" aria-pressed="'+(s.feel===k)+'">'+
        '<span class="feel-ico">'+ico+'</span><span class="feel-txt">'+esc(k)+'</span>'+
      '</button>';
    }).join('');
    var first=S.tasks.filter(function(t){return !t.done}).sort(function(a,b){return ((b.plan===today())-(a.plan===today()))||cmp(a,b)})[0];
    var extra=(s.feel==='Procrastinando'||s.feel==='Fugindo de uma tarefa')?'<div style="margin-top:14px"><button class="btn sun small" data-act="do-two">Fazer 2 minutos agora'+(first?': '+esc(first.text.length>22?first.text.slice(0,22)+'…':first.text):'')+'</button></div>':'';
    var tipBox=s.feel?'<div class="suggest"><p>'+esc(FEELS[s.feel]||'')+'</p>'+(LEISURE_FEELS[s.feel]?'<p class="small muted" style="margin-top:6px">Como é uso consciente/lazer, não será contado como recaída na sua revisão.</p>':'')+extra+'</div>':'';
    var nextStep=GATE_STEPS[Math.min(GATE_STEPS.length-1,s.attempt)];
    el.innerHTML=
      '<div class="gate-reveal">'+
        '<div class="gate-badge">'+s.attempt+'ª abertura · pausa concluída</div>'+
        '<h1>Ainda quer entrar?</h1>'+
        '<p class="lead">'+(s.attempt<GATE_STEPS.length?'Se liberar agora, a próxima pausa hoje será de '+nextStep+'s.':'Pausa máxima de 30s ativa hoje.')+'</p>'+
        focusWarn+
        '<p class="label">O que está por trás dessa abertura?</p>'+
        '<div class="feels">'+chips+'</div>'+
        tipBox+
        '<div class="stack" style="margin-top:22px">'+
          '<button class="btn block" data-act="gate-stay">'+(f&&f.mode==='focus'?'Voltar para o foco (não abrir)':'🛡️ Ficar no Brewer (Não abrir)')+'</button>'+
          (ready
            ?'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;width:100%">'+
               '<button class="btn quiet block" data-act="gate-open-app" data-app="Instagram">Liberar Instagram (5m)</button>'+
               '<button class="btn quiet block" data-act="gate-open-app" data-app="Twitter">Liberar Twitter (5m)</button>'+
             '</div>'
            :'<button class="btn quiet block" id="gateOpenBtn" data-act="gate-open-app" disabled>'+esc(gateBtnText(s,0))+'</button>')+
          '<button class="ghost small" data-act="start-10m" style="text-align:center;margin-top:4px">Ou esperar 10 min na curva da vontade</button>'+
        '</div>'+
        '<p class="small muted" style="margin-top:22px;text-align:center">Atalhos: <b>Liberar Instagram</b> / <b>Liberar Twitter</b> · <button class="ghost small" data-act="gate-cfg">Alterar</button></p>'+
      '</div>';
    return;
  }
  if(s.phase==='wait'){
    var first2=S.tasks.filter(function(t){return !t.done}).sort(function(a,b){return ((b.plan===today())-(a.plan===today()))||cmp(a,b)})[0];
    var elapsed2=Date.now()-(s.end-s.total*1000);
    var extra2=(s.feel==='Fugindo de uma tarefa')?'<div style="margin-top:14px"><button class="btn sun small" data-act="do-two">Fazer 2 minutos agora'+(first2?': '+esc(first2.text.length>22?first2.text.slice(0,22)+'…':first2.text):'')+'</button></div>':'';
    el.innerHTML='<h2>Deixando a vontade passar</h2>'+curveSVG()+
      '<div class="wait-time" id="waitTime">'+mmss(s.end-Date.now())+'</div>'+
      '<div class="breath"><div class="orb-box"><div class="orb" style="animation-delay:-'+(elapsed2%10000)+'ms"></div></div><div><b id="breathLabel">Inspira</b><p class="muted small">4 segundos para puxar, 6 para soltar</p></div></div>'+
      '<div class="suggest"><p>'+esc(FEELS[s.feel]||'')+'</p>'+extra2+'</div>'+
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
