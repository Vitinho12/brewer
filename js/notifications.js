import { S, toast, save } from './state.js';
import { render } from './app.js';
import { esc } from './utils.js';
import { scheduleSmartSync } from './smart-push.js';

export var VAPID_PUBLIC_KEY = 'BO9XJIFxJG6y9AA-Pg8cEgK2nLk9yoEgekLsZb92VyxKAeFeRyym4kINuLxZ7teFrVoaO6Vm2hTeGywRaoDC_W8';
export var DEFAULT_PUSH_SERVER = 'https://brewer-push.victor120702.workers.dev';

export function isNotifySupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notifyPermission() {
  if (!isNotifySupported()) return 'unsupported';
  return Notification.permission;
}

function urlB64ToUint8Array(base64String) {
  var padding = '='.repeat((4 - base64String.length % 4) % 4);
  var base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  var rawData = window.atob(base64);
  var outputArray = new Uint8Array(rawData.length);
  for (var i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function requestNotifyPermission() {
  if (!isNotifySupported()) {
    toast('Notificações não são suportadas neste navegador.');
    return 'unsupported';
  }
  try {
    var perm = await Notification.requestPermission();
    if (perm === 'granted') {
      toast('🔔 Notificações ativadas no dispositivo!');
      showNotification('☕ Notificações ativadas no Brewer', {
        body: 'Você receberá alertas de foco, término de pausas e lembretes diários!',
        tag: 'brewer-welcome',
        silent: false
      });
    } else if (perm === 'denied') {
      toast('Notificações bloqueadas nas configurações do navegador/iOS.');
    }
    render();
    return perm;
  } catch (err) {
    console.warn('Erro ao solicitar permissão de notificação:', err);
    return 'default';
  }
}

export async function subscribeWebPush(customServerUrl) {
  if (!isNotifySupported()) {
    toast('Notificações não suportadas.');
    return false;
  }

  var perm = await requestNotifyPermission();
  if (perm !== 'granted') {
    toast('Permissão de notificações não concedida.');
    return false;
  }

  if (!('serviceWorker' in navigator)) {
    toast('Service Worker não encontrado.');
    return false;
  }

  try {
    toast('Conectando push do iPhone...');
    var reg = await navigator.serviceWorker.ready;
    var sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY)
    });

    var server = (customServerUrl || S.pushServerUrl || DEFAULT_PUSH_SERVER).trim();
    if (server) {
      server = server.replace(/\/+$/, '');
      var res = await fetch(server + '/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub })
      });
      if (res.ok) {
        S.pushSubscribed = true;
        S.pushServerUrl = server;
        save();
        toast('✅ Notificações conectadas com sucesso!');
        render();
        scheduleSmartSync();
        return true;
      } else {
        toast('Erro ao cadastrar no servidor de push.');
      }
    } else {
      S.pushSubscribed = true;
      save();
      toast('Inscrição criada. Configure a URL do servidor.');
      render();
      return true;
    }
  } catch (err) {
    console.warn('Erro ao inscrever Web Push:', err);
    toast('Erro ao ativar push: ' + (err.message || err));
    return false;
  }
}

export async function unsubscribeWebPush() {
  try {
    toast('Desativando notificações...');
    if ('serviceWorker' in navigator) {
      var reg = await navigator.serviceWorker.ready;
      var sub = await reg.pushManager.getSubscription();
      if (sub) {
        var server = (S.pushServerUrl || DEFAULT_PUSH_SERVER).trim().replace(/\/+$/, '');
        if (server) {
          try {
            await fetch(server + '/unsubscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ subscription: sub })
            });
          } catch(e) {
            console.warn('Erro ao notificar servidor sobre cancelamento:', e);
          }
        }
        await sub.unsubscribe();
      }
    }
    S.pushSubscribed = false;
    save();
    toast('🔕 Notificações desativadas.');
    render();
    return true;
  } catch (err) {
    console.warn('Erro ao desativar notificações:', err);
    S.pushSubscribed = false;
    save();
    toast('Notificações desativadas.');
    render();
    return false;
  }
}

export async function sendTestPush(customServerUrl) {
  var server = (customServerUrl || S.pushServerUrl || DEFAULT_PUSH_SERVER).trim().replace(/\/+$/, '');
  if (!server) {
    toast('Configure a URL do servidor de push primeiro.');
    return;
  }
  toast('Enviando notificação de teste...');
  try {
    var res = await fetch(server + '/test', { method: 'POST' });
    if (res.ok) {
      toast('🚀 Notificação de teste enviada! Bloqueie a tela para ver.');
    } else {
      toast('Servidor respondeu com erro ao enviar teste.');
    }
  } catch (e) {
    toast('Erro ao conectar ao servidor de push: ' + e.message);
  }
}

