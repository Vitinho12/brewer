/* ---------- media.js: Gerenciador de Áudio & MediaSession (Contador na Tela Bloqueada) ---------- */
import { S, UI, CUP_ASSETS, cupMeta } from './state.js';
import { mmss } from './utils.js';

var audioElem = null;
var lastMetadataKey = '';
var lastPositionSync = 0;
var sessionActive = false;

var handlers = {
  onPlay: null,
  onPause: null,
  onStop: null,
  onComplete: null
};

export function setupMediaHandlers(h) {
  handlers = Object.assign(handlers, h || {});
}

function toAbsUrl(path) {
  try {
    return new URL(path, window.location.href).href;
  } catch (e) {
    return path;
  }
}

export function getAudioSource(mode) {
  if (mode === 'cafe') return 'assets/audio/cafe.mp3';
  if (mode === 'rain') return 'assets/audio/rain.mp3';
  return 'assets/audio/silence.mp3';
}

function getArtwork(f) {
  var list = [];
  if (f && f.model != null && CUP_ASSETS && CUP_ASSETS.good && CUP_ASSETS.good[f.model]) {
    list.push({
      src: toAbsUrl(CUP_ASSETS.good[f.model]),
      sizes: '200x200',
      type: 'image/webp'
    });
  }
  list.push({
    src: toAbsUrl('icons/icon-512.png'),
    sizes: '512x512',
    type: 'image/png'
  });
  list.push({
    src: toAbsUrl('icons/icon-192.png'),
    sizes: '192x192',
    type: 'image/png'
  });
  list.push({
    src: toAbsUrl('icons/icon-180.png'),
    sizes: '180x180',
    type: 'image/png'
  });
  return list;
}

export function initMediaSession() {
  if (!('mediaSession' in navigator)) return;

  try {
    navigator.mediaSession.setActionHandler('play', function() {
      if (handlers.onPlay) handlers.onPlay();
      resumeFocusMedia();
    });
  } catch (e) {}

  try {
    navigator.mediaSession.setActionHandler('pause', function() {
      if (handlers.onPause) handlers.onPause();
      pauseFocusMedia();
    });
  } catch (e) {}

  try {
    navigator.mediaSession.setActionHandler('stop', function() {
      if (handlers.onStop) handlers.onStop();
      stopFocusMedia(false);
    });
  } catch (e) {}

  try {
    navigator.mediaSession.setActionHandler('seekto', function(details) {
      if (S.focus && (S.focus.mode === 'focus' || S.focus.mode === 'break')) {
        updateMediaSession(S.focus, true);
      }
    });
  } catch (e) {}
}

function getOrCreateAudio() {
  if (!audioElem) {
    audioElem = new Audio();
    audioElem.loop = true;
    audioElem.playsInline = true;
    audioElem.setAttribute('playsinline', '');
    audioElem.setAttribute('webkit-playsinline', '');

    audioElem.addEventListener('timeupdate', function() {
      var f = S.focus;
      if (!f) return;
      var now = Date.now();
      if (f.mode === 'focus') {
        if (!f.pausedAt && now >= f.endTime) {
          if (handlers.onComplete) handlers.onComplete();
          return;
        }
      }
    });

    audioElem.addEventListener('play', function() {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing';
      }
    });

    audioElem.addEventListener('pause', function() {
      if ('mediaSession' in navigator) {
        if (S.focus && (S.focus.mode === 'focus' || S.focus.mode === 'break') && S.focus.pausedAt) {
          navigator.mediaSession.playbackState = 'paused';
        }
      }
    });
  }
  return audioElem;
}

/* Inicia ou prepara o áudio de forma síncrona no clique para atender a política do iOS */
export function primeFocusAudio(ambience) {
  if (S.lockScreenAudio === false && (ambience || UI.amb || 'off') === 'off') {
    return;
  }
  initMediaSession();
  var a = getOrCreateAudio();
  var mode = ambience || UI.amb || 'off';
  var src = getAudioSource(mode);
  var targetSrc = toAbsUrl(src);
  if (a.src !== targetSrc) {
    a.src = src;
    a.currentTime = 0;
  }
  a.loop = true;
  a.volume = (mode === 'cafe') ? 0.65 : ((mode === 'rain') ? 0.55 : 1.0);
  var p = a.play();
  if (p && p.catch) p.catch(function() {});
  sessionActive = true;
}

export function startFocusMedia(f) {
  if (S.lockScreenAudio === false && (UI.amb || 'off') === 'off') {
    return;
  }
  primeFocusAudio(UI.amb);
  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = 'playing';
  }
  lastMetadataKey = '';
  lastPositionSync = 0;
  updateMediaSession(f || S.focus, true);
}

export function setAmbienceMedia(mode) {
  UI.amb = mode || 'off';
  var f = S.focus;
  var inFocus = f && (f.mode === 'focus' || f.mode === 'break');

  if (inFocus && S.lockScreenAudio === false && mode === 'off') {
    stopFocusMedia(false);
    return;
  }

  var a = getOrCreateAudio();
  var src = getAudioSource(mode);
  var targetSrc = toAbsUrl(src);

  if (inFocus) {
    if (a.src !== targetSrc) {
      a.src = src;
      a.currentTime = 0;
    }
    a.loop = true;
    a.volume = (mode === 'cafe') ? 0.65 : ((mode === 'rain') ? 0.55 : 1.0);
    if (!f.pausedAt) {
      var p = a.play();
      if (p && p.catch) p.catch(function() {});
    } else {
      a.pause();
    }
    updateMediaSession(f, true);
  } else {
    /* Pré-visualização fora de foco */
    if (mode === 'off') {
      stopFocusMedia(false);
    } else {
      initMediaSession();
      a.src = src;
      a.currentTime = 0;
      a.loop = true;
      a.volume = (mode === 'cafe') ? 0.65 : 0.55;
      var p2 = a.play();
      if (p2 && p2.catch) p2.catch(function() {});
    }
  }
}

