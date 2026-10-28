// node_modules/uint8array-extras/index.js
var objectToString = Object.prototype.toString;
var uint8ArrayStringified = "[object Uint8Array]";
var arrayBufferStringified = "[object ArrayBuffer]";
function isType(value, typeConstructor, typeStringified) {
  if (!value) {
    return false;
  }
  if (value.constructor === typeConstructor) {
    return true;
  }
  return objectToString.call(value) === typeStringified;
}
function isUint8Array(value) {
  return isType(value, Uint8Array, uint8ArrayStringified);
}
function isArrayBuffer(value) {
  return isType(value, ArrayBuffer, arrayBufferStringified);
}
function isUint8ArrayOrArrayBuffer(value) {
  return isUint8Array(value) || isArrayBuffer(value);
}
function toUint8ArrayIfArrayBuffer(value) {
  return isArrayBuffer(value) ? new Uint8Array(value) : value;
}
function assertUint8ArrayOrArrayBuffer(value) {
  if (!isUint8ArrayOrArrayBuffer(value)) {
    throw new TypeError(`Expected \`Uint8Array\` or \`ArrayBuffer\`, got \`${typeof value}\``);
  }
}
function toUint8Array(value) {
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  throw new TypeError(`Unsupported value, got \`${typeof value}\`.`);
}
function concatUint8Arrays(arrays, totalLength) {
  if (arrays.length === 0) {
    return new Uint8Array(0);
  }
  totalLength ??= arrays.reduce((accumulator, currentValue) => accumulator + currentValue.byteLength, 0);
  const returnValue = new Uint8Array(totalLength);
  let offset = 0;
  for (let array of arrays) {
    assertUint8ArrayOrArrayBuffer(array);
    array = toUint8ArrayIfArrayBuffer(array);
    returnValue.set(array, offset);
    offset += array.length;
  }
  return returnValue;
}
var cachedDecoders = {
  utf8: new globalThis.TextDecoder("utf8")
};
function assertString(value) {
  if (typeof value !== "string") {
    throw new TypeError(`Expected \`string\`, got \`${typeof value}\``);
  }
}
var cachedEncoder = new globalThis.TextEncoder();
function stringToUint8Array(string) {
  assertString(string);
  return cachedEncoder.encode(string);
}
function base64ToBase64Url(base64) {
  return base64.replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
function base64UrlToBase64(base64url) {
  const base64 = base64url.replaceAll("-", "+").replaceAll("_", "/");
  const padding = (4 - base64.length % 4) % 4;
  return base64 + "=".repeat(padding);
}
var MAX_BLOCK_SIZE = 65535;
function uint8ArrayToBase64(array, { urlSafe = false } = {}) {
  assertUint8ArrayOrArrayBuffer(array);
  array = toUint8ArrayIfArrayBuffer(array);
  let base64 = "";
  for (let index = 0; index < array.length; index += MAX_BLOCK_SIZE) {
    const chunk = array.subarray(index, index + MAX_BLOCK_SIZE);
    base64 += globalThis.btoa(String.fromCodePoint.apply(void 0, chunk));
  }
  return urlSafe ? base64ToBase64Url(base64) : base64;
}
function base64ToUint8Array(base64String) {
  assertString(base64String);
  return Uint8Array.from(globalThis.atob(base64UrlToBase64(base64String)), (x) => x.codePointAt(0));
}
var byteToHexLookupTable = Array.from({ length: 256 }, (_, index) => index.toString(16).padStart(2, "0"));

// node_modules/@block65/webcrypto-web-push/dist/lib/utils.js
function encodeRecordSize(size) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, size);
  return bytes;
}
function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

