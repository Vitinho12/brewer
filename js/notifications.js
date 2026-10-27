import { S, toast, save } from './state.js';
import { render } from './app.js';

export function isNotifySupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notifyPermission() {
  if (!isNotifySupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestNotifyPermission() {
  if (!isNotifySupported()) {
    toast('Notificações não são suportadas neste navegador.');
    return 'unsupported';
  }
  try {
    var perm = await Notification.requestPermission();
    if (perm === 'granted') {
      toast('🔔 Notificações ativadas com sucesso!');
      showNotification('☕ Notificações ativadas no Brewer', {
        body: 'Você receberá um alerta quando seu café estiver pronto e o foco for concluído!',
        tag: 'brewer-welcome',
        silent: false
      });
    } else if (perm === 'denied') {
      toast('Notificações bloqueadas nas configurações do navegador/dispositivo.');
    }
    render();
    return perm;
  } catch (err) {
    console.warn('Erro ao solicitar permissão de notificação:', err);
    return 'default';
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
