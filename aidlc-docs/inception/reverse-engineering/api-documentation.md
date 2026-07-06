# API Documentation

**Note**: This system has no custom REST/HTTP API. All "API" surface is the Firebase Authentication/Firestore/Storage SDK, mediated by the internal modules `js/auth.js` and `js/data.js`. This document treats those modules' exported functions as the internal API, and documents the Firestore data model they operate on.

## Internal APIs

### `js/auth.js`
- **`cadastrarCliente(nome, email, senha, telefone)`** → `Promise<User>` — Creates a Firebase Auth user and a `usuarios/{uid}` doc with `tipo:'cliente'`, `status:'pendente'`.
- **`cadastrarAdmin(nome, email, senha)`** → `Promise<User>` — Creates a Firebase Auth user and a `usuarios/{uid}` doc with `tipo:'admin'`, `status:'aprovado'`. Called only from the admin panel.
- **`login(email, senha)`** → `Promise<User>` — Wraps `signInWithEmailAndPassword`.
- **`loginComGoogle()`** → `Promise<User>` — Wraps `signInWithPopup(auth, new GoogleAuthProvider())`; if the resulting user has no `usuarios/{uid}` doc yet, auto-provisions one with `tipo:'cliente'`, `status:'pendente'`.
- **`logout()`** → `Promise<void>` — Wraps `signOut`.
- **`recuperarSenha(email)`** → `Promise<void>` — Wraps `sendPasswordResetEmail`.
- **`buscarPerfilUsuario(uid)`** → `Promise<object|null>` — Reads `usuarios/{uid}`.
- **`observarAuth(onReady)`** → `void` — Wraps `onAuthStateChanged`; fetches the user's profile doc and invokes `onReady(user, perfil)` once both are available (or `onReady(null, null)` if signed out). This is the composite "who is logged in and what role are they" primitive used by all HTML surfaces for route guarding.
- **`mensagemErroFirebase(err)`** → `string` — Maps Firebase Auth error codes to Portuguese user-facing messages, with a generic fallback.

### `js/data.js`
- **Uploads**: `uploadFoto(base64DataUrl, caminho)` → `Promise<string>` (download URL, no error handling or size/type validation — see code-quality-assessment.md); `fileParaBase64(file)` → `Promise<string>` (FileReader wrapper).
- **Solicitações**: `criarSolicitacao(dados)`, `escutarSolicitacoes(callback, filtroClienteId?)`, `atualizarSolicitacao(id, dados)`, `excluirSolicitacao(id)`.
- **Obras**: `criarObra(obraData)`, `atualizarObra(obraId, dados)`, `escutarObras(callback, filtroClienteId?)`, `buscarObra(obraId)`, `excluirObra(obraId)`.
- **Etapas** (subcollection of `obras`): `criarEtapa(obraId, etapaData)`, `atualizarEtapa(obraId, etapaId, dados)`, `escutarEtapas(obraId, callback)`, `escutarTodasEtapas(obras, callback)` (fans out one listener per obra and aggregates — rebuilt on every obras snapshot, see code-quality-assessment.md).
- **Encargos** (subcollection of `obras`): `criarEncargo(obraId, encargoData)`, `escutarEncargos(obraId, callback)`, `excluirEncargo(obraId, encargoId)`.
- **Preços**: `escutarPrecos(callback)`, `criarPreco(nome, valorM2)`, `atualizarPreco(precoId, nome, valorM2)`, `excluirPreco(precoId)`.
- **Repasses**: `escutarRepasses(callback)`, `criarRepasse(nome, valorM2)`, `atualizarRepasse(repasseId, nome, valorM2)`, `excluirRepasse(repasseId)`.
- **Diárias**: `escutarDiarias(callback)`, `criarDiaria(nome, valorDia)`, `atualizarDiaria(diariaId, nome, valorDia)`, `excluirDiaria(diariaId)`.
- **Parceiros**: `escutarParceiros(callback)`, `criarParceiro(dados)`, `atualizarParceiro(parceiroId, dados)`, `excluirParceiro(parceiroId)`.
- **Pagamentos a parceiro** (subcollection of `parceiros`): `registrarPagamentoParceiro(parceiroId, dados)`, `escutarPagamentosParceiro(parceiroId, callback)`, `excluirPagamentoParceiro(parceiroId, pagamentoId)`.
- **Clientes/Admins** (both stored in `usuarios`): `escutarClientes(callback)`, `aprovarCliente(uid)`, `rejeitarCliente(uid)`, `escutarAdmins(callback)`, `promoverParaAdmin(uid)`.
- **Orçamentos**: `criarOrcamento(dados)`, `escutarOrcamentos(callback, filtroClienteId?)`, `atualizarOrcamento(id, dados)` (client decision: `status: 'aprovado'|'rejeitado'`, `motivo`, `decididoEm`).
- **Notificações**: `criarNotificacao(dados)`, `escutarNotificacoes(callback, clienteId)` (`orderBy`, no `limit` — see code-quality-assessment.md), `marcarNotificacaoLida(id)` (only ever flips `lida`; nothing deletes/archives old notifications).
- **Solicitações de pagamento (cobranças)**: `criarSolicitacaoPagamento(dados)`, `escutarSolicitacoesPagamento(callback, filtroClienteId?)`, `atualizarSolicitacaoPagamento(id, dados)`.
- **Pagamentos de cliente**: `registrarPagamentoCliente(dados)`, `escutarPagamentosCliente(callback, filtroClienteId?)`, `atualizarPagamentoCliente(id, dados)`.
- **Helpers**: `hoje()` → today's date as `YYYY-MM-DD` (derived from `new Date().toISOString()` — UTC, not local time; see code-quality-assessment.md); `diasDiff(d1, d2)` → integer day difference; `notificarWhatsApp(...)` → stub, currently `console.log`-only.

