# Gestão de Obras — Guia de Configuração

## ⚠️ ATUALIZAÇÃO (06/07/2026) — Notificações push + correção de segurança

Esta atualização adiciona **notificações push reais** (aparecem mesmo com o app fechado) nos dois sentidos — admin recebe quando o cliente faz alguma ação, e cliente recebe quando você faz alguma ação — e corrige 2 falhas de segurança críticas encontradas numa auditoria: (1) um usuário comum conseguia se autopromover a admin editando dados direto no navegador; (2) um cliente conseguia ler etapas de obras de outros clientes.

**Isso é a primeira vez que este projeto usa Cloud Functions** (um "servidor" do Firebase) — antes o app só usava Firestore/Storage/Auth direto do navegador.

### Antes de publicar, siga o PASSO 6 (novo, abaixo) com atenção — ele tem etapas manuais no console do Firebase que não têm como ser feitas por código.

### Regras do Firestore mudaram de novo
Republique `firestore.rules` (PASSO 1) — ele agora bloqueia a autopromoção a admin e a leitura de etapas entre clientes, e adiciona regras para o novo campo `fcmTokens` e para o formato bidirecional de `notificacoes`.

---

## ⚠️ ATUALIZAÇÃO (04/07/2026) — Orçamento e Notificações

O fluxo mudou: agora **só o orçamento precisa de aprovação do cliente**. Etapas, diárias e conclusão de obra viram só notificações informativas (aba "Notificações" do cliente). Cobranças de pagamento continuam com aceitar/contestar, sem mudança.

**Antes de usar, republique as regras do Firestore** (o arquivo `firestore.rules` foi atualizado com 2 coleções novas: `notificacoes` e `orcamentos`, além de ajustar as permissões de `obras` e `etapas`):
1. No Firebase, vá em **Firestore Database → Regras**
2. Apague tudo e cole o novo conteúdo de `firestore.rules`
3. Clique em **Publicar**

Sem isso, o app vai dar erro de permissão ao tentar enviar notificações ou orçamentos.

**Como usar o orçamento (painel admin):** dentro de uma obra com cliente vinculado, tem um botão azul "Enviar orçamento". Enquanto o cliente não aprovar, a obra fica bloqueada para novas etapas/diárias (aparece um aviso no topo). Se o cliente rejeitar, é só enviar um novo orçamento.

---

Este sistema tem 3 áreas:
- **Login** (`index.html`) — tela inicial, onde admin e cliente entram
- **Admin** (`admin/index.html`) — seu painel completo
- **Cliente** (`cliente/index.html`) — painel do seu patrão/cliente

---

## PASSO 1 — Configurar as regras do Firestore

1. No Firebase, vá em **Firestore Database** → aba **Regras**
2. Apague tudo que estiver lá e cole o conteúdo do arquivo `firestore.rules` (está junto dos outros arquivos)
3. Clique em **Publicar**

## PASSO 2 — Configurar as regras do Storage

1. No Firebase, vá em **Storage** → se ainda não tiver ativado, clique em **Começar** → modo de teste → Avançar → Concluir (escolha a mesma região do Firestore)
2. Vá na aba **Regras**
3. Apague tudo e cole o conteúdo do arquivo `storage.rules`
4. Clique em **Publicar**

## PASSO 3 — Criar o seu primeiro login de ADMIN

Como o cadastro normal do app só cria contas de **cliente**, o primeiro admin precisa ser criado manualmente uma única vez:

1. No Firebase, vá em **Authentication** → aba **Users** → **Add user**
2. Coloque seu e-mail e uma senha → **Add user**
3. Copie o **UID** gerado (aparece na listagem de usuários)
4. Vá em **Firestore Database** → **Iniciar coleção**
5. ID da coleção: `usuarios`
6. ID do documento: cole o **UID** que você copiou
7. Adicione estes campos:
   - `nome` (string) → seu nome
   - `email` (string) → seu e-mail
   - `tipo` (string) → `admin`
   - `status` (string) → `aprovado`
8. Clique em **Salvar**

Pronto! Agora você consegue entrar em `index.html` com esse e-mail/senha e cair direto no painel admin. Pelo próprio painel, em **Mais → Administradores**, você pode criar outros admins no futuro sem repetir esse processo manual.

## PASSO 6 — Ativar as notificações push (Cloud Functions + FCM)

**Pré-requisito**: plano **Blaze** (pré-pago) ativo no projeto Firebase — o plano gratuito (Spark) não roda Cloud Functions. No volume deste app o custo real é praticamente zero (dentro da faixa gratuita do próprio Blaze), mas o plano precisa estar habilitado.