// node_modules/@block65/webcrypto-web-push/dist/lib/client-keys.js
async function deriveClientKeys(sub) {
  const bytes = base64ToUint8Array(sub.keys.p256dh);
  const authSecretBytes = base64ToUint8Array(sub.keys.auth);
  invariant(bytes.byteLength === 65 && bytes[0] === 4, "Subscription p256dh is not an uncompressed P-256 point");
  invariant(authSecretBytes.byteLength === 16, "Subscription auth secret is not 16 bytes");
  return {
    publicKeyBytes: bytes,
    publicKey: await crypto.subtle.importKey("raw", bytes, {
      name: "ECDH",
      namedCurve: "P-256"
    }, false, []),
    authSecretBytes
  };
}

// node_modules/@block65/webcrypto-web-push/dist/lib/hkdf.js
function createHMAC(data) {
  const keyPromise = crypto.subtle.importKey("raw", data, {
    name: "HMAC",
    hash: "SHA-256"
  }, false, ["sign"]);
  return {
    hash: async (input) => {
      const k = await keyPromise;
      return crypto.subtle.sign("HMAC", k, input);
    }
  };
}
async function hkdf(salt, ikm) {
  const prkhPromise = createHMAC(salt).hash(ikm).then((prk) => createHMAC(prk));
  return {
    extract: async (info, len) => {
      const prkh = await prkhPromise;
      const blocks = await Array.from({ length: Math.ceil(len / 32) }, (_, i) => i).reduce(async (acc, i) => {
        const previous = await acc;
        const hash = await prkh.hash(new Uint8Array([...previous.at(-1) ?? [], ...info, i + 1]));
        return [...previous, new Uint8Array(hash)];
      }, Promise.resolve([]));
      return concatUint8Arrays(blocks).slice(0, len);
    }
  };
}

// node_modules/@block65/webcrypto-web-push/dist/lib/info.js
function createKeyInfo(clientPublic, serverPublic) {
  return new Uint8Array([
    ...stringToUint8Array("WebPush: info\0"),
    ...clientPublic,
    ...serverPublic
  ]);
}
function createInfo(type) {
  return stringToUint8Array(`Content-Encoding: ${type}\0`);
}

// node_modules/@block65/webcrypto-web-push/dist/lib/local-keys.js
async function generateLocalKeys() {
  const keyPair = await crypto.subtle.generateKey({
    name: "ECDH",
    namedCurve: "P-256"
  }, false, ["deriveBits"]);
  return {
    privateKey: keyPair.privateKey,
    publicKeyBytes: new Uint8Array(await crypto.subtle.exportKey("raw", keyPair.publicKey))
  };
}

// node_modules/@block65/webcrypto-web-push/dist/lib/salt.js
async function getSalt() {
  return crypto.getRandomValues(new Uint8Array(16));
}

// node_modules/@block65/webcrypto-web-push/dist/lib/encrypt.js
var recordSize = 4096;
var headerSize = 21 + 65;
var maxPlaintextSize = recordSize - headerSize - 17;
async function encryptNotification(subscription, plaintext, options = {}) {
  invariant(plaintext.byteLength <= maxPlaintextSize, `Payload is ${plaintext.byteLength} bytes, the maximum is ${maxPlaintextSize}`);
  const clientKeys = await deriveClientKeys(subscription);
  const salt = await getSalt();
  const localKeys = await generateLocalKeys();
  const sharedSecret = await crypto.subtle.deriveBits({
    name: "ECDH",
    public: clientKeys.publicKey
  }, localKeys.privateKey, 256);
  const keyInfo = createKeyInfo(clientKeys.publicKeyBytes, localKeys.publicKeyBytes);
  const cekInfo = createInfo("aes128gcm");
  const nonceInfo = createInfo("nonce");
  const ikmHkdf = await hkdf(clientKeys.authSecretBytes, sharedSecret);
  const ikm = await ikmHkdf.extract(keyInfo, 32);
  const messageHkdf = await hkdf(salt, ikm);
  const cekBytes = await messageHkdf.extract(cekInfo, 16);
  const nonceBytes = await messageHkdf.extract(nonceInfo, 12);
  const cekCryptoKey = await crypto.subtle.importKey("raw", cekBytes, {
    name: "AES-GCM",
    length: 128
  }, false, ["encrypt"]);
  const padTo = options.pad ?? true ? maxPlaintextSize : plaintext.byteLength;
  const padded = new Uint8Array(padTo + 1);
  padded.set(plaintext);
  padded[plaintext.byteLength] = 2;
  const encrypted = await crypto.subtle.encrypt({
    name: "AES-GCM",
    iv: nonceBytes
  }, cekCryptoKey, padded);
  return new Uint8Array([
    ...salt,
    ...encodeRecordSize(recordSize),
    localKeys.publicKeyBytes.byteLength,
    ...localKeys.publicKeyBytes,
    ...new Uint8Array(encrypted)
  ]);
}