## Data Models

### `usuarios/{uid}` (Firebase Auth UID as doc id)
- **Fields**: `nome` (string), `email` (string), `telefone` (string, optional), `tipo` (`'admin'|'cliente'`), `status` (`'pendente'|'aprovado'|'rejeitado'`, cliente only), `criadoEm` (ISO string via `new Date().toISOString()` — not a Firestore `serverTimestamp()`).
- **Relationships**: Referenced by `obras.clienteId`, `solicitacoes.clienteId`, `orcamentos.clienteId`, `solicitacoes_pagamento.clienteId`, `pagamentos_cliente.clienteId`, `notificacoes.clienteId`.
- **Validation**: Per `firestore.rules`, self-create/update is allowed for one's own uid with **no field restriction** — see code-quality-assessment.md finding #1 (privilege escalation).

### `obras/{obraId}`
- **Fields**: `nome`, `local`, `clienteId` (optional, references `usuarios`), `mostrarPedreiro` (bool), `inicio`, `fim` (dates), `desc`, `status` (`'andamento'|'concluida'`), `valorPrevisto`, `pagObra` (`'a_pagar'|'parcial'|'pago'`), `entrada`, `dataConc`, `avaliacaoNota` (1-5), `avaliacaoComentario`, `avaliadoEm` (serverTimestamp), `criadoEm` (serverTimestamp).
- **Relationships**: Parent of `etapas` and `encargos` subcollections; optionally linked to one `usuarios` client doc; referenced by `orcamentos.obraId`, `solicitacoes_pagamento.obraId`, `notificacoes.obraId`.
- **Validation**: Only admin can create/update/delete; client can read obras where `clienteId` matches their own uid; client update is scoped to `avaliacaoNota`/`avaliacaoComentario`/`avaliadoEm` only.

