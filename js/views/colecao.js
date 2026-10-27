import { $, esc, pl, today, parseKey, addDays, mondayOf, fmtShort, fmtHM, DAYL, DAYN, seg } from '../utils.js';
import { S, UI, CUP_ASSETS, cupMeta, cupImg, cupArtSVG, v60CarafeSVG, catColor, chunk } from '../state.js';

var MONTHS=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
var MSHORT=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

/* Mantém compatibilidade caso algum módulo chame tray() */
export function tray(c,i){
  var d=c.length?fmtShort(c[0].d)+(c[0].d!==c[c.length-1].d?' a '+fmtShort(c[c.length-1].d):''):'',h='',totMins=0;
  c.forEach(function(b){if(b&&b.ok&&b.mins)totMins+=b.mins});
  for(var j=0;j<7;j++){
    var b=c[j];
    if(b){
      var cat=b.cat&&b.cat!=='Sem categoria'?b.cat:'';
      var tagTxt=b.ok?(b.mins?b.mins+'m':'ok'):'quebrada';
      var col=b.ok?catColor(cat||''):'var(--danger)';
      h+='<div class="cup-cell"><button class="cup-slot" data-act="cup-info" data-id="'+b.id+'" aria-label="Detalhes da xícara">'+cupImg(b,'cup-img',false)+'</button><span class="cup-tag"><span class="cup-tag-dot" style="background:'+col+'"></span>'+esc(tagTxt)+'</span></div>';
    }else{
      h+='<div class="cup-cell"><span class="cup-slot empty" aria-hidden="true"></span></div>';
    }
  }
  return '<div class="tray"><div class="tray-head"><p class="tlabel">Conjunto '+(i+1)+(d?' · '+d:'')+'</p>'+(totMins?'<span class="tray-sum">'+fmtHM(totMins)+'</span>':'')+'</div><div class="cupgrid">'+h+'</div></div>';
}

/* Cenário 2.5D: O Balcão / Mesa da Cafeteria (estilo Forest) */
export function cafeSceneHTML(cups,periodLabel){
  var ok=0,bad=0,mins=0;
  cups.forEach(function(c){if(c.ok){ok++;mins+=(c.mins||0)}else bad++});

  var tableContent='';
  if(!cups.length){
    tableContent='<div class="cafe-empty">'+
      '<div class="cafe-empty-v60">'+v60CarafeSVG(false)+'</div>'+
      '<p class="small">Balcão pronto em <b>'+esc(periodLabel)+'</b>.<br>Cada foco concluído coloca uma xícara fumegante na mesa.</p>'+
    '</div>';
  }else{
    /* Divide as xícaras em bancadas de madeira (até 6 por bancada) */
    var rows=[],perRow=cups.length>18?7:cups.length>10?6:5;
    for(var i=0;i<cups.length;i+=perRow)rows.push(cups.slice(i,i+perRow));
    tableContent=rows.map(function(row){
      var items=row.map(function(b){
        var cat=b.cat&&b.cat!=='Sem categoria'?b.cat:'';
        var col=b.ok?catColor(cat||''):'var(--danger)';
        var lbl=b.ok?(b.mins?b.mins+'m':'ok'):'✕';
        return '<button class="cafe-cup'+(b.ok?'':' is-broken')+'" data-act="cup-info" data-id="'+b.id+'" aria-label="Xícara '+esc(cupMeta(b.model).name)+'">'+
          '<div class="cafe-cup-art">'+cupArtSVG(b.model,!b.ok)+'</div>'+
          '<span class="cafe-cup-badge"><i style="background:'+col+'"></i>'+esc(lbl)+'</span>'+
        '</button>';
      }).join('');
      return '<div class="cafe-shelf"><div class="cafe-shelf-cups">'+items+'</div><div class="cafe-wood-plank"></div></div>';
    }).join('');
  }

  return '<div class="cafe-scene">'+
    '<div class="cafe-ceiling">'+
      '<div class="cafe-lamp"><span class="lamp-cord"></span><span class="lamp-shade"></span><span class="lamp-glow"></span></div>'+
      '<div class="cafe-sign">'+esc(periodLabel)+'</div>'+
      '<div class="cafe-lamp"><span class="lamp-cord"></span><span class="lamp-shade"></span><span class="lamp-glow"></span></div>'+
    '</div>'+
    '<div class="cafe-stage">'+tableContent+'</div>'+
    '<div class="cafe-stats">'+
      '<span>☕ <b>'+ok+'</b> '+(ok===1?'inteira':'inteiras')+'</span>'+
      '<span>⏱️ <b>'+fmtHM(mins)+'</b></span>'+
      (bad?'<span class="bad">💔 <b>'+bad+'</b> '+(bad===1?'quebrada':'quebradas')+'</span>':'<span>✨ <b>0</b> quebradas</span>')+
    '</div>'+
  '</div>';
}