export function stopAmbienceMedia() {
  UI.amb = 'off';
  if (!S.focus || (S.focus.mode !== 'focus' && S.focus.mode !== 'break')) {
    stopFocusMedia(false);
  } else if (S.lockScreenAudio !== false) {
    setAmbienceMedia('off');
  } else {
    stopFocusMedia(false);
  }
}

export function pauseFocusMedia() {
  if (audioElem) {
    try { audioElem.pause(); } catch (e) {}
  }
  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = 'paused';
  }
  var f = S.focus;
  if (f) updateMediaSession(f, true);
}

export function resumeFocusMedia() {
  if (audioElem) {
    var p = audioElem.play();
    if (p && p.catch) p.catch(function() {});
  }
  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = 'playing';
  }
  var f = S.focus;
  if (f) updateMediaSession(f, true);
}

export function completeFocusMedia(f) {
  f = f || S.focus;
  if (audioElem) {
    try { audioElem.pause(); audioElem.currentTime = 0; } catch (e) {}
  }
  sessionActive = false;
  lastMetadataKey = '';
  if ('mediaSession' in navigator) {
    try {
      var mins = f ? Math.max(1, f.mins || Math.round(f.total / 60)) : 25;
      navigator.mediaSession.playbackState = 'none';
      navigator.mediaSession.metadata = new MediaMetadata({
        title: '☕ Bloco feito! (' + mins + ' min)',
        artist: 'Brewer · Xícara na coleção',
        album: (f && f.label) || 'Ritual de Foco',
        artwork: getArtwork(f)
      });
      if ('setPositionState' in navigator.mediaSession) {
        try { navigator.mediaSession.setPositionState(null); } catch (e2) {}
      }
    } catch (e) {}
  }
}

export function stopFocusMedia(completed) {
  if (completed) {
    completeFocusMedia();
    return;
  }
  sessionActive = false;
  lastMetadataKey = '';
  lastPositionSync = 0;
  if (audioElem) {
    try { audioElem.pause(); audioElem.currentTime = 0; } catch (e) {}
  }
  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.playbackState = 'none';
      navigator.mediaSession.metadata = null;
      if ('setPositionState' in navigator.mediaSession) {
        try { navigator.mediaSession.setPositionState(null); } catch (e3) {}
      }
    } catch (e) {}
  }
}

/* Atualiza os metadados e sincroniza a barra de progresso nativa do iOS */
export function updateMediaSession(f, force) {
  if (!('mediaSession' in navigator)) return;
  f = f || S.focus;
  if (!f) return;

  var isBreak = f.mode === 'break';
  var isFocus = f.mode === 'focus';
  if (!isFocus && !isBreak) return;

  var now = Date.now();
  var paused = !!f.pausedAt;
  var dur = Math.max(1, f.total || (isBreak ? 300 : 1500));
  var rem = paused ? Math.max(0, f.endTime - f.pausedAt) : Math.max(0, f.endTime - now);
  var remSec = Math.floor(rem / 1000);
  var elapsed = Math.max(0, dur - remSec);
  var pos = Math.min(dur, Math.max(0, elapsed));

  /* Título com o tempo real visível na tela bloqueada (atualiza a cada 5s) */
  var timeStr = mmss(rem);
  var title = '';
  var artist = '☕ Brewer';
  var album = '';

  if (isBreak) {
    title = (paused ? '⏸️ ' : '') + timeStr + ' · Pausa';
    artist = 'Brewer · Celular Liberado';
    album = 'Descanso pós-foco';
  } else {
    var label = f.label || 'Foco livre';
    if (paused) {
      title = '⏸️ ' + timeStr + ' (pausa) · ' + label;
    } else {
      title = timeStr + ' · ' + label;
    }
    artist = '☕ Brewer' + (f.cat && f.cat !== 'Sem categoria' ? ' · ' + f.cat : '');
    album = (f.kind === 'parcial' ? 'Foco Parcial' : 'Foco Total');
    if (f.model != null && cupMeta(f.model)) {
      album += ' · Xícara ' + cupMeta(f.model).name;
    }
  }

  // Atualiza o título a cada 5 segundos (ou em caso de pausa/forçado)
  var step5 = Math.floor(remSec / 5);
  var metaKey = step5 + '|' + paused + '|' + label + '|' + (f.model || 0);
  if (metaKey !== lastMetadataKey || force) {
    lastMetadataKey = metaKey;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: title,
        artist: artist,
        album: album,
        artwork: getArtwork(f)
      });
    } catch (e) {}
  }

  /* Sincroniza o slider nativo do iOS na inicialização, pausa ou a cada 10 segundos */
  if (force || paused || (now - lastPositionSync > 10000)) {
    lastPositionSync = now;
    if ('setPositionState' in navigator.mediaSession) {
      try {
        navigator.mediaSession.setPositionState({
          duration: dur,
          playbackRate: paused ? 0 : 1,
          position: pos
        });
      } catch (e) {}
    }
  }
}
