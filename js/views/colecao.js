import { $, esc, pl, fmtShort, seg } from '../utils.js';
import { S, UI, CUP_ASSETS, cupMeta, cupImg, chunk } from '../state.js';

/* ---------- COLEÇÃO ---------- */
export function tray(c,i){
  var d=c.length?fmtShort(c[0].d)+' a '+fmtShort(c[c.length-1].d):'',h='';
  for(var j=0;j<7;j++)h+=c[j]?'<button class="cup-slot" data-act="cup-info" data-id="'+c[j].id+'" aria-label="Detalhes da xícara">'+cupImg(c[j],'cup-img',false)+'</button>':'<span class="cup-slot empty" aria-hidden="true"></span>';
  return '<div class="tray"><p class="tlabel">Conjunto '+(i+1)+(d?', '+d:'')+'</p><div class="cupgrid">'+h+'</div></div>';
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
  $('#tab-colecao').innerHTML='<h1>Coleção</h1><p class="lead">'+(S.cups.length?pl(ok,'xícara inteira','xícaras inteiras')+' e '+pl(bad,'quebrada','quebradas')+'. Toque numa xícara para ver os detalhes.':'As xícaras dos seus blocos de foco aparecem aqui. Blocos a partir de 15 minutos geram uma xícara.')+'</p>'+
    seg('col-view',UI.colView,[['set','Conjunto atual'],['all','Todos'],['catalog','Catálogo']])+body;
}
