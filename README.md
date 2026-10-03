# Brewer — foco como ritual de café

Projeto separado do Onda. Não altera nem compartilha dados com ele.

## 1. O que veio do Onda
Agenda (dia e rotinas), tarefas com prazo e prioridade, categorias de foco, revisão do dia e da semana, registro de tempo de tela, sequência de dias com fases, "Bateu a vontade", modo teste, PWA (manifest + service worker).

## 2. O que mudou
- Metáfora: mar e pranchas saíram; entram **xícaras**. O rack foi removido.
- **Coleção**: conjuntos de 7 xícaras (HTML + CSS + assets individuais) e um **Catálogo** com modelos escondidos até serem descobertos.
- **Fases**: 10 "torras", da clara (creme) à escura (espresso, oliva, vinho, ameixa), com nomes de café.
- **Foco**: motor por timestamps (`startTime`/`endTime`), sem quebrar ao bloquear a tela.
- **1% melhor por semana** na meta de tela.
- Namespace próprio: `brewer.v1`.

## 3. Estrutura
```
index.html        app completo (HTML + CSS + JS)
manifest.json     PWA
sw.js             cache offline (stale-while-revalidate)
icons/            icon-180/192/512.png
assets/cups/      cup-NN-good.webp e cup-NN-broken.webp
assets/focus/     v60.webp (imagem principal da tela de foco)
```
Dentro do `index.html`, procure por `CUP_ASSETS`, `CUP_META`, `FOCUS_ASSETS`, `PHASES`, `AWAY_ASK_MS`, `EMERGENCY_MAX_MS` e `Integrations`.

## 4. Onde ficam os assets
Todos os caminhos estão centralizados em `CUP_ASSETS` e `FOCUS_ASSETS`. Nenhum outro ponto do código cita arquivos de imagem. Os arquivos atuais são **placeholders temporários**; substitua pelos definitivos mantendo os nomes.

## 5. Adicionar uma nova xícara
1. Crie `assets/cups/cup-07-good.webp` e `assets/cups/cup-07-broken.webp` (512x512, fundo transparente).
2. Em `CUP_ASSETS`, acrescente uma linha em `good` e outra em `broken` (mesma posição).
3. Opcional: acrescente `{name:'Nome',color:'#hex'}` em `CUP_META` (nome no catálogo e cor do fallback).
4. Em `sw.js`, aumente o `for` de `6` para `7` e troque `CACHE` para `brewer-v2`.

## 6. Criar a versão quebrada
Use a mesma peça, mesmo ângulo, mesma luz e mesmo enquadramento da versão boa, mas rachada ou partida, sem cor ou quase sem cor. Salve como `cup-NN-broken.webp`. O app sempre mostra a versão quebrada do **mesmo modelo** que seria ganho.

## 7. Adicionar novas fases
Em `PHASES`, acrescente `{min:DIAS,name:'Nome',desc:'Texto'}`. Para a cor, acrescente um bloco `body[data-theme="N"]{...}` no CSS (copie um existente e ajuste os tokens). Mantenha `ink/bg`, `muted/bg` e `on-sea/sea` com contraste de pelo menos 4,5:1.

## 8. Testar o foco com a tela bloqueada
**No iPhone (teste real):** inicie um bloco de 15 min ou mais, bloqueie o aparelho por mais de 15 s, desbloqueie. O Brewer pergunta: *Bloqueei a tela*, *Precisei usar o celular* ou *Desisti do foco*.
- Bloqueei: o foco continua (e, se o tempo já acabou, conclui).
- Precisei usar o celular: registra a interrupção e a xícara quebra.
- Desisti: encerra como falha.

A **Pausa de emergência** congela o tempo (máximo de 10 min; acima disso o bloco falha).

**Sem esperar (modo teste):** Jornada, Modo teste. No Foco aparece "10 s (teste)", e durante o bloco aparecem "Simular 10 s / 30 s / 2 min fora". Ausências abaixo de 15 s não perguntam nada.

Limite honesto: uma PWA não sabe se você bloqueou a tela ou abriu outro app. A resposta é declarada por você.

## 9. Testar o 1% melhor
Na Revisão, defina a **meta inicial** (ex.: 8h20). Na Jornada: meta desta semana, da próxima, progresso e botão de ligar/desligar. Fórmula: `próxima = arredonda(atual × 0,99)`, caindo ao menos 1 min por semana e com piso de 30 min. No Modo teste, "+1 semana" avança o calendário: 8h20 → 8h15 → 8h10 → 8h05. Cada dia guarda a meta vigente no momento do registro, então mudar a meta não reescreve o passado.

## 10. Google Agenda (implementado)
**Como usar:** Agenda, painel "Google Agenda" no fim da tela. Cole o **OAuth Client ID** (aplicativo da Web) do seu projeto, toque em *Conectar e sincronizar* e autorize. O Client ID não é segredo e fica salvo só no seu navegador.

**O que a sincronização faz** (ontem até 14 dias à frente, calendário principal):
1. Apaga no Google os blocos que você removeu no Brewer.
2. Envia para o Google os blocos criados no Brewer (opção *Enviar os blocos do Brewer para o Google*).
3. Importa os eventos do Google para a agenda, com a marca "Google". Eles são editados no Google (no Brewer só dá para focar). Eventos de dia inteiro e cancelados são ignorados; eventos que cruzam a meia-noite são divididos por dia.

Não duplica: blocos enviados pelo Brewer guardam o `extId` do evento e não voltam como importados. *Desconectar* revoga a permissão e remove os eventos importados.

**Checklist no Google Cloud:** Calendar API ativada; Client ID do tipo *Web application* com a origem `https://vitinho12.github.io`; se a tela de consentimento estiver em "Testing", sua conta precisa estar em *Test users*; escopo usado: `calendar.events`.

**Limites honestos:**
- É login pelo navegador (Google Identity Services): o acesso dura cerca de 1 hora e depois renova com um toque em *Sincronizar agora*. Não há sincronização em segundo plano.
- No iPhone, na versão instalada pela tela inicial, a janela de login do Google pode não abrir. Se acontecer, o app mostra um aviso; abra o Brewer pelo Safari para testar. Se for um problema persistente, a solução é um pequeno backend, o que muda o escopo do projeto.
- Esta integração foi escrita pela documentação oficial e testada com um Google simulado. Ainda não foi testada com a sua conta real.

## 11. Publicar separado do Onda
Crie um repositório **novo** (ex.: `brewer`) e envie, mantendo as pastas: `index.html`, `manifest.json`, `sw.js`, `icons/`, `assets/`. Ative GitHub Pages (branch `main`, `/ (root)`). Endereço: `https://vitinho12.github.io/brewer/`. No iPhone: Safari, Compartilhar, Adicionar à Tela de Início.

Atenção: Onda e Brewer ficam na **mesma origem** (`vitinho12.github.io`), então compartilham o armazenamento do navegador. Por isso o Brewer usa a chave `brewer.v1` e nunca toca em `onda.v1`.
