import { esc, pl, uid, key, today, parseKey, addDays, fromMin, stripAcc } from './utils.js';
import { S, UI, save, toast, normTask, subjects } from './state.js';
import { render } from './app.js';

/* ---------- Google Agenda (OAuth via Google Identity Services + Calendar API v3) ---------- */
export var Integrations={googleCalendar:{
  origin:'https://vitinho12.github.io',
  clientId:'559268929436-vvaltsjeietmvhh2uor7m51asmn4u8a9.apps.googleusercontent.com',
  scopes:[
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar.readonly'
  ],
  windowDays:{back:7,ahead:30}
}};
export var GC=Integrations.googleCalendar;
var gcTok=null,gcExp=0,gcGisP=null;

export function gcResetToken(clearExp){gcTok=null;if(clearExp)gcExp=0}
export function gcCfg(){
  var c=S.integrations.googleCalendar||(S.integrations.googleCalendar={});
  if(c.push===undefined)c.push=true;
  if(!c.pendingDelete)c.pendingDelete=[];
  if(!c.moodleCals)c.moodleCals=[];
  if(!c.extraCals)c.extraCals=[];
  if(!c.selectedCals)c.selectedCals=['primary'];
  if(!c.availableCals)c.availableCals=[];
  c.clientId=c.clientId||GC.clientId||'';
  if(!c.status||(c.status==='off'&&c.clientId))c.status=c.clientId?'ready':'off';
  return c;
}
export function gcGisReady(){return !!(window.google&&google.accounts&&google.accounts.oauth2)}
export function gcLoadGIS(){
  if(gcGisReady())return Promise.resolve();
  if(gcGisP)return gcGisP;
  gcGisP=new Promise(function(res,rej){
    var s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.async=true;
    s.onload=function(){res()};s.onerror=function(){gcGisP=null;rej(new Error('gis-load'))};document.head.appendChild(s);
  });
  return gcGisP;
}
/* O pedido de token precisa nascer de um toque do usuário (por isso é chamado direto do clique). */
export function gcToken(){
  var cfg=gcCfg();
  if(gcTok&&Date.now()<gcExp-60000)return Promise.resolve(gcTok);
  if(!cfg.clientId)return Promise.reject(new Error('no-client'));
  if(!gcGisReady())return gcLoadGIS().then(function(){throw new Error('gis-loading')});
  return new Promise(function(res,rej){
    var tc=google.accounts.oauth2.initTokenClient({
      client_id:cfg.clientId,scope:GC.scopes.join(' '),
      callback:function(r){
        if(r.error)return rej(new Error(r.error));
        gcTok=r.access_token;gcExp=Date.now()+(r.expires_in||3600)*1000;cfg.status='connected';save();res(gcTok);
      },
      error_callback:function(e){rej(new Error((e&&e.type)||'popup_failed_to_open'))}
    });
    var pr=UI.gcSelect?'select_account':(cfg.status==='connected'?'':'consent');UI.gcSelect=false;tc.requestAccessToken({prompt:pr});
  });
}
export function gcFetch(path,opt){
  return gcToken().then(function(t){
    opt=opt||{};opt.headers={Authorization:'Bearer '+t,'Content-Type':'application/json'};
    return fetch('https://www.googleapis.com/calendar/v3'+path,opt).then(function(r){
      if(r.status===401){gcTok=null;gcExp=0;throw new Error('auth')}
      if(r.status===204)return null;
      return r.json().then(function(j){
        if(!r.ok){var e=new Error((j.error&&j.error.message)||('http-'+r.status));e.status=r.status;throw e}
        return j;
      });
    });
  });
}
export function gcFetchCalendars(){
  return gcFetch('/users/me/calendarList?minAccessRole=reader').then(function(res){
    var items=(res&&res.items)||[];
    var cfg=gcCfg();
    cfg.availableCals=items.map(function(item){
      return {
        id:item.id,
        summary:item.summaryOverride||item.summary||item.id,
        primary:!!item.primary,
        bg:item.backgroundColor||'#7B4F2E',
        fg:item.foregroundColor||'#ffffff',
        accessRole:item.accessRole||'reader'
      };
    });
    if(!cfg.selectedCals||!cfg.selectedCals.length){
      var def=['primary'];
      (cfg.extraCals||[]).forEach(function(ec){if(def.indexOf(ec)<0)def.push(ec)});
      cfg.selectedCals=def;
    }
    save();
    return cfg.availableCals;
  });
}
export function gcToggleCal(id,isMoodle){
  var cfg=gcCfg();
  if(isMoodle){
    if(!cfg.moodleCals)cfg.moodleCals=[];
    var mix=cfg.moodleCals.indexOf(id);
    if(mix>-1)cfg.moodleCals.splice(mix,1);
    else cfg.moodleCals.push(id);
  }else{
    if(!cfg.selectedCals)cfg.selectedCals=['primary'];
    var ix=cfg.selectedCals.indexOf(id);
    if(ix>-1){
      if(cfg.selectedCals.length>1)cfg.selectedCals.splice(ix,1);
      else toast('Mantenha pelo menos um calendário selecionado.');
    }else{
      cfg.selectedCals.push(id);
    }
  }
  save();
  render();
}
export function gcReloadCals(){
  if(UI.gcBusy)return;
  UI.gcBusy=true;render();
  gcFetchCalendars().then(function(cals){
    UI.gcBusy=false;
    toast(pl(cals.length,'calendário encontrado','calendários encontrados')+'.');
    render();
  },function(e){
    UI.gcBusy=false;
    UI.gcErr=gcMsg(e);
    render();
  });
}
export function gcSync(){
  var cfg=gcCfg(),from=addDays(today(),-GC.windowDays.back),to=addDays(today(),GC.windowDays.ahead);
  var tz=(window.Intl&&Intl.DateTimeFormat().resolvedOptions().timeZone)||'America/Sao_Paulo';
  var res={imp:0,created:0,deleted:0,skipped:0};
  var seq=function(arr,fn){return arr.reduce(function(p,x){return p.then(function(){return fn(x)})},Promise.resolve())};
  return gcToken().then(function(){
    /* atualiza lista de calendários se possível */
    return gcFetchCalendars().catch(function(){});
  }).then(function(){
    /* 1) apaga no Google o que foi removido aqui */
    return seq((cfg.pendingDelete||[]).slice(),function(id){
      return gcFetch('/calendars/primary/events/'+encodeURIComponent(id),{method:'DELETE'}).then(function(){res.deleted++},function(e){if(e.status!==404&&e.status!==410)throw e})
        .then(function(){cfg.pendingDelete=cfg.pendingDelete.filter(function(x){return x!==id})});
    });
  }).then(function(){
    /* 2) envia os blocos do Brewer que ainda não existem no Google */
    if(!cfg.push)return;
    var jobs=[];
    Object.keys(S.blocks).forEach(function(k){if(k<today()||k>to)return;S.blocks[k].forEach(function(b){if(b.source!=='gcal'&&!b.extId)jobs.push([k,b])})});
    return seq(jobs,function(j){
      var k=j[0],b=j[1];
      return gcFetch('/calendars/primary/events',{method:'POST',body:JSON.stringify({summary:b.title,start:{dateTime:k+'T'+b.start+':00',timeZone:tz},end:{dateTime:k+'T'+b.end+':00',timeZone:tz},extendedProperties:{private:{brewer:'1',brewerId:b.id}}})})
        .then(function(ev){b.extId=ev.id;res.created++});
    });
  }).then(function(){
    /* 3) importa os eventos do Google (calendário principal + extras; com horário e dia inteiro; todas as páginas) */
    var tmin=parseKey(from).toISOString(),tmax=parseKey(addDays(to,1)).toISOString();
    var listCal=function(calId){
      var all=[],meta=null,path='/calendars/'+encodeURIComponent(calId)+'/events?singleEvents=true&orderBy=startTime&maxResults=250&timeMin='+encodeURIComponent(tmin)+'&timeMax='+encodeURIComponent(tmax);
      var page=function(tok){
        return gcFetch(path+(tok?'&pageToken='+encodeURIComponent(tok):'')).then(function(r){
          if(!meta)meta={name:r.summary||calId,tz:r.timeZone||''};
          all=all.concat(r.items||[]);
          return (r.nextPageToken&&all.length<2500)?page(r.nextPageToken):all;
        });
      };
      return page('').then(function(items){items.forEach(function(ev){if(calId!=='primary')ev._cal=calId;if(mdSet[calId])ev._md=true});return {items:items,meta:meta}});
    };
    var got=[];res.cals=[];res.calErrors=[];
    var mdSet={};(cfg.moodleCals||[]).forEach(function(c){mdSet[c]=1});
    var calList=(cfg.selectedCals&&cfg.selectedCals.length)?cfg.selectedCals.slice():['primary'];
    (cfg.extraCals||[]).concat(cfg.moodleCals||[]).forEach(function(c){if(calList.indexOf(c)<0)calList.push(c)});
    return calList.reduce(function(p,cid){
      return p.then(function(){
        return listCal(cid).then(function(x){got=got.concat(x.items);res.cals.push({id:cid,name:x.meta.name,tz:x.meta.tz,n:x.items.length,md:!!mdSet[cid]})},function(e){
          if(cid==='primary')throw e;
          res.calErrors.push(cid+': '+(e.status===404?'calendário não encontrado':e.status===403?'sem permissão':e.message));
        });
      });
    },Promise.resolve()).then(function(){return got});
  }).then(function(items){
    var mine={};Object.keys(S.blocks).forEach(function(k){S.blocks[k].forEach(function(b){if(b.extId&&b.source!=='gcal')mine[b.extId]=1})});
    Object.keys(S.blocks).forEach(function(k){if(k>=from&&k<=to)S.blocks[k]=S.blocks[k].filter(function(b){return b.source!=='gcal'})});
    res.got=items.length;
    var add=function(d,b){if(d<from||d>to)return;(S.blocks[d]=S.blocks[d]||[]).push(b);res.imp++};
    items.forEach(function(ev){
      if(ev.status==='cancelled'||(!ev._cal&&mine[ev.id])||ev.eventType==='workingLocation')return;
      if(!ev.start||!ev.end){res.skipped++;return}
      var title=ev.summary||'(sem título)',d;
      if(ev.start.date){   /* dia inteiro: end.date é EXCLUSIVO; vale para vários dias */
        var last=ev.end.date||addDays(ev.start.date,1);
        for(d=ev.start.date;d<last&&d<addDays(ev.start.date,400);d=addDays(d,1))
          add(d,{id:'g_'+(ev._cal?ev._cal.replace(/[^a-z0-9]/gi,'')+'_':'')+ev.id+'_'+d,start:'00:00',end:'23:59',allDay:true,title:title,taskId:'',source:'gcal',extId:ev.id});
        return;
      }
      if(!ev.start.dateTime||!ev.end.dateTime){res.skipped++;return}
      var s=new Date(ev.start.dateTime),e=new Date(ev.end.dateTime);d=key(s);   /* dia no fuso do aparelho */
      for(var guard=0;guard<40;guard++){
        var ds=parseKey(d),de=new Date(ds.getFullYear(),ds.getMonth(),ds.getDate()+1);
        var a=s>ds?s:ds,z=e<de?e:de;
        var sm=a.getHours()*60+a.getMinutes(),em=(z>=de)?1439:z.getHours()*60+z.getMinutes();
        if(em<=sm)em=Math.min(1439,sm+15);   /* evento sem duração */
        add(d,{id:'g_'+(ev._cal?ev._cal.replace(/[^a-z0-9]/gi,'')+'_':'')+ev.id+'_'+d,start:fromMin(sm),end:fromMin(em),title:title,taskId:'',source:'gcal',extId:ev.id});
        if(e<=de)break;d=key(de);
      }
    });
    /* eventos dos calendários marcados como Moodle também alimentam Faculdade > Novos (os eventos continuam na Agenda) */
    var ml=[],present={},okCals={};
    res.cals.forEach(function(c){if(c.md)okCals[c.id]=1});
    items.forEach(function(ev){
      if(!ev._md||ev.status==='cancelled'||!ev.start)return;
      var x=Moodle.fromGoogleEvent(ev);if(!x)return;
      ml.push(x);present[x.extId]=1;(x.alt||[]).forEach(function(a){present[a]=1});
    });
    res.moodle=Object.keys(okCals).length?mdMerge(ml,{present:present,calIds:okCals,from:from,to:to}):null;
    cfg.lastSync=Date.now();cfg.lastResult=res;save();return res;
  });
}
export function gcMsg(e){
  var m=e&&e.message||'';
  if(m==='no-client')return 'Cole primeiro o Client ID do Google.';
  if(m==='gis-loading')return 'Preparando o login do Google. Toque de novo em alguns segundos.';
  if(m==='gis-load')return 'Não consegui carregar o login do Google. Verifique a internet.';
  if(m==='popup_closed'||m==='popup_failed_to_open')return 'A janela de login do Google não abriu ou foi fechada. No iPhone, na versão instalada, isso pode acontecer: tente abrir o Brewer pelo Safari.';
  if(m==='access_denied')return 'Permissão negada no Google.';
  if(m==='auth')return 'A sessão expirou. Toque em Sincronizar de novo.';
  if(e&&e.status===403)return 'O Google recusou (403). Confirme que a Google Calendar API está ativada e que sua conta está como usuário de teste.';
  if(m==='invalid_client'||m==='idpiframe_initialization_failed')return 'Client ID inválido ou origem não autorizada ('+GC.origin+').';
  return 'Falha ao sincronizar: '+m;
}
export function gcRun(){
  if(UI.gcBusy)return;
  UI.gcBusy=true;UI.gcErr='';
  var p=gcSync();            /* chamado antes de qualquer render, ainda dentro do toque */
  render();
  p.then(function(r){UI.gcBusy=false;toast('Sincronizado: '+pl(r.imp,'item importado','itens importados')+', '+pl(r.created,'bloco enviado','blocos enviados')+'.'+(r.moodle&&r.moodle.added?' '+r.moodle.added+' nova(s) em Projetos, Entrada.':''));render()},function(e){UI.gcBusy=false;UI.gcErr=gcMsg(e);render()});
}
export function gcDisconnect(){
  var cfg=gcCfg(),t=gcTok;gcTok=null;gcExp=0;cfg.status='ready';cfg.lastSync=0;
  Object.keys(S.blocks).forEach(function(k){S.blocks[k]=S.blocks[k].filter(function(b){return b.source!=='gcal'})});
  try{if(t&&gcGisReady())google.accounts.oauth2.revoke(t,function(){})}catch(e){}
  save();render();
}
export function gcalHint(k){
  if(gcCfg().status!=='connected')return '';
  var from=addDays(today(),-GC.windowDays.back),to=addDays(today(),GC.windowDays.ahead);
  return (k<from||k>to)?'<p class="small muted" style="margin-top:14px">Este dia está fora da janela de sincronização do Google (últimos '+GC.windowDays.back+' dias até '+GC.windowDays.ahead+' dias à frente).</p>':'';
}
export function gcDiag(){
  if(UI.gcBusy)return;
  UI.gcBusy=true;UI.gcErr='';
  var p=gcToken().then(function(){return gcFetch('/calendars/primary/events?maxResults=5&orderBy=updated&singleEvents=false&showDeleted=false')});
  render();
  p.then(function(r){
    UI.gcBusy=false;
    gcCfg().diag={t:Date.now(),name:r.summary||'',tz:r.timeZone||'',items:(r.items||[]).map(function(e){return {t:e.summary||'(sem título)',d:(e.start&&(e.start.dateTime||e.start.date))||'',r:!!e.recurrence}})};
    save();render();
  },function(e){UI.gcBusy=false;UI.gcErr=gcMsg(e);render()});
}
export function diagHTML(dg){
  var t=new Date(dg.t).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  var head='<div class="nudge small" style="margin-top:12px"><b>Diagnóstico ('+t+')</b><br>Calendário principal lido: <b>'+esc(dg.name||'(sem nome)')+'</b>'+(dg.tz?', fuso '+esc(dg.tz):'')+'.<br>';
  if(!dg.items.length)return head+'Nenhum evento encontrado neste calendário. Provavelmente você entrou com outra conta do Google, ou seus compromissos estão em outro calendário. Toque em &ldquo;Trocar conta do Google&rdquo; ou cole o ID do outro calendário abaixo.</div>';
  return head+'Eventos alterados mais recentemente: '+dg.items.map(function(e){return esc(e.t)+' ('+esc(String(e.d).slice(0,10))+(e.r?', recorrente':'')+')'}).join('; ')+'.<br>Se essas datas estão fora da janela de sincronização, eles não aparecem na agenda.</div>';
}
export function gcalPanelHTML(){
  var cfg=gcCfg(),h='<div class="gc"><h3>Google Agenda</h3>';
  if(!cfg.clientId){
    return h+'<p class="small muted" style="margin-top:6px">Para conectar, cole o OAuth Client ID (aplicativo da Web) do seu projeto no Google Cloud. Origem autorizada: '+esc(GC.origin)+'.</p>'+
      '<input class="field" id="gcClientId" placeholder="xxxx.apps.googleusercontent.com" autocomplete="off" autocapitalize="off" spellcheck="false" style="margin-top:10px"><div class="row"><button class="btn small" data-act="gc-save-id">Salvar Client ID</button></div></div>';
  }
  gcLoadGIS().catch(function(){});
  var st=cfg.status==='connected'?'Conectado.':'Pronto para conectar.';
  var last=cfg.lastSync?' Última sincronização: '+new Date(cfg.lastSync).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})+(cfg.lastResult?' ('+(cfg.lastResult.got!==undefined?'Google retornou '+cfg.lastResult.got+'; ':'')+pl(cfg.lastResult.imp,'item importado','itens importados')+', '+pl(cfg.lastResult.created,'enviado','enviados')+').':'.'):'';
  h+='<p class="small muted" style="margin-top:6px">'+st+last+' Janela: últimos 7 dias até 30 dias à frente, calendário principal. Eventos de dia inteiro aparecem como &ldquo;Dia todo&rdquo;.</p>';
  if(cfg.lastResult&&cfg.lastResult.cals)h+='<p class="small" style="margin-top:8px">Calendários lidos: '+cfg.lastResult.cals.map(function(c){return '<b>'+esc(c.name)+'</b> ('+pl(c.n,'evento','eventos')+(c.tz?', fuso '+esc(c.tz):'')+(c.md?', Gerar Tarefas':'')+')'}).join('; ')+'.</p>';
  if(cfg.lastResult&&cfg.lastResult.moodle){var mo=cfg.lastResult.moodle;h+='<p class="small" style="margin-top:8px">Tarefas importadas: <b>'+mo.added+' nova(s)</b> em Projetos > Entrada; '+mo.updated+' já existentes'+(mo.gone?'; '+mo.gone+' não apareceram mais':'')+'.</p>'}
  if(cfg.lastResult&&cfg.lastResult.calErrors&&cfg.lastResult.calErrors.length)h+='<div class="nudge small" style="margin-top:8px">'+esc(cfg.lastResult.calErrors.join(' | '))+'</div>';
  if(cfg.diag)h+=diagHTML(cfg.diag);
  if(UI.gcErr)h+='<div class="nudge small" style="margin-top:12px">'+esc(UI.gcErr)+'</div>';
  h+='<div class="row">'+(UI.gcBusy?'<button class="btn small" disabled>Sincronizando...</button>':'<button class="btn small" data-act="gc-sync">'+(cfg.status==='connected'?'Sincronizar agora':'Conectar e sincronizar')+'</button>');
  if(cfg.status==='connected'&&!UI.gcBusy)h+='<button class="btn quiet small" data-act="gc-diag">Diagnosticar</button><button class="btn quiet small" data-act="gc-switch">Trocar conta do Google</button><button class="btn quiet small" data-act="gc-disconnect">Desconectar</button>';
  h+='</div><label class="check-row"><input type="checkbox" id="gcPush"'+(cfg.push?' checked':'')+'> Enviar os blocos do Brewer para o Google</label>'+
    '<p class="small muted">Eventos do Google aparecem na agenda com a marca Google e são editados lá. Blocos criados no Brewer viram eventos no Google.</p>';

  if(cfg.status==='connected'){
    if(cfg.availableCals&&cfg.availableCals.length){
      h+='<div style="margin-top:20px"><label class="flabel" style="margin-bottom:4px">Seus calendários do Google</label>'+
        '<p class="small muted" style="margin-bottom:12px">Marque quais você quer sincronizar na agenda do Brewer:</p>'+
        '<div style="display:grid;gap:10px">'+
        cfg.availableCals.map(function(c){
          var sel=(cfg.selectedCals||['primary']).indexOf(c.id)>-1||(c.primary&&(cfg.selectedCals||[]).indexOf('primary')>-1);
          var isMd=(cfg.moodleCals||[]).indexOf(c.id)>-1;
          return '<div style="padding:12px 14px;background:var(--surface);border:1px solid var(--line);border-radius:14px;display:flex;align-items:center;justify-content:space-between;gap:10px">'+
            '<label style="display:flex;align-items:center;gap:10px;cursor:pointer;flex:1;min-width:0">'+
              '<input type="checkbox" data-act="gc-toggle-cal" data-id="'+esc(c.id)+'"'+(sel?' checked':'')+' style="width:20px;height:20px;accent-color:var(--sea);flex:none">'+
              '<span style="width:12px;height:12px;border-radius:50%;background:'+esc(c.bg)+';flex:none"></span>'+
              '<span style="font-size:15px;font-weight:600;line-height:1.2;word-break:break-word">'+esc(c.summary)+(c.primary?' <span class="muted small" style="font-weight:400">(Principal)</span>':'')+'</span>'+
            '</label>'+
            '<button class="ghost small" data-act="gc-toggle-md" data-id="'+esc(c.id)+'" style="font-size:12px;padding:5px 10px;border-radius:99px;border:1px solid '+(isMd?'var(--sea)':'var(--line)')+';background:'+(isMd?'var(--sea-soft)':'transparent')+';color:'+(isMd?'var(--ink)':'var(--muted)')+';flex:none;font-weight:600;min-height:30px">'+(isMd?'✓ Gerar Tarefas':'Gerar Tarefas')+'</button>'+
          '</div>';
        }).join('')+
        '</div><div class="row" style="margin-top:10px"><button class="ghost small" data-act="gc-reload-cals">Atualizar lista de calendários</button></div></div>';
    } else {
      h+='<div class="nudge small" style="margin-top:16px"><p>Quer escolher quais calendários puxar?</p><div class="row" style="margin-top:8px"><button class="btn quiet small" data-act="gc-reload-cals">Buscar meus calendários do Google</button></div></div>';
    }
  }

  h+='<details style="margin-top:20px;font-size:13px;color:var(--muted)">'+
    '<summary style="cursor:pointer;padding:6px 0;font-weight:600">Configurações manuais de ID (avançado)</summary>'+
    '<label class="flabel" for="gcExtra" style="margin-top:10px">Outros calendários (IDs manuais)</label><input class="field" id="gcExtra" value="'+esc((cfg.extraCals||[]).join(', '))+'" placeholder="IDs separados por vírgula" autocomplete="off" autocapitalize="off" spellcheck="false">'+
    '<label class="flabel" for="gcMoodle" style="margin-top:14px">Calendários para gerar tarefas (IDs manuais)</label><input class="field" id="gcMoodle" value="'+esc((cfg.moodleCals||[]).join(', '))+'" placeholder="IDs separados por vírgula" autocomplete="off" autocapitalize="off" spellcheck="false">'+
    '<div class="row" style="margin-top:8px"><button class="ghost small" data-act="gc-change-id">Trocar Client ID</button></div>'+
  '</details></div>';
  return h;
}
export function gcMoodleReady(){var c=gcCfg();return !!(c.clientId&&c.moodleCals&&c.moodleCals.length)}
export function moodlePanelHTML(){
  var m=S.moodle,h='<div class="gc" style="margin-top:14px"><h3>Importar Tarefas Externas</h3><p class="small muted" style="margin-top:6px">Atividades de calendários da Agenda ou arquivos .ics chegam aqui em <b>Entrada</b> e só viram tarefas depois que você confirmar.</p><div class="row"><button class="btn small" data-act="md-ics">Importar arquivo (.ics)</button>';
  if(gcMoodleReady())h+='<button class="btn quiet small" data-act="gc-sync"'+(UI.gcBusy?' disabled':'')+'>'+(UI.gcBusy?'Sincronizando...':'Atualizar pela Agenda')+'</button>';
  h+='</div><input type="file" id="mdIcs" accept=".ics,text/calendar,text/plain" style="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none" tabindex="-1">';
  if(m.lastResult)h+='<p class="small muted" style="margin-top:8px">Última importação: '+new Date(m.lastSync).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})+' ('+m.lastResult.added+' novas, '+m.lastResult.updated+' já em Entrada, '+m.lastResult.skipped+' já tratadas ou antigas).</p>';
  if(UI.mdErr)h+='<div class="nudge small" style="margin-top:10px">'+esc(UI.mdErr)+'</div>';
  return h+'</div>';
}

