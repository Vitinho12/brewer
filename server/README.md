# Servidor de Notificações Web Push do Brewer

Este worker roda na **Cloudflare Workers** (gratuito) e envia notificações direto para a Apple (APNs), permitindo que seu iPhone e o da sua namorada recebam alertas mesmo com o app **totalmente fechado** e a tela bloqueada.

---

## O que ele faz automaticamente:

1. **Lembrete da Revisão (às 21:00 BRT)**:
   - Notificação: *"🌙 Hora da Revisão · Brewer: Hora de registrar seu tempo de tela e conferir as xícaras de hoje!"*
2. **Endpoint `/subscribe`**:
   - Salva a inscrição do seu iPhone com segurança no Cloudflare KV.
3. **Endpoint `/test`**:
   - Dispara uma notificação de teste imediatamente para todos os iPhones conectados.

---

## Como colocar no ar em 2 minutos (100% Gratuito):

### Opção A: Pelo Terminal (Mais Rápido)

1. Abra o terminal na pasta `server`:
   ```bash
   cd server
   npm install
   ```
2. Crie a base de dados KV no Cloudflare (grátis):
   ```bash
   npx wrangler kv:namespace create SUBSCRIPTIONS
   ```
   *(Ele vai te dar um `id`. Cole esse `id` no arquivo `wrangler.toml` no campo `id = "..."`)*.

3. Publique o worker:
   ```bash
   npx wrangler deploy
   ```
   *(Na primeira vez, ele vai abrir uma aba no navegador para você logar na sua conta gratuita da Cloudflare).*

4. O Cloudflare vai te dar uma URL como:  
   `https://brewer-push.<seu-usuario>.workers.dev`

5. Cole essa URL dentro do Brewer na aba **Revisão > Notificações** e clique em **Salvar e Conectar**!

---

### Opção B: Direto pelo site da Cloudflare (Sem terminal)

1. Entre em [dash.cloudflare.com](https://dash.cloudflare.com/) (crie uma conta grátis se não tiver).
2. Vá em **Workers & Pages** → **Create application** → **Create Worker**.
3. Dê o nome de `brewer-push` e clique em **Deploy**.
4. Clique em **Edit code**:
   - Copie todo o código do arquivo [`worker.js`](worker.js) e cole lá.
   - Clique em **Deploy**.
5. Em **Settings** do Worker:
   - Vá em **Triggers** → **Cron Triggers** → **Add Cron Trigger**: digite `0 0 * * *` (roda às 21h de Brasília).
   - Vá em **Variables** → **KV Namespace Bindings** → Adicione a variável `SUBSCRIPTIONS` apontando para um KV criado.
6. Copie a URL do seu Worker e cole no Brewer!