### `obras/{obraId}/etapas/{etapaId}`
- **Fields**: `tipo`, `metros` (m², when applicable), `val` (client price), `valRepasse` (internal payout — never surfaced to clients), `parceiros` (array of `{parceiroId, nome, repasse}`), `parceiroNome`, `isDiaria`/`isDiariaAvulsa` (bool), `linhasDiarias` (array), `status` (`'execucao'|'concluido'`), `aprovacao` (legacy field, largely superseded by `orcamentos`), `pagamento` (`'a_pagar'|'pago'`), `statusCobranca` (`'solicitacao_pagamento'|null`), `fotoAntes`, `fotoDepois`, `fotosExtras` (array), `detalheInterno` (admin-only), `obs` (client-visible), `inicio`, `prazo`, `dataConc`, `dataDiaria`, `tempoReal`, `motivo`, `criadoEm`.
- **Relationships**: Child of `obras`; `parceiros[].parceiroId` references `parceiros`.
- **Validation**: Admin has full CRUD; approved client may only read (rule grants read to any approved client for any obra's etapas — see code-quality-assessment.md finding #2, cross-tenant leak); no client-write path is defined for etapas in the current rules.

### `obras/{obraId}/encargos/{encargoId}`
- **Fields**: `descricao`, `valor`, `comprovante` (photo URL), `criadoEm`.
- **Relationships**: Child of `obras`.
- **Validation**: Admin-only read/write.

### `precos/{precoId}`
- **Fields**: `nome` (service name), `val` (client price per m²).
- **Relationships**: Looked up by name when creating an etapa; a corresponding `repasses` entry is auto-created when a new preço is saved without one.
- **Validation**: Read by admin or approved client; write by admin only.

### `repasses/{repasseId}`
- **Fields**: `nome` (service name, matches a `precos` entry by name — see code-quality-assessment.md finding on rename orphaning), `val` (internal payout per m²).
- **Relationships**: Mirrors `precos` by name; never exposed to clients.
- **Validation**: Admin-only read/write.

### `diarias/{diariaId}`
- **Fields**: `nome` (labor role), `val` (value per day).
- **Relationships**: Looked up when adding a day-rate line to an etapa.
- **Validation**: Read by admin or approved client (though the client UI never surfaces this collection — see code-quality-assessment.md); write by admin only.

### `parceiros/{parceiroId}`
- **Fields**: `nome`, `doc` (CPF/CNPJ), `telefone`, `criadoEm`.
- **Relationships**: Referenced by `etapas[].parceiros[].parceiroId`; parent of `pagamentos` subcollection.
- **Validation**: Admin-only read/write.

### `parceiros/{parceiroId}/pagamentos/{pagamentoId}`
- **Fields**: `valor`, `obs`, `comprovante` (photo URL), `criadoEm`.
- **Relationships**: Child of `parceiros`; used to compute the partner's paid/owed/balance ledger.
- **Validation**: Admin-only read/write.

### `solicitacoes/{solicitacaoId}`
- **Fields**: `clienteId`, `clienteNome`, `tipo`, `local`, `desc`, `fotos` (array), `status` (`'pendente'|'aceita'|'recusada'`), `criadoEm`.
- **Relationships**: On acceptance, an `obras` doc is created and linked to `clienteId`.
- **Validation**: Approved client may create and read own; **only admin may update/delete** — despite `cliente/app.js` implementing a client-side "edit my solicitation" flow that this rule rejects (see code-quality-assessment.md, broken-feature finding).

### `solicitacoes_pagamento/{solId}` ("cobrança")
- **Fields**: `clienteId`, `clienteNome`, `obraId`, `obraNome`, `etapas` (array snapshot of `{id, tipo, val, dataConc}`), `total`, `mensagem`, `pix` (`{tipo, chave, nome, banco}`), `status` (`'pendente'|'contestada'|'paga'|'cancelada'`), `contestacao`, `comprovante`, `formaPagamento`, `dataPagamento`, `criadoEm`.
- **Relationships**: References an `obras` doc and its `etapas` by id; each referenced etapa is separately flagged `statusCobranca:'solicitacao_pagamento'` via non-atomic sequential writes (see code-quality-assessment.md).
- **Validation**: Admin creates/reads all; client reads own and may update only `status`/`contestacao`/`comprovante`/`formaPagamento`/`dataPagamento`.

### `pagamentos_cliente/{pagId}`
- **Fields**: `obraId`, `clienteId`, `clienteNome`, `valor`, `formaPagamento`, `obs`, `comprovante`, `data`, `status` (`'pendente'|'confirmado'|'contestado'`), `motivoContestacao`, `criadoEm`.
- **Relationships**: References an `obras` doc.
- **Validation**: Client creates/reads own; admin confirms/contests.

### `notificacoes/{notifId}`
- **Fields**: `clienteId`, `obraId`, `obraNome`, `tipo` (`'obra_criada'|'obra_concluida'|'etapa_iniciada'|'etapa_concluida'|'diaria_registrada'|'orcamento_enviado'`), `titulo`, `mensagem`, `lida` (bool), `criadoEm`.
- **Relationships**: References an `obras` doc; scoped to one `clienteId`.
- **Validation**: Client reads own, may update only `lida`; admin creates.

### `orcamentos/{orcId}`
- **Fields**: `obraId`, `obraNome`, `clienteId`, `valor`, `descricao`, `status` (`'pendente'|'aprovado'|'rejeitado'`), `motivo`, `decididoEm`, `criadoEm`.
- **Relationships**: References an `obras` doc; while `status:'pendente'`/`'rejeitado'`, the linked obra is treated as blocked from further stage/diária additions in the admin UI.
- **Validation**: Admin creates/reads all; client reads own and may update only `status`/`motivo`/`decididoEm`.