export async function showNotification(title, options) {
  if (!isNotifySupported() || Notification.permission !== 'granted') return null;

  options = options || {};
  var defaultOpts = {
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    tag: options.tag || 'brewer-general',
    renotify: true,
    vibrate: [200, 100, 200, 100, 200],
    body: options.body || ''
  };
  var finalOpts = Object.assign(defaultOpts, options);

  try {
    if ('serviceWorker' in navigator) {
      var reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        return reg.showNotification(title, finalOpts);
      }
    }
    return new Notification(title, finalOpts);
  } catch (e) {
    try {
      return new Notification(title, finalOpts);
    } catch (err) {
      console.warn('Falha ao emitir notificação nativa:', err);
      return null;
    }
  }
}

export function notifyFocusDone(mins, label) {
  var lbl = label ? ' (' + label + ')' : '';
  showNotification('☕ Café pronto! Foco concluído', {
    body: 'Seu foco de ' + mins + 'm' + lbl + ' foi concluído com sucesso. Hora de relaxar ou iniciar uma pausa!',
    tag: 'brewer-focus-done',
    renotify: true
  });
}

export function notifyBreakDone() {
  showNotification('☕ Pausa finalizada!', {
    body: 'Seu momento de descanso acabou. Pronto para o próximo café e bloco de foco?',
    tag: 'brewer-break-done',
    renotify: true
  });
}

export function notifyAwayWarning() {
  showNotification('⚠️ Foco em andamento no Brewer', {
    body: 'Volte para o aplicativo para não interromper seu foco e quebrar a xícara!',
    tag: 'brewer-away-warning',
    renotify: true
  });
}

/* Painel de Configurações de Notificações para Revisão ou Ajustes */
export function pushSettingsHTML() {
  var p = notifyPermission();
  var sub = !!S.pushSubscribed;
  var lockAudio = S.lockScreenAudio !== false;

  return '<div class="sec" style="margin-top:20px;padding:16px 14px;border:1px solid var(--line);border-radius:18px;background:var(--surface)">' +
    '<h3 style="display:flex;align-items:center;justify-content:space-between;margin:0 0 8px 0">' +
      '<span>🔔 Notificações Inteligentes</span>' +
      (sub ? '<span class="tag" style="margin-left:auto;background:var(--sea-soft);color:var(--sea);border-radius:99px;padding:2px 10px;font-size:12px;font-weight:700">Ligadas</span>' : '<span class="tag" style="margin-left:auto;background:var(--line);color:var(--muted);border-radius:99px;padding:2px 10px;font-size:12px">Desligadas</span>') +
    '</h3>' +
    '<p class="muted small">Lembretes para pausas, foco e revisão mesmo com o app fechado no iPhone.</p>' +
    
    '<div style="margin-top:14px;display:flex;flex-direction:column;gap:10px">' +
      '<div class="row" style="margin-top:4px">' +
        (sub 
          ? '<button class="btn quiet small" data-act="push-disconnect" style="color:var(--danger)">Desligar Notificações</button>' +
            '<button class="btn quiet small" data-act="push-test">Testar Agora</button>'
          : '<button class="btn small" data-act="push-connect">Ativar Notificações no iPhone</button>'
        ) +
      '</div>' +
    '</div>' +

    '<div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--line)">' +
      '<div style="display:flex;align-items:center;justify-content:space-between">' +
        '<div>' +
          '<b>Contador na tela bloqueada</b>' +
          '<p class="muted small" style="margin-top:2px">Exibe o temporizador nativo na tela do iPhone via áudio de fundo.</p>' +
        '</div>' +
        '<button class="chip" data-act="toggle-lock-audio" aria-pressed="' + lockAudio + '">' + (lockAudio ? 'Ligado' : 'Desligado') + '</button>' +
      '</div>' +
    '</div>' +

    '<div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--line)">' +
      '<div style="display:flex;align-items:center;justify-content:space-between">' +
        '<div>' +
          '<b>Versão do App: v30</b>' +
          '<p class="muted small" style="margin-top:2px">Limpa o cache do iPhone e recarrega os arquivos mais recentes.</p>' +
        '</div>' +
        '<button class="btn quiet small" data-act="pwa-force-update">Limpar Cache</button>' +
      '</div>' +
    '</div>' +
  '</div>';
}
