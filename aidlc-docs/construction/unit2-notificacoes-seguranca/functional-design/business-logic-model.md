# Business Logic Model — Unit 2: Notificações Push e Correções Críticas de Segurança

## Part A: Notification Delivery Logic

### A1. Event → Notification Document Mapping
Every business event that must notify someone calls the (extended) `criarNotificacao(dados)` at the exact point the event occurs in existing code (or, for the 3 new event types, at a new call site). Each notification document is fully self-describing — the dispatcher (Cloud Function) never needs to interpret business logic, only read fields.

| Event | Trigger location (existing/new code) | `destinatarioTipo` | `clienteId` | `linkPagina` | `linkId` |
|---|---|---|---|---|---|
| obra_criada | admin creates obra linked to a client (existing) | cliente | obra's clienteId | `'obras'` | obraId |
| obra_concluida | admin marks obra concluída (existing) | cliente | obra's clienteId | `'obras'` | obraId |
| etapa_iniciada | admin creates etapa (existing) | cliente | obra's clienteId | `'obras'` | obraId |
| etapa_concluida | admin marks etapa concluída (existing) | cliente | obra's clienteId | `'obras'` | obraId |
| diaria_registrada | admin registers a diária (existing) | cliente | obra's clienteId | `'obras'` | obraId |
| orcamento_enviado | admin sends orçamento (existing) | cliente | obra's clienteId | `'obras'` | obraId (opens orçamento modal on load, per A3) |
| **cobranca_enviada** (new) | admin sends a solicitação de pagamento | cliente | obra's clienteId | `'financeiro'` | solicitacaoPagamentoId |
| **solicitacao_criada** (new) | client submits a solicitação | admin | *(n/a — see A2)* | `'solicitacoes'` | solicitacaoId |
| **orcamento_decidido** (new) | client approves/rejects an orçamento | admin | *(n/a)* | `'aprovacao'` | obraId |
| **pagamento_cliente_registrado** (new) | client registers a self-reported payment | admin | *(n/a)* | `'pagamentos-cli'` | pagamentoId |
| **cobranca_respondida** (new) | client pays/contests a cobrança | admin | *(n/a)* | `'aprovacao'` | solicitacaoPagamentoId |
| **avaliacao_registrada** (new) | client rates a completed obra | admin | *(n/a)* | `'obras'` | obraId |

### A2. Recipient Resolution (Q3=A)
```
resolveRecipients(notificacao):
  if notificacao.destinatarioTipo === 'cliente':
    return [notificacao.clienteId]
  if notificacao.destinatarioTipo === 'admin':
    return every usuarios document where tipo === 'admin'   // broadcast, per Q3=A — no "primary admin" concept exists
```

### A3. Deep-Link Resolution (Q1=A)
On the client (foreground `onMessage` handler, or on app load when arriving via a background-push click):
```
handleNotificationOpen(payload):
  goPage(payload.linkPagina)
  switch (payload.linkPagina):
    'obras'        -> abrirObra(payload.linkId)          [admin] / abrirObraCliente(payload.linkId) [cliente]
    'solicitacoes' -> abrirSolicitacao(payload.linkId)    [admin only — new event]
    'financeiro'   -> abrirCobranca(payload.linkId)       [cliente only — new event]
    'aprovacao'    -> if orçamento-related: abrirOrcamentoDetalhe(payload.linkId)
                      if cobrança-related: abrirContestacao(payload.linkId)     [admin only]
    'pagamentos-cli' -> abrirPagamentoCliente(payload.linkId)  [admin only]
```
The service worker encodes `linkPagina`/`linkId` (plus which panel: `admin` or `cliente`, derived from `destinatarioTipo`) into the notification's `data` payload and, on click, opens `{panel}/index.html?linkPagina=...&linkId=...`. On load, each panel's `iniciarApp()` checks `location.search` for these params, performs the same `handleNotificationOpen` logic once data has loaded, then strips the query string (`history.replaceState`) so a page refresh doesn't re-trigger it.

### A4. Token Lifecycle
```
On login (initNotifications):
  if permission not yet requested: ask
  if granted: token = getToken(); salvarFcmToken(uid, token)

On logout (Q2=A):
  if a token was registered this session: removerFcmToken(uid, token)
  then proceed with existing logout flow (signOut)

On send failure (NotificationDispatcher, already decided in Application Design):
  if error indicates invalid/unregistered token: removerFcmToken(uid, token)
```

## Part B: Security Fix Logic (technology-agnostic — see Infrastructure Design for exact rules syntax)

### B1. Finding #1 — `usuarios` Self-Write Restriction
**Business rule**: A user may always create their own profile document and update their own `nome`/`telefone`/`fcmTokens` fields. **Only** an existing admin may change ANY user's `tipo` or `status` field — including their own. There is no client-callable path that bypasses this (per Q1=A from Application Design, no new Cloud Function is introduced for this — the rule itself is the sole enforcement point).
**Closes**: RE finding #1 (self-promotion to admin) and its duplicate entry point (RE finding on `index.html`/`js/auth.js` registration flow) — both write to the same document under the same rule.

### B2. Finding #2 — `etapas` Ownership-Scoped Read
**Business rule**: An admin may read any obra's etapas. An approved client may read an obra's etapas **only if** that obra's `clienteId` equals the requesting client's own uid. No client may read another client's etapas under any circumstance.
**Closes**: RE finding #2 (cross-tenant etapas leak), including the internal `valRepasse` exposure it caused.

### B3. New Field Access Rules (required by this unit's own new fields)
- `usuarios/{uid}.fcmTokens`: a user may add/remove entries in their own array; no one else (except admins) may read/write another user's token list.
- `notificacoes` (extended): a client may read only documents where `destinatarioTipo === 'cliente' AND clienteId === request.auth.uid`; an admin may read documents where `destinatarioTipo === 'admin'` (any admin, per Q3=A) or any cliente-facing one. Write access for creating notifications is admin-only for cliente-facing events and... **note**: the 5 new admin-facing event types (A1 table) are triggered by **client actions** (e.g. client submits a solicitação) — so the client must be allowed to create a `notificacoes` document with `destinatarioTipo:'admin'` for their own action, scoped narrowly (see business-rules.md for the exact per-`tipo` constraint needed so a client can't forge arbitrary admin notifications).
