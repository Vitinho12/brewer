import { buildPushPayload } from '@block65/webcrypto-web-push';

// Chaves VAPID geradas especificamente para o Brewer
const VAPID_PUBLIC_KEY = 'BO9XJIFxJG6y9AA-Pg8cEgK2nLk9yoEgekLsZb92VyxKAeFeRyym4kINuLxZ7teFrVoaO6Vm2hTeGywRaoDC_W8';
const VAPID_PRIVATE_KEY = 'ZNw4h7jjNfLBZL4WY1D5Sc5xIsC2Y2s1fvugOGME3fg';
const VAPID_SUBJECT = 'mailto:brewer.app@gmail.com';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };
}

async function sendPushToSub(sub, payload) {
  try {
    const push = await buildPushPayload(
      { data: JSON.stringify(payload), options: { ttl: 86400, urgency: 'high' } },
      sub,
      {
        subject: VAPID_SUBJECT,
        publicKey: VAPID_PUBLIC_KEY,
        privateKey: VAPID_PRIVATE_KEY
      }
    );
    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: push.headers,
      body: push.body
    });
    return res.ok;
  } catch (err) {
    console.warn('Erro ao enviar push para sub:', err);
    return false;
  }
}

async function sendPushToAll(env, payload) {
  if (!env.SUBSCRIPTIONS) {
    console.warn('KV SUBSCRIPTIONS não configurado');
    return { success: false, error: 'KV SUBSCRIPTIONS não configurado' };
  }

  const list = await env.SUBSCRIPTIONS.list({ prefix: 'sub:' });
  let successCount = 0;
  let expiredCount = 0;

  for (const key of list.keys) {
    const raw = await env.SUBSCRIPTIONS.get(key.name);
    if (!raw) continue;
    try {
      const sub = JSON.parse(raw);
      const ok = await sendPushToSub(sub, payload);
      if (ok) {
        successCount++;
      } else {
        // Se a inscrição expirou ou foi cancelada no browser
        await env.SUBSCRIPTIONS.delete(key.name);
        const schedKey = key.name.replace('sub:', 'sched:');
        await env.SUBSCRIPTIONS.delete(schedKey);
        expiredCount++;
      }
    } catch (err) {
      console.warn('Erro ao enviar push para', key.name, err);
    }
  }

  return { success: true, sent: successCount, removed: expiredCount, total: list.keys.length };
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    const url = new URL(request.url);

    // GET /status ou /
    if (url.pathname === '/' || url.pathname === '/status') {
      let count = 0;
      if (env.SUBSCRIPTIONS) {
        const list = await env.SUBSCRIPTIONS.list({ prefix: 'sub:' });
        count = list.keys.length;
      }
      return new Response(JSON.stringify({
        status: 'online',
        app: 'Brewer Push Service',
        subscribers: count,
        vapidPublicKey: VAPID_PUBLIC_KEY
      }), { headers: corsHeaders() });
    }

    // POST /subscribe - Salva inscrição do iPhone/Android
    if (url.pathname === '/subscribe' && request.method === 'POST') {
      try {
        const data = await request.json();
        const sub = data.subscription || data;
        if (!sub || !sub.endpoint) {
          return new Response(JSON.stringify({ error: 'Inscrição inválida' }), { status: 400, headers: corsHeaders() });
        }

        const endpointHash = btoa(sub.endpoint).slice(-32).replace(/[^a-zA-Z0-9]/g, '');
        const key = `sub:${endpointHash}`;
        
        if (env.SUBSCRIPTIONS) {
          await env.SUBSCRIPTIONS.put(key, JSON.stringify(sub));
        }

        return new Response(JSON.stringify({ success: true, key: key }), { headers: corsHeaders() });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders() });
      }
    }

    // POST /unsubscribe - Remove inscrição do banco
    if (url.pathname === '/unsubscribe' && request.method === 'POST') {
      try {
        const data = await request.json();
        const sub = data.subscription || data;
        if (sub && sub.endpoint) {
          const endpointHash = btoa(sub.endpoint).slice(-32).replace(/[^a-zA-Z0-9]/g, '');
          const key = `sub:${endpointHash}`;
          const schedKey = `sched:${endpointHash}`;
          if (env.SUBSCRIPTIONS) {
            await env.SUBSCRIPTIONS.delete(key);
            await env.SUBSCRIPTIONS.delete(schedKey);
          }
        }
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders() });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders() });
      }
    }

    // POST /sync-smart - Salva gatilhos inteligentes para o dispositivo
    if (url.pathname === '/sync-smart' && request.method === 'POST') {
      try {
        const data = await request.json();
        const sub = data.subscription;
        const triggers = data.triggers || [];
        if (!sub || !sub.endpoint) {
          return new Response(JSON.stringify({ error: 'Inscrição inválida' }), { status: 400, headers: corsHeaders() });
        }
        const endpointHash = btoa(sub.endpoint).slice(-32).replace(/[^a-zA-Z0-9]/g, '');
        const key = `sched:${endpointHash}`;
        if (env.SUBSCRIPTIONS) {
          await env.SUBSCRIPTIONS.put(key, JSON.stringify(triggers));
        }
        return new Response(JSON.stringify({ success: true, count: triggers.length }), { headers: corsHeaders() });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders() });
      }
    }

    // POST /test - Dispara notificação de teste imediatamente
    if (url.pathname === '/test' && request.method === 'POST') {
      const res = await sendPushToAll(env, {
        title: '☕ Brewer Funcionando!',
        body: 'Seu iPhone agora recebe notificações do Brewer mesmo com o app fechado!',
        tag: 'brewer-test'
      });
      return new Response(JSON.stringify(res), { headers: corsHeaders() });
    }

    // POST /send - Dispara notificação personalizada
    if (url.pathname === '/send' && request.method === 'POST') {
      try {
        const body = await request.json();
        const payload = {
          title: body.title || '☕ Brewer',
          body: body.body || 'Hora do seu ritual de foco!',
          tag: body.tag || 'brewer-custom'
        };
        const res = await sendPushToAll(env, payload);
        return new Response(JSON.stringify(res), { headers: corsHeaders() });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders() });
      }
    }

    return new Response(JSON.stringify({ error: 'Endpoint não encontrado' }), { status: 404, headers: corsHeaders() });
  },

  // Cron Trigger: processa gatilhos inteligentes agendados
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      console.log('Executando cron inteligente do Brewer...');
      if (!env.SUBSCRIPTIONS) return;

      const now = Date.now();
      const nowDate = new Date();
      const utcHours = nowDate.getUTCHours();
      const utcMins = nowDate.getUTCMinutes();
      const utcDay = nowDate.getUTCDay(); // 0 = Domingo

      // 1. Processa gatilhos personalizados agendados pelo app
      const schedList = await env.SUBSCRIPTIONS.list({ prefix: 'sched:' });
      for (const item of schedList.keys) {
        const rawSched = await env.SUBSCRIPTIONS.get(item.name);
        if (!rawSched) continue;

        let triggers = [];
        try { triggers = JSON.parse(rawSched); } catch(e) {}
        if (!Array.isArray(triggers) || !triggers.length) continue;

        const endpointHash = item.name.replace('sched:', '');
        const subRaw = await env.SUBSCRIPTIONS.get(`sub:${endpointHash}`);
        if (!subRaw) {
          await env.SUBSCRIPTIONS.delete(item.name);
          continue;
        }

        let sub = null;
        try { sub = JSON.parse(subRaw); } catch(e) {}
        if (!sub) continue;

        const remainingTriggers = [];
        for (const tr of triggers) {
          if (tr.time <= now) {
            // Dispara se estiver na janela recente (até 2h de atraso aceitável)
            if (now - tr.time < 2 * 60 * 60 * 1000) {
              console.log('Disparando push inteligente agendado:', tr.title);
              await sendPushToSub(sub, {
                title: tr.title,
                body: tr.body,
                tag: tr.tag || 'brewer-smart'
              });
            }
          } else {
            remainingTriggers.push(tr);
          }
        }

        if (remainingTriggers.length !== triggers.length) {
          if (remainingTriggers.length > 0) {
            await env.SUBSCRIPTIONS.put(item.name, JSON.stringify(remainingTriggers));
          } else {
            await env.SUBSCRIPTIONS.delete(item.name);
          }
        }
      }

      // 2. Fallbacks de segurança se o app não tiver sincronizado
      // Domingo às 23:30 UTC = 20:30 BRT Domingo (Ritmo & Retomada)
      const isSundayNight = (utcDay === 0 && utcHours === 23 && utcMins >= 25 && utcMins <= 40);
      if (isSundayNight) {
        console.log('Executando fechamento de Domingo à noite...');
        await sendPushToAll(env, {
          title: '🌙 Domingo à noite · Brewer',
          body: 'Uma semana se encerra. Amanhã é segunda-feira: uma página limpa para recomeçar no seu ritmo.',
          tag: 'brewer-sunday-fallback'
        });
      }

      // Manhã às 10:30 UTC = 07:30 BRT (Convite matinal)
      const isMorningHour = (utcHours === 10 && utcMins >= 25 && utcMins <= 40);
      if (isMorningHour) {
        console.log('Executando convite matinal das 07:30 BRT...');
        await sendPushToAll(env, {
          title: '☕ Bom dia · Brewer',
          body: 'Um momento tranquilo para tomar um café e definir o foco de hoje.',
          tag: 'brewer-morning-fallback'
        });
      }
    })());
  }
};