// node_modules/@block65/webcrypto-web-push/dist/lib/base64.js
function encodeBase64Url(value) {
  return uint8ArrayToBase64(toUint8Array(value), { urlSafe: true });
}
function objectToBase64Url(obj) {
  return encodeBase64Url(stringToUint8Array(JSON.stringify(obj)));
}

// node_modules/@block65/webcrypto-web-push/dist/lib/jwt.js
async function sign(payload, key) {
  const headerStr = objectToBase64Url({
    typ: "JWT",
    alg: "ES256"
  });
  const payloadStr = objectToBase64Url({
    iat: Math.floor(Date.now() / 1e3),
    ...payload
  });
  const dataStr = `${headerStr}.${payloadStr}`;
  const signature = await crypto.subtle.sign({
    name: "ECDSA",
    hash: "SHA-256"
  }, key, stringToUint8Array(dataStr));
  return `${dataStr}.${encodeBase64Url(signature)}`;
}

// node_modules/@block65/webcrypto-web-push/dist/lib/vapid.js
async function vapidHeaders(subscription, vapid) {
  invariant(vapid.subject, "Vapid subject is empty");
  invariant(vapid.privateKey, "Vapid private key is empty");
  invariant(vapid.publicKey, "Vapid public key is empty");
  const endpoint = new URL(subscription.endpoint);
  invariant(endpoint.protocol === "https:", `Subscription endpoint is not https: ${endpoint.protocol}`);
  const vapidPublicKeyBytes = base64ToUint8Array(vapid.publicKey);
  const publicKey = await crypto.subtle.importKey("jwk", {
    kty: "EC",
    crv: "P-256",
    x: encodeBase64Url(vapidPublicKeyBytes.slice(1, 33)),
    y: encodeBase64Url(vapidPublicKeyBytes.slice(33, 65)),
    d: vapid.privateKey
  }, {
    name: "ECDSA",
    namedCurve: "P-256"
  }, false, ["sign"]);
  const jwt = await sign({
    aud: endpoint.origin,
    exp: Math.floor(Date.now() / 1e3) + 12 * 60 * 60,
    sub: vapid.subject
  }, publicKey);
  return {
    headers: {
      authorization: `vapid t=${jwt}, k=${vapid.publicKey}`
    }
  };
}

// node_modules/@block65/webcrypto-web-push/dist/lib/payload.js
async function buildPushPayload(message, subscription, vapid) {
  const { headers } = await vapidHeaders(subscription, vapid);
  const body = await encryptNotification(subscription, stringToUint8Array(
    // if its a primitive, convert to string, otherwise stringify
    typeof message.data === "string" || typeof message.data === "number" ? message.data.toString() : JSON.stringify(message.data)
  ));
  return {
    headers: {
      ...headers,
      ttl: (message.options?.ttl || 60).toString(),
      ...message.options?.urgency && {
        urgency: message.options.urgency
      },
      ...message.options?.topic && {
        topic: message.options.topic
      },
      "content-encoding": "aes128gcm",
      "content-length": body.byteLength.toString(),
      "content-type": "application/octet-stream"
    },
    method: "post",
    body
  };
}

