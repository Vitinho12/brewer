import { $, esc, pl, fmtShort, fmtHM, seg } from '../utils.js';
import { S, UI, CUP_ASSETS, cupMeta, cupImg, catColor, chunk } from '../state.js';

/* ---------- COLEÇÃO (Com etiquetas visuais e resumo por bandeja) ---------- */
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
export function renderColecao(){
  var ch=chunk(S.cups),ok=S.cups.filter(function(b){return b.ok}).length,bad=S.cups.length-ok;
  if(!ch.length)ch.push([]);
  var body;
  if(UI.colView==='catalog'){
    body='<div class="catalog">'+CUP_ASSETS.good.map(function(_,m){
      var got=S.unlocked.indexOf(m)>-1,n=S.cups.filter(function(c){return c.ok&&c.model===m}).length,meta=cupMeta(m);
      return '<div class="cat-item'+(got?'':' locked')+'">'+cupImg({ok:true,model:m,id:''},'cup-img',false)+'<p class="cat-name">'+(got?esc(meta.name):'?')+'</p><p class="muted small">'+(got?pl(n,'xícara','xícaras'):'Conclua um bloco')+'</p></div>';
    }).join('')+'</div>';
  }else if(UI.colView==='all')body=ch.map(tray).join('');
  else body=tray(ch[ch.length-1],ch.length-1);
  $('#tab-colecao').innerHTML='<h1>Coleção</h1><p class="lead">'+(S.cups.length?pl(ok,'xícara inteira','xícaras inteiras')+' e '+pl(bad,'quebrada','quebradas')+'. Toque numa xícara para ver a tarefa, categoria e duração.':'As xícaras dos seus blocos de foco aparecem aqui. Blocos a partir de 15 minutos geram uma xícara.')+'</p>'+
    seg('col-view',UI.colView,[['set','Conjunto atual'],['all','Todos'],['catalog','Catálogo']])+body;
}
