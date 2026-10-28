import { today, addDays, fromMin, nowMin, mondayOf } from './utils.js';
import { S, planned, save, onStateSave } from './state.js';
import { freeWindows, taskScore } from './views/agenda.js';
import { DEFAULT_PUSH_SERVER } from './notifications.js';

var _syncTimer = null;

/**
 * Marca que o usuário abriu o app no início da manhã.
 * Se o usuário abriu entre 05:00 e 07:35, cancela o push matinal de hoje
 * para não incomodar quem já acordou e está usando o app.
 */
export function recordMorningActivity() {
  var d = new Date();
  var h = d.getHours();
  var m = d.getMinutes();
  var totalMin = h * 60 + m;
  // Se abriu entre 05:00 (300 min) e 07:35 (455 min)
  if (totalMin >= 300 && totalMin <= 455) {
    if (S.morningSeen !== today()) {
      S.morningSeen = today();
      save();
    }
  }
}

/**
 * Analisa a agenda, as tarefas pendentes e o ritmo da semana
 * para gerar os 3 gatilhos inteligentes do Brewer.
 */
export function generateSmartTriggers() {
  var triggers = [];
  var now = new Date();
  var curKey = today();

  // ----------------------------------------------------
  // 1. O CONVITE DA MANHÃ (07:30 BRT)
  // ----------------------------------------------------
  var today730 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7, 30, 0, 0);
  var targetMorningDate = null;
  var targetDayKey = '';

  if (now.getTime() < today730.getTime() && S.morningSeen !== curKey) {
    // Ainda não deu 07:30 hoje e o usuário não abriu o app cedo: agenda para hoje às 07:30
    targetMorningDate = today730;
    targetDayKey = curKey;
  } else {
    // Já passou das 07:30 de hoje (ou já abriu cedo): agenda para amanhã às 07:30
    var tom = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 7, 30, 0, 0);
    targetMorningDate = tom;
    targetDayKey = addDays(curKey, 1);
  }

  if (targetMorningDate) {
    var p = planned(targetDayKey);
    var morningTitle = '☕ Bom dia · Brewer';
    var morningBody = '';

    if (p.length > 0) {
      var names = p.slice(0, 2).map(function(t) { return t.text; }).join(' e ');
      morningBody = 'Suas metas de hoje estão prontas: ' + names + '. Pronto para o primeiro café?';
    } else {
      morningBody = 'Um momento tranquilo para tomar um café e definir o foco de hoje.';
    }

    triggers.push({
      id: 'morning_' + targetDayKey,
      time: targetMorningDate.getTime(),
      title: morningTitle,
      body: morningBody,
      tag: 'brewer-morning'
    });
  }

  // ----------------------------------------------------
  // 2. JANELA DE OPORTUNIDADE (Blocos livres na Agenda)
  // ----------------------------------------------------
  var currentMin = nowMin();
  var searchFromMin = Math.max(8 * 60, currentMin + 15);
  var windows = freeWindows(curKey, searchFromMin);

  // Filtra janelas livres relevantes: >= 40 min e que comecem antes das 19:00
  var goodWindow = windows.filter(function(w) {
    return (w[1] - w[0]) >= 40 && w[0] <= 19 * 60;
  })[0];

  if (goodWindow) {
    var already = (S.blocks[curKey] || []).map(function(b) { return b.taskId; }).filter(Boolean);
    var candidates = S.tasks
      .filter(function(t) { return !t.done && already.indexOf(t.id) < 0; })
      .sort(function(a, b) { return taskScore(b, curKey) - taskScore(a, curKey); });

    var topTask = candidates[0];
    if (topTask) {
      var wStart = goodWindow[0];
      var wLen = goodWindow[1] - goodWindow[0];
      var durStr = wLen >= 60 
        ? Math.floor(wLen / 60) + 'h' + (wLen % 60 ? (wLen % 60) + 'm' : '') 
        : wLen + ' min';

      var winDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), Math.floor(wStart / 60), wStart % 60, 0, 0);

      if (winDate.getTime() > Date.now() + 10 * 60 * 1000) {
        triggers.push({
          id: 'window_' + curKey + '_' + wStart,
          time: winDate.getTime(),
          title: '⏳ Janela livre às ' + fromMin(wStart) + ' · Brewer',
          body: 'Você tem ' + durStr + ' livres. Que tal adiantar "' + topTask.text + '" antes do próximo compromisso?',
          tag: 'brewer-smart-window'
        });
      }
    }
  }

  // ----------------------------------------------------
  // 3. RITMO & RETOMADA (Domingo às 20:30 BRT)
  // ----------------------------------------------------
  var daysUntilSunday = (7 - now.getDay()) % 7;
  var targetSunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilSunday, 20, 30, 0, 0);
  if (targetSunday.getTime() <= now.getTime()) {
    targetSunday.setDate(targetSunday.getDate() + 7);
  }

  var mon = mondayOf(curKey);
  var weekCups = (S.cups || []).filter(function(c) {
    return c.d >= mon && c.ok;
  }).length;

  var sunTitle = '';
  var sunBody = '';
  if (weekCups >= 5) {
    sunTitle = '🌙 Semana com ritmo · Brewer';
    sunBody = 'Você completou ' + weekCups + ' xícaras de foco esta semana! Aproveite o descanso deste domingo com a mente tranquila.';
  } else {
    sunTitle = '🌙 Recomeço gentil · Brewer';
    sunBody = 'Semanas mais puxadas acontecem com todo mundo. Amanhã é segunda-feira: uma página em branco para recomeçar no seu ritmo.';
  }

  triggers.push({
    id: 'sunday_' + targetSunday.toISOString().slice(0, 10),
    time: targetSunday.getTime(),
    title: sunTitle,
    body: sunBody,
    tag: 'brewer-sunday'
  });

  return triggers;
}

/**
 * Envia silenciosamente o cronograma inteligente calculado para o Cloudflare Worker.
 * Debounced em 3 segundos para evitar sobrecarga.
 */
export function scheduleSmartSync() {
  if (!S.pushSubscribed) return;
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  if (_syncTimer) clearTimeout(_syncTimer);
  _syncTimer = setTimeout(async function() {
    try {
      var reg = await navigator.serviceWorker.ready;
      var sub = await reg.pushManager.getSubscription();
      if (!sub) return;

      var server = (S.pushServerUrl || DEFAULT_PUSH_SERVER).trim().replace(/\/+$/, '');
      if (!server) return;

      var triggers = generateSmartTriggers();

      await fetch(server + '/sync-smart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: sub,
          triggers: triggers
        })
      });
    } catch(err) {
      console.warn('Erro ao sincronizar notificações inteligentes:', err);
    }
  }, 3000);
}

// Ouve qualquer alteração de estado (tarefas concluídas, agenda alterada) e atualiza o cronograma inteligente
onStateSave(scheduleSmartSync);