// worker-source.js
var VAPID_PUBLIC_KEY = "BO9XJIFxJG6y9AA-Pg8cEgK2nLk9yoEgekLsZb92VyxKAeFeRyym4kINuLxZ7teFrVoaO6Vm2hTeGywRaoDC_W8";
var VAPID_PRIVATE_KEY = "ZNw4h7jjNfLBZL4WY1D5Sc5xIsC2Y2s1fvugOGME3fg";
var VAPID_SUBJECT = "mailto:brewer.app@gmail.com";
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json"
  };
}
async function sendPushToSub(sub, payload) {
  try {
    const push = await buildPushPayload(
      { data: JSON.stringify(payload), options: { ttl: 86400, urgency: "high" } },
      sub,
      {
        subject: VAPID_SUBJECT,
        publicKey: VAPID_PUBLIC_KEY,
        privateKey: VAPID_PRIVATE_KEY
      }
    );
    const res = await fetch(sub.endpoint, {
      method: "POST",
      headers: push.headers,
      body: push.body
    });
    return res.ok;
  } catch (err) {
    console.warn("Erro ao enviar push para sub:", err);
    return false;
  }
}
async function sendPushToAll(env, payload) {
  if (!env.SUBSCRIPTIONS) {
    console.warn("KV SUBSCRIPTIONS n\xE3o configurado");
    return { success: false, error: "KV SUBSCRIPTIONS n\xE3o configurado" };
  }
  const list = await env.SUBSCRIPTIONS.list({ prefix: "sub:" });
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
        await env.SUBSCRIPTIONS.delete(key.name);
        const schedKey = key.name.replace("sub:", "sched:");
        await env.SUBSCRIPTIONS.delete(schedKey);
        expiredCount++;
      }
    } catch (err) {
      console.warn("Erro ao enviar push para", key.name, err);
    }
  }
  return { success: true, sent: successCount, removed: expiredCount, total: list.keys.length };
}
var worker_source_default = {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }
    const url = new URL(request.url);
    if (url.pathname === "/" || url.pathname === "/status") {
      let count = 0;
      if (env.SUBSCRIPTIONS) {
        const list = await env.SUBSCRIPTIONS.list({ prefix: "sub:" });
        count = list.keys.length;
      }
      return new Response(JSON.stringify({
        status: "online",
        app: "Brewer Push Service",
        subscribers: count,
        vapidPublicKey: VAPID_PUBLIC_KEY
      }), { headers: corsHeaders() });
    }
    if (url.pathname === "/subscribe" && request.method === "POST") {
      try {
        const data = await request.json();
        const sub = data.subscription || data;
        if (!sub || !sub.endpoint) {
          return new Response(JSON.stringify({ error: "Inscri\xE7\xE3o inv\xE1lida" }), { status: 400, headers: corsHeaders() });
        }
        const endpointHash = btoa(sub.endpoint).slice(-32).replace(/[^a-zA-Z0-9]/g, "");
        const key = `sub:${endpointHash}`;
        if (env.SUBSCRIPTIONS) {
          await env.SUBSCRIPTIONS.put(key, JSON.stringify(sub));
        }
        return new Response(JSON.stringify({ success: true, key }), { headers: corsHeaders() });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders() });
      }
    }
    if (url.pathname === "/unsubscribe" && request.method === "POST") {
      try {
        const data = await request.json();
        const sub = data.subscription || data;
        if (sub && sub.endpoint) {
          const endpointHash = btoa(sub.endpoint).slice(-32).replace(/[^a-zA-Z0-9]/g, "");
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
    if (url.pathname === "/sync-smart" && request.method === "POST") {
      try {
        const data = await request.json();
        const sub = data.subscription;
        const triggers = data.triggers || [];
        if (!sub || !sub.endpoint) {
          return new Response(JSON.stringify({ error: "Inscri\xE7\xE3o inv\xE1lida" }), { status: 400, headers: corsHeaders() });
        }
        const endpointHash = btoa(sub.endpoint).slice(-32).replace(/[^a-zA-Z0-9]/g, "");
        const key = `sched:${endpointHash}`;
        if (env.SUBSCRIPTIONS) {
          await env.SUBSCRIPTIONS.put(key, JSON.stringify(triggers));
        }
        return new Response(JSON.stringify({ success: true, count: triggers.length }), { headers: corsHeaders() });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders() });
      }
    }
    if (url.pathname === "/test" && request.method === "POST") {
      const res = await sendPushToAll(env, {
        title: "\u2615 Brewer Funcionando!",
        body: "Seu iPhone agora recebe notifica\xE7\xF5es do Brewer mesmo com o app fechado!",
        tag: "brewer-test"
      });
      return new Response(JSON.stringify(res), { headers: corsHeaders() });
    }
    if (url.pathname === "/send" && request.method === "POST") {
      try {
        const body = await request.json();
        const payload = {
          title: body.title || "\u2615 Brewer",
          body: body.body || "Hora do seu ritual de foco!",
          tag: body.tag || "brewer-custom"
        };
        const res = await sendPushToAll(env, payload);
        return new Response(JSON.stringify(res), { headers: corsHeaders() });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders() });
      }
    }
    return new Response(JSON.stringify({ error: "Endpoint n\xE3o encontrado" }), { status: 404, headers: corsHeaders() });
  },
  // Cron Trigger: processa gatilhos inteligentes agendados
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      console.log("Executando cron inteligente do Brewer...");
      if (!env.SUBSCRIPTIONS) return;
      const now = Date.now();
      const nowDate = /* @__PURE__ */ new Date();
      const utcHours = nowDate.getUTCHours();
      const utcMins = nowDate.getUTCMinutes();
      const utcDay = nowDate.getUTCDay();
      const schedList = await env.SUBSCRIPTIONS.list({ prefix: "sched:" });
      for (const item of schedList.keys) {
        const rawSched = await env.SUBSCRIPTIONS.get(item.name);
        if (!rawSched) continue;
        let triggers = [];
        try {
          triggers = JSON.parse(rawSched);
        } catch (e) {
        }
        if (!Array.isArray(triggers) || !triggers.length) continue;
        const endpointHash = item.name.replace("sched:", "");
        const subRaw = await env.SUBSCRIPTIONS.get(`sub:${endpointHash}`);
        if (!subRaw) {
          await env.SUBSCRIPTIONS.delete(item.name);
          continue;
        }
        let sub = null;
        try {
          sub = JSON.parse(subRaw);
        } catch (e) {
        }
        if (!sub) continue;
        const remainingTriggers = [];
        for (const tr of triggers) {
          if (tr.time <= now) {
            if (now - tr.time < 2 * 60 * 60 * 1e3) {
              console.log("Disparando push inteligente agendado:", tr.title);
              await sendPushToSub(sub, {
                title: tr.title,
                body: tr.body,
                tag: tr.tag || "brewer-smart"
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
      const isSundayNight = utcDay === 0 && utcHours === 23 && utcMins >= 25 && utcMins <= 40;
      if (isSundayNight) {
        console.log("Executando fechamento de Domingo \xE0 noite...");
        await sendPushToAll(env, {
          title: "\u{1F319} Domingo \xE0 noite \xB7 Brewer",
          body: "Uma semana se encerra. Amanh\xE3 \xE9 segunda-feira: uma p\xE1gina limpa para recome\xE7ar no seu ritmo.",
          tag: "brewer-sunday-fallback"
        });
      }
      const isMorningHour = utcHours === 10 && utcMins >= 25 && utcMins <= 40;
      if (isMorningHour) {
        console.log("Executando convite matinal das 07:30 BRT...");
        await sendPushToAll(env, {
          title: "\u2615 Bom dia \xB7 Brewer",
          body: "Um momento tranquilo para tomar um caf\xE9 e definir o foco de hoje.",
          tag: "brewer-morning-fallback"
        });
      }
    })());
  }
};
export {
  worker_source_default as default
};