/* ---------- Moodle (camada de integração separada) ---------- */
export var Moodle={
  /* 1) arquivo .ics exportado do calendário do Moodle: funciona sem senha, token ou servidor */
  parseICS:function(txt){
    var lines=String(txt).replace(/\r\n?/g,'\n').replace(/\n[ \t]/g,'').split('\n'),ev=null,out=[];
    var unesc=function(v){return v.replace(/\\n/gi,'\n').replace(/\\,/g,',').replace(/\\;/g,';').replace(/\\\\/g,'\\')};
    lines.forEach(function(l){
      if(l==='BEGIN:VEVENT'){ev={};return}
      if(l==='END:VEVENT'){if(ev)out.push(ev);ev=null;return}
      if(!ev)return;var i=l.indexOf(':');if(i<0)return;
      ev[l.slice(0,i).split(';')[0].toUpperCase()]=unesc(l.slice(i+1));
    });
    var pdt=function(v){
      var m=/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec((v||'').trim());if(!m)return null;
      var d=m[7]?new Date(Date.UTC(+m[1],+m[2]-1,+m[3],+m[4]||0,+m[5]||0,+m[6]||0)):new Date(+m[1],+m[2]-1,+m[3],+m[4]||0,+m[5]||0,+m[6]||0);
      return {k:key(d),t:m[4]!==undefined?fromMin(d.getHours()*60+d.getMinutes()):''};
    };
    var dkey=function(v){var p=pdt(v);return p?p.k:''},tkey=function(v){var p=pdt(v);return p?p.t:''};
    return out.filter(function(e){return e.UID&&e.SUMMARY}).map(function(e){
      var u=(/https?:\/\/[^\s<>")]+/.exec(e.DESCRIPTION||'')||[''])[0];
      return {extId:'moodle:'+e.UID,title:e.SUMMARY.replace(/\s+(est[aá] marcad[oa]\(a\) para esta data|is due|vence)\s*$/i,'').trim(),subject:(e.CATEGORIES||'').split(',')[0].trim(),due:dkey(e.DTSTART)||dkey(e.DTEND),dueTime:dkey(e.DTSTART)?tkey(e.DTSTART):tkey(e.DTEND),url:e.URL||u,note:'',via:'ics'};
    });
  },
  /* 2) Web Services do Moodle (precisa de URL + token do usuário; o Moodle da faculdade pode bloquear por CORS) */
  fetchUpcoming:function(cfg){
    if(!cfg.baseUrl||!cfg.token)return Promise.reject(new Error('md-config'));
    var base=cfg.baseUrl.replace(/\/+$/,''),from=Math.floor(Date.now()/1000)-14*86400,to=from+194*86400,all=[];
    var page=function(after,n){
      var b=new URLSearchParams({wstoken:cfg.token,wsfunction:'core_calendar_get_action_events_by_timesort',moodlewsrestformat:'json',timesortfrom:String(from),timesortto:String(to),limitnum:'50'});
      if(after)b.set('aftereventid',String(after));
      return fetch(base+'/webservice/rest/server.php',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:b.toString()}).then(function(r){return r.json()}).then(function(j){
        if(j&&(j.exception||j.errorcode)){var e=new Error(j.message||j.errorcode);e.code=j.errorcode;throw e}
        var ev=(j&&j.events)||[];all=all.concat(ev);
        return (ev.length>=50&&n<6)?page(ev[ev.length-1].id,n+1):all;
      });
    };
    return page(0,0).then(function(evs){return evs.map(function(e){
      return {extId:'moodle:'+e.id,title:(e.activityname||e.name||'').trim(),subject:(e.course&&(e.course.fullname||e.course.shortname))||'',due:e.timesort?key(new Date(e.timesort*1000)):'',dueTime:e.timesort?(function(d){return fromMin(d.getHours()*60+d.getMinutes())})(new Date(e.timesort*1000)):'',url:e.url||'',note:'',via:'api'};
    })});
  },
  /* Moodle via Google Agenda: normaliza um evento do Google para o MESMO formato de item de Novos usado pelo .ics e pela API */
  plain:function(h){return String(h||'').replace(/<br\s*\/?>/gi,'\n').replace(/<\/(p|div|li)>/gi,'\n').replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'")},
  fromGoogleEvent:function(ev){
    if(!ev||!ev.start)return null;
    var calId=ev._cal||'primary',due='',tm='';
    if(ev.start.date)due=ev.start.date;
    else if(ev.start.dateTime){var s0=new Date(ev.start.dateTime);due=key(s0);tm=fromMin(s0.getHours()*60+s0.getMinutes())}
    if(!due)return null;
    var raw=String(ev.description||''),txt=Moodle.plain(raw);
    var title=Moodle.plain(ev.summary||'').replace(/\s+(est[aá] marcad[oa]\(a\) para esta data|is due|vence)\s*$/i,'').trim()||'(sem título)';
    var um=/https?:\/\/[^\s<>"')]+/.exec(raw),url=((ev.source&&ev.source.url)||(um?um[0]:'')).replace(/&amp;/g,'&');
    var subject='',cm=/^\s*(?:curso|course|disciplina)\s*:\s*(.+)$/im.exec(txt);
    if(cm&&cm[1].trim())subject=cm[1].trim().slice(0,80);
    else{var hay=stripAcc(title+' '+txt).toLowerCase();subjects().sort(function(a,b){return b.length-a.length}).some(function(sj){var q=stripAcc(sj).toLowerCase();if(q&&hay.indexOf(q)>-1){subject=sj;return true}return false})}
    var gk='gcal:'+calId+':'+ev.id,inst=ev.recurringEventId?('@'+due):'';
    var ext=ev.iCalUID?('moodle:'+ev.iCalUID+inst):gk;
    return {extId:ext,alt:ext===gk?[]:[gk],title:title,subject:subject,due:due,dueTime:tm,url:url,note:'',via:'google',calId:calId};
  }
};
export function mdKeys(x){return [x.extId].concat(x.alt||[]).filter(Boolean)}
export function mdMerge(list,opts){
  var r={added:0,updated:0,skipped:0,gone:0},m=S.moodle,limit=addDays(today(),-14);
  list.forEach(function(x){
    var ks=mdKeys(x);
    if(!ks.length||!x.title){r.skipped++;return}
    if(ks.some(function(k){return m.ignored[k]||m.confirmed[k]})){r.skipped++;return}
    if(x.due&&x.due<limit){r.skipped++;return}
    var ex=S.inbox.find(function(i){var ik=mdKeys(i);return ks.some(function(k){return ik.indexOf(k)>-1})});
    if(ex){
      ks.forEach(function(k){if(k!==ex.extId&&(ex.alt=ex.alt||[]).indexOf(k)<0)ex.alt.push(k)});
      if(!ex.edited){ex.title=x.title;if(x.subject)ex.subject=x.subject;ex.due=x.due;ex.dueTime=x.dueTime||'';ex.url=x.url||ex.url}
      ex.gone=false;r.updated++;return;
    }
    S.inbox.push({id:uid(),extId:x.extId,alt:(x.alt||[]).slice(),title:x.title,subject:x.subject||'',due:x.due||'',dueTime:x.dueTime||'',est:0,prio:2,note:x.note||'',url:x.url||'',source:'moodle',via:x.via||'ics',calId:x.calId||'',createdAt:Date.now(),edited:false,gone:false});r.added++;
  });
  if(opts&&opts.present){
    S.inbox.forEach(function(it){
      if(it.via!=='google'||!opts.calIds[it.calId])return;
      if(mdKeys(it).some(function(k){return opts.present[k]}))it.gone=false;
      else if(it.due&&it.due>=opts.from&&it.due<=opts.to){it.gone=true;r.gone++}
    });
  }
  return r;
}
export function mdMsg(e){
  var m=(e&&e.message)||'',c=e&&e.code;
  if(m==='md-config')return 'Preencha o endereço e o token em Conexão direta.';
  if(c==='invalidtoken'||/invalid token/i.test(m))return 'Token inválido ou expirado. Gere outro no Moodle.';
  if(c==='accessexception'||c==='servicenotavailable'||c==='nopermissions')return 'O Moodle recusou: o token não tem permissão para ler o calendário (função core_calendar_get_action_events_by_timesort).';
  if(e instanceof TypeError||/Failed to fetch|NetworkError|Load failed/i.test(m))return 'O navegador não conseguiu falar com o Moodle. Isso costuma ser o bloqueio de segurança (CORS): o Moodle da faculdade precisa autorizar este endereço, ou é preciso um intermediário. Enquanto isso, use Importar arquivo .ics.';
  return 'Falha ao atualizar do Moodle: '+m;
}
export function mdSync(){
  if(UI.mdBusy)return;
  UI.mdBusy=true;UI.mdErr='';var p=Moodle.fetchUpcoming(S.moodle);render();
  p.then(function(list){UI.mdBusy=false;var r=mdMerge(list);S.moodle.lastSync=Date.now();S.moodle.lastResult=r;save();toast(r.added+' nova(s) em Entrada.');render()},function(e){UI.mdBusy=false;UI.mdErr=mdMsg(e);render()});
}
export function mdFile(inp){
  var f=inp.files&&inp.files[0];if(!f)return;
  var rd=new FileReader();
  rd.onload=function(){
    UI.mdErr='';
    try{var list=Moodle.parseICS(String(rd.result||''));var r=mdMerge(list);S.moodle.lastSync=Date.now();S.moodle.lastResult=r;save();
      if(!list.length)UI.mdErr='Não encontrei atividades nesse arquivo. Confirme que é um arquivo .ics válido.';else toast(r.added+' nova(s) em Entrada.')}
    catch(e){UI.mdErr='Não consegui ler o arquivo .ics.'}
    try{inp.value=''}catch(e){}render();
  };
  rd.onerror=function(){UI.mdErr='Não consegui abrir o arquivo.';render()};
  rd.readAsText(f);
}
export function confirmInbox(it){
  var t=normTask({id:uid(),text:it.title,done:false,doneAt:'',due:it.due||'',dueTime:it.dueTime||'',prio:it.prio||2,plan:'',spent:0,cat:'',kind:'faculdade',subject:it.subject||'',est:it.est||0,note:it.note||'',origin:'moodle',extId:it.extId||'',url:it.url||'',createdAt:Date.now()});
  S.tasks.push(t);S.inbox=S.inbox.filter(function(x){return x.id!==it.id});
  mdKeys(it).forEach(function(k){S.moodle.confirmed[k]=t.id});
  return t;
}
export function ignoreInbox(it){
  S.inbox=S.inbox.filter(function(x){return x.id!==it.id});
  var ks=mdKeys(it);if(!ks.length)ks=['local:'+it.id];
  ks.forEach(function(k){S.moodle.ignored[k]={t:Date.now(),item:it}});
}
