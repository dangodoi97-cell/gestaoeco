# Business Rules — Unit 2: Notificações Push e Correções Críticas de Segurança

## Rule Set: `usuarios` Field-Level Access (closes RE finding #1)
1. Any authenticated user may `create`/`update` their own `usuarios/{uid}` document, but such a self-write may **only** touch `nome`, `telefone`, `fcmTokens`. Any attempt to include `tipo` or `status` in a self-write must be rejected.
2. Only a user whose own `usuarios` document has `tipo:'admin'` may write `tipo` or `status` on **any** `usuarios` document (their own or another's).
3. There is no other code path (no Cloud Function, no client SDK bypass) that can set `tipo`/`status` — rule 1+2 are the complete enforcement (per Application Design Q1=A).
4. **Consequence**: `aprovarCliente`/`rejeitarCliente`/`promoverParaAdmin` (`js/data.js`) keep their exact current implementation (direct `updateDoc` from the admin's already-authenticated session) — they continue to work only because the calling user satisfies rule 2, not because of any new code.

## Rule Set: `etapas` Ownership Scoping (closes RE finding #2)
1. An admin may read any `obras/{obraId}/etapas/*`.
2. An approved client may read `obras/{obraId}/etapas/*` **only if** `obras/{obraId}.clienteId` equals that client's own uid.
3. No read path exists for a client to access another client's etapas, directly or via a listener — this must hold even if the client knows the target `obraId` (the current vulnerability).
4. `repasses` and `diarias`-style internal fields remain invisible to clients through this same mechanism — no separate field-masking is needed once ownership scoping is correct, since the whole etapa document (including `valRepasse`) is simply unreadable for a non-owning client.

## Rule Set: `fcmTokens` Field Access
1. A user may add or remove entries in their own `usuarios/{uid}.fcmTokens` array (client-side, on permission grant / logout per Q2=A).
2. No user may read or write another user's `fcmTokens` — this is a device identifier and must not be exposed even to admins beyond what's operationally needed (the Cloud Function reads it via the Admin SDK, which bypasses rules entirely, so no rule needs to grant it read access for that purpose).

## Rule Set: `notificacoes` Access and the New Client-Write Surface
1. **Read**: a client may read a `notificacoes` document only where `destinatarioTipo == 'cliente' AND clienteId == request.auth.uid`. An admin may read any document where `destinatarioTipo == 'admin'`, and also every cliente-facing one (unchanged from today's implicit full-admin-read).
2. **Update**: a client may update only the `lida` field on their own cliente-facing notifications (unchanged from today). Admins may update `lida` on admin-facing ones.
3. **Create — cliente-facing (6 existing types)**: unchanged, admin-only (only an admin's action produces these).
4. **Create — admin-facing (5 new types)**: this is new — an approved client must now be able to create a `notificacoes` document themselves (there is no Cloud Function standing between the client action and the notification, per Application Design). This is scoped as narrowly as Firestore rules reasonably allow:
   - `destinatarioTipo` must be exactly `'admin'`
   - `tipo` must be one of the 5 fixed values: `solicitacao_criada`, `orcamento_decidido`, `pagamento_cliente_registrado`, `cobranca_respondida`, `avaliacao_registrada`
   - `lida` must be `false` at creation (defense-in-depth double-check; already guaranteed by `criarNotificacao`'s field-ordering in `js/data.js`, per Part B3 note)
   - `clienteId` field must be absent/null (admin-facing notifications don't carry a `clienteId` per the domain model — prevents a client from also stuffing a cliente-facing shape into the same write)
   - **Accepted, bounded risk**: rules cannot practically verify that the referenced `linkId` (e.g. a `solicitacaoId`) is a document the client is simultaneously and legitimately creating in the same logical action — a client could theoretically create a spurious admin-facing notification (e.g. a fake "avaliação registrada" pointing at an obra they don't own). The worst case is **noise visible only to admins** (a misleading in-app/push notification) — no data leak, no privilege change, no financial impact. This is judged acceptable for this app's size and threat model; if abuse becomes a real problem later, tightening this to a Cloud Function callable is the documented upgrade path (Application Design Q1's "rules + Cloud Functions" option, deferred).

## Rule Set: Notification Content by Event Type (from business-logic-model.md A1)
Each event's `titulo`/`mensagem` follows the existing Portuguese-language convention already used by the 6 existing types (e.g. `orcamento_enviado`'s "Um orçamento de R$ X foi enviado para sua aprovação."). New types:
- `cobranca_enviada`: "Nova cobrança recebida" / "Uma cobrança de R$ {total} foi enviada para pagamento."
- `solicitacao_criada`: "Nova solicitação de {clienteNome}" / "{clienteNome} enviou uma nova solicitação de serviço."
- `orcamento_decidido`: "Orçamento {aprovado|rejeitado}" / "{clienteNome} {aprovou|rejeitou} o orçamento de R$ {valor}."
- `pagamento_cliente_registrado`: "Pagamento registrado por {clienteNome}" / "{clienteNome} registrou um pagamento de R$ {valor}."
- `cobranca_respondida`: "Cobrança {paga|contestada}" / "{clienteNome} {pagou|contestou} a cobrança de R$ {total}."
- `avaliacao_registrada`: "Nova avaliação de {clienteNome}" / "{clienteNome} avaliou a obra '{obraNome}' com {nota} estrelas."

## Rule Set: Deep-Linking (Q1=A)
1. Every `notificacoes` document carries `linkPagina` and `linkId` at creation (set by whichever code calls `criarNotificacao` — never inferred later).
2. If the referenced entity (obra/solicitação/pagamento/cobrança) no longer exists by the time the notification is opened (e.g. deleted obra), the deep-link handler falls back to simply calling `goPage(linkPagina)` without opening a specific detail, and shows nothing broken — this is a reasonable, low-probability edge case that doesn't need a dedicated error UI.

## Rule Set: Token Lifecycle (Q2=A)
1. On successful login and permission grant, exactly one token is registered per device/browser (re-registering an already-known token is a harmless no-op — `salvarFcmToken` uses array-union semantics, per Application Design's component-methods.md).
2. On logout, the current device's token (if one was registered this session) is removed before `signOut()` completes.
3. On a failed send (any recipient), the Cloud Function removes that specific token inline — unaffected by this unit's logout behavior, since a token can go stale between logout events too (e.g. app uninstalled without logging out first).
