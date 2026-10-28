/**
 * Brewer Push Worker - Cloudflare Workers
 * Envio de notificações push para iPhone/Android mesmo com o app fechado.
 */
import webpush from 'web-push';

// Chaves VAPID geradas especificamente para o Brewer
const VAPID_PUBLIC_KEY = 'BO9XJIFxJG6y9AA-Pg8cEgK2nLk9yoEgekLsZb92VyxKAeFeRyym4kINuLxZ7teFrVoaO6Vm2hTeGywRaoDC_W8';
const VAPID_PRIVATE_KEY = 'ZNw4h7jjNfLBZL4WY1D5Sc5xIsC2Y2s1fvugOGME3fg';
const VAPID_SUBJECT = 'mailto:brewer.app@gmail.com';

webpush.setVapidDetails(
  VAPID_SUBJECT,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };
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
      await webpush.sendNotification(sub, JSON.stringify(payload));
      successCount++;
    } catch (err) {
      console.warn('Erro ao enviar push para', key.name, err);
      // Se a inscrição expirou ou o usuário desinstalou, remove do KV
      if (err.statusCode === 404 || err.statusCode === 410) {
        await env.SUBSCRIPTIONS.delete(key.name);
        expiredCount++;
      }
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
          if (env.SUBSCRIPTIONS) {
            await env.SUBSCRIPTIONS.delete(key);
          }
        }
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders() });
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

  // Cron Trigger: roda todo dia às 00:00 UTC (21:00 BRT)
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      console.log('Executando cron diário das 21h...');
      await sendPushToAll(env, {
        title: '🌙 Hora da Revisão · Brewer',
        body: 'Hora de registrar seu tempo de tela e conferir as xícaras de hoje!',
        tag: 'brewer-daily-review'
      });
    })());
  }
};