/* Calendário Mensal Visual estilo GymRats (a xícara do dia carimba o calendário!) */
export function gymRatsCalendarHTML(year,month,monthCups){
  var first=new Date(year,month,1),startDow=first.getDay();
  var daysInMonth=new Date(year,month+1,0).getDate();
  var byDay={};
  monthCups.forEach(function(c){(byDay[c.d]=byDay[c.d]||[]).push(c)});

  var hdr=DAYL.map(function(d){return '<div class="gr-dow">'+d+'</div>'}).join('');
  var cells='';
  for(var e=0;e<startDow;e++)cells+='<div class="gr-cell empty"></div>';

  var tKey=today(),activeDays=0;
  for(var d=1;d<=daysInMonth;d++){
    var dk=year+'-'+String(month+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    var list=byDay[dk]||[];
    var good=list.filter(function(x){return x.ok});
    var isToday=dk===tKey;
    if(list.length){
      if(good.length)activeDays++;
      /* Escolhe a xícara de maior duração do dia (ou a quebrada se só quebrou) */
      var rep=good.length?good.slice().sort(function(a,b){return (b.mins||0)-(a.mins||0)})[0]:list[0];
      var dayMins=0;good.forEach(function(x){dayMins+=(x.mins||0)});
      cells+='<button class="gr-cell has-cup'+(good.length?'':' only-broken')+(isToday?' today':'')+'" data-act="col-day" data-k="'+dk+'">'+
        '<span class="gr-num">'+d+'</span>'+
        (list.length>1?'<span class="gr-cnt">+'+(list.length-1)+'</span>':'')+
        '<div class="gr-cup">'+cupArtSVG(rep.model,!rep.ok)+'</div>'+
        '<span class="gr-min">'+(good.length?dayMins+'m':'quebrou')+'</span>'+
      '</button>';
    }else{
      cells+='<div class="gr-cell'+(isToday?' today':'')+'"><span class="gr-num">'+d+'</span></div>';
    }
  }
  return '<div class="gr-card">'+
    '<div class="gr-head"><h3>Calendário do Mês</h3><span class="tray-sum">'+pl(activeDays,'dia focado','dias focados')+'</span></div>'+
    '<div class="gr-grid">'+hdr+cells+'</div>'+
  '</div>';
}

/* Faixa dos 7 dias da Semana */
export function weekStripHTML(days,weekCups){
  var byDay={};
  weekCups.forEach(function(c){(byDay[c.d]=byDay[c.d]||[]).push(c)});
  var tKey=today();
  var cols=days.map(function(dk){
    var dt=parseKey(dk),list=byDay[dk]||[],good=list.filter(function(x){return x.ok});
    var rep=good.length?good[good.length-1]:list[0];
    var mins=0;good.forEach(function(x){mins+=(x.mins||0)});
    return '<button class="wk-col'+(dk===tKey?' today':'')+(list.length?' has-cup':'')+'" '+(list.length?'data-act="col-day" data-k="'+dk+'"':'')+'>'+
      '<span class="wk-day">'+DAYN[dt.getDay()]+'</span>'+
      '<span class="wk-date">'+dt.getDate()+'</span>'+
      '<div class="wk-cup">'+(rep?cupArtSVG(rep.model,!rep.ok):'<span class="wk-dot"></span>')+'</div>'+
      '<span class="wk-min">'+(mins?mins+'m':(list.length?'✕':'—'))+'</span>'+
    '</button>';
  }).join('');
  return '<div class="gr-card"><div class="gr-head"><h3>Dias da Semana</h3></div><div class="wk-strip">'+cols+'</div></div>';
}

/* Panorama dos 12 Meses do Ano */
export function yearGridHTML(year,yearCups){
  var cards=MSHORT.map(function(mName,mIdx){
    var prefix=year+'-'+String(mIdx+1).padStart(2,'0')+'-';
    var list=yearCups.filter(function(c){return c.d&&c.d.indexOf(prefix)===0});
    var good=list.filter(function(c){return c.ok});
    var mins=0;good.forEach(function(c){mins+=(c.mins||0)});
    var rep=good.length?good[good.length-1]:list[0];
    return '<div class="yr-cell'+(good.length?' active':'')+'">'+
      '<div class="yr-top"><b>'+mName+'</b>'+(good.length?'<span>☕ '+good.length+'</span>':'')+'</div>'+
      '<div class="yr-cup">'+(rep?cupArtSVG(rep.model,!rep.ok):'<span class="wk-dot"></span>')+'</div>'+
      '<span class="yr-min">'+(mins?fmtHM(mins):'sem foco')+'</span>'+
    '</div>';
  }).join('');
  return '<div class="gr-card"><div class="gr-head"><h3>Meses de '+year+'</h3></div><div class="yr-grid">'+cards+'</div></div>';
}

export function renderColecao(){
  var v=UI.colView||'mes';
  if(['semana','mes','ano','catalog'].indexOf(v)<0)v='mes';
  var off=UI.colOffset||0;
  var now=new Date(),tKey=today();
  var navHTML='',sceneHTML='',detailHTML='';

  if(v==='catalog'){
    var un=S.unlocked.length,tot=CUP_ASSETS.good.length;
    detailHTML='<div class="gr-card" style="margin-top:14px">'+
      '<div class="gr-head"><h3>Cerâmicas Especiais</h3><span class="tray-sum">'+un+' de '+tot+' desbloqueadas</span></div>'+
      '<div class="catalog">'+CUP_ASSETS.good.map(function(_,m){
        var got=S.unlocked.indexOf(m)>-1,n=S.cups.filter(function(c){return c.ok&&c.model===m}).length,meta=cupMeta(m);
        return '<div class="cat-item'+(got?'':' locked')+'">'+cupImg({ok:true,model:m,id:''},'cup-img',false)+'<p class="cat-name">'+(got?esc(meta.name):'???')+'</p><p class="muted small" style="font-size:11px">'+(got?esc(meta.desc)+' · '+pl(n,'feita','feitas'):'Conclua um foco')+'</p></div>';
      }).join('')+'</div>'+
    '</div>';
  }else if(v==='semana'){
    var baseMon=mondayOf(addDays(tKey,off*7));
    var wDays=[];for(var i=0;i<7;i++)wDays.push(addDays(baseMon,i));
    var wLabel=fmtShort(wDays[0])+' a '+fmtShort(wDays[6]);
    var wCups=S.cups.filter(function(c){return wDays.indexOf(c.d)>-1});
    navHTML='<div class="daynav" style="margin-top:12px"><button class="navb" data-act="col-prev" aria-label="Período anterior">&lsaquo;</button><div class="daylabel">Semana · '+wLabel+'</div><button class="navb" data-act="col-next" aria-label="Próximo período">&rsaquo;</button></div>';
    sceneHTML=cafeSceneHTML(wCups,'Mesa da Semana ('+wLabel+')');
    detailHTML=weekStripHTML(wDays,wCups);
  }else if(v==='ano'){
    var yr=now.getFullYear()+off;
    var yPrefix=yr+'-';
    var yCups=S.cups.filter(function(c){return c.d&&c.d.indexOf(yPrefix)===0});
    navHTML='<div class="daynav" style="margin-top:12px"><button class="navb" data-act="col-prev" aria-label="Ano anterior">&lsaquo;</button><div class="daylabel">Ano '+yr+'</div><button class="navb" data-act="col-next" aria-label="Próximo ano">&rsaquo;</button></div>';
    sceneHTML=cafeSceneHTML(yCups,'Cafeteria de '+yr);
    detailHTML=yearGridHTML(yr,yCups);
  }else{
    /* Mês (padrão: une a Mesa do Mês estilo Forest + Calendário GymRats) */
    var target=new Date(now.getFullYear(),now.getMonth()+off,1);
    var mYear=target.getFullYear(),mIdx=target.getMonth();
    var mPrefix=mYear+'-'+String(mIdx+1).padStart(2,'0')+'-';
    var mLabel=MONTHS[mIdx]+' '+mYear;
    var mCups=S.cups.filter(function(c){return c.d&&c.d.indexOf(mPrefix)===0});
    navHTML='<div class="daynav" style="margin-top:12px"><button class="navb" data-act="col-prev" aria-label="Mês anterior">&lsaquo;</button><div class="daylabel">'+mLabel+'</div><button class="navb" data-act="col-next" aria-label="Próximo mês">&rsaquo;</button></div>';
    sceneHTML=cafeSceneHTML(mCups,'Balcão de '+mLabel);
    detailHTML=gymRatsCalendarHTML(mYear,mIdx,mCups);
  }

  $('#tab-colecao').innerHTML=
    '<div class="hoje-top"><h1>Sua Cafeteria</h1><button class="btn quiet small" data-act="tab" data-tab="hoje">&larr; Voltar</button></div>'+
    seg('col-view',v,[['semana','Semana'],['mes','Mês'],['ano','Ano'],['catalog','Catálogo']])+
    navHTML+sceneHTML+detailHTML;
}