1. **Confirme a região do Firestore**: no console do Firebase, veja em qual região seu Firestore já está (Firestore Database → detalhes do banco). O código está configurado para `southamerica-east1` — se o seu banco estiver em outra região, avise para ajustarmos `functions/index.js` antes de publicar (funções e banco em regiões diferentes funcionam, mas ficam um pouco mais lentas e um pouco mais caras).
2. **Gere a chave VAPID (Web Push)**: Configurações do projeto → **Cloud Messaging** → aba **Configuração da Web** → **Gerar par de chaves**. Copie a chave gerada.
3. Abra `js/firebase-config.js` e troque `SUBSTITUA_PELA_CHAVE_VAPID_PUBLICA_DO_CONSOLE_FIREBASE` pela chave copiada.
4. **Crie uma conta de serviço dedicada** (opcional, mas recomendado — veja `aidlc-docs/construction/unit2-notificacoes-seguranca/infrastructure-design/` para o passo a passo detalhado; sem isso a função usa a conta padrão do projeto, que tem mais permissão do que precisa).
5. Instale as dependências das Functions: dentro da pasta `functions/`, rode `npm install`.
6. Publique regras + funções:
   ```
   npx firebase-tools login
   npx firebase-tools deploy --only firestore:rules
   npx firebase-tools deploy --only functions
   ```
7. **Teste imediatamente após publicar as regras** (antes mesmo de publicar as funções): tente, de uma conta que não é admin, editar o próprio usuário para `tipo:'admin'` — tem que dar erro de permissão. Tente ler etapas de uma obra de outro cliente — também tem que dar erro.
8. Suba os arquivos estáticos no Netlify normalmente (PASSO 4) — isso inclui os arquivos novos `js/notifications.js` e `firebase-messaging-sw.js`.
9. Teste de ponta a ponta: peça para um cliente enviar uma solicitação (o admin deve receber notificação) e crie/atualize uma obra como admin (o cliente deve receber notificação).

Rodar os testes automatizados (opcional, mas recomendado antes de publicar):
```
npm test              # lógica do Fechamento de Caixa e das Cloud Functions
npm run test:rules     # regras do Firestore, contra o emulador (baixa o emulador na primeira vez)
```

## PASSO 4 — Subir os arquivos no Netlify

1. Acesse **netlify.com** → crie conta gratuita
2. Arraste a **pasta inteira** do projeto (não só um arquivo) para a área de upload
3. Em segundos você recebe um link tipo `seusite.netlify.app`

## PASSO 5 — Instalar como app no celular

No Android (Chrome): abra o link → menu (3 pontinhos) → "Adicionar à tela inicial"
No iPhone (Safari): abra o link → ícone de compartilhar → "Adicionar à Tela de Início"

---

## Como funciona o fluxo

**Você (admin):**
- Entra com seu e-mail/senha em `index.html`
- Cadastra parceiros (pedreiros), obras, etapas, encargos, tabela de preços/repasse
- Aprova ou rejeita clientes que se cadastraram
- Vê o andamento de tudo, mas a aprovação final do serviço é feita pelo cliente

**Seu cliente:**
- Cria a própria conta em `index.html` (aba "Criar conta")
- Fica com status "pendente" até você aprovar em **Mais → Clientes**
- Depois de aprovado, vê apenas as obras vinculadas a ele
- Pode revisar, aprovar/rejeitar cada etapa concluída, marcar como Pago ou A Pagar, e deixar anotações

**Vincular obra a um cliente:**
Ao criar a obra no admin, selecione o cliente no campo "Cliente responsável". Só clientes já aprovados aparecem na lista.

---

## Estrutura de arquivos

```
/
├── index.html            ← tela de login
├── pendente.html         ← tela de "aguardando aprovação"
├── manifest.json
├── firebase.json         ← config do Firebase CLI (regras, índices, functions)
├── firestore.rules       ← colar no Firebase (ou publicar via firebase deploy)
├── firestore.indexes.json
├── storage.rules         ← colar no Firebase
├── firebase-messaging-sw.js  ← service worker das notificações push
├── package.json          ← testes (Fechamento de Caixa + Cloud Functions), não afeta o site publicado
├── css/
│   └── style.css
├── js/
│   ├── firebase-config.js
│   ├── auth.js
│   ├── data.js
│   ├── fechamento.js     ← lógica do Fechamento de Caixa (Unidade 1)
│   └── notifications.js  ← notificações push (Unidade 2)
├── functions/            ← Cloud Function que envia as notificações push
│   ├── package.json
│   ├── index.js
│   └── notificationDispatcher.js
├── admin/
│   ├── index.html
│   └── app.js
└── cliente/
    ├── index.html
    └── app.js
```

## Ajustes futuros

Qualquer mudança que precisar depois, é só trazer os arquivos de volta e pedir o ajuste — a estrutura modular faz com que eu só precise tocar no arquivo certo, sem precisar reescrever tudo de novo.
