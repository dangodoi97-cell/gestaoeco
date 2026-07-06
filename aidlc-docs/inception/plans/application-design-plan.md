# Application Design Plan — Unit 2: Notificações Push e Correções Críticas de Segurança

**Scope**: Only Unit 2 (per execution-plan.md). Unit 1 has no new components and skips Application Design.
**Source**: `aidlc-docs/inception/requirements/requirements.md` (FR-3), reverse-engineering Critical findings #1/#2.

## Execution Checklist

- [ ] Step 1: Answer component/service boundary questions below
- [ ] Step 2: Generate `aidlc-docs/inception/application-design/components.md`
- [ ] Step 3: Generate `aidlc-docs/inception/application-design/component-methods.md`
- [ ] Step 4: Generate `aidlc-docs/inception/application-design/services.md`
- [ ] Step 5: Generate `aidlc-docs/inception/application-design/component-dependency.md`
- [ ] Step 6: Generate consolidated `aidlc-docs/inception/application-design/application-design.md`

## Draft Component Landscape (for context — subject to the answers below)

This app has never had a server-side component. Unit 2 introduces:
- **Cloud Functions** (new `functions/` package): privileged admin actions (candidate fix for RE finding #1) and a notification dispatcher that calls the FCM Admin SDK (the only way to push to *another* user's device).
- **Firestore Rules layer**: tightened `usuarios` self-write scoping (finding #1) and ownership-scoped `etapas` reads (finding #2) — this is a rules change, not necessarily new code.
- **Client Notification module** (new shared `js/notifications.js`): permission request, FCM token registration/storage, foreground message handling — used by both `admin/app.js` and `cliente/app.js`.
- **Service Worker** (new `firebase-messaging-sw.js`): background push receipt/display.

## Questions

### Question 1 — Admin action hardening approach
Finding #1 (self-promotion to admin) can be fixed at two levels of rigor:

A) **Rules-only**: tighten `firestore.rules` so a self-write to `usuarios` can never touch `tipo`/`status` — `aprovarCliente`/`rejeitarCliente`/`promoverParaAdmin` keep working exactly as today (direct `updateDoc` from the admin's browser), just no longer exploitable by a non-admin. Simpler, one less moving part.
B) **Rules + Cloud Functions (defense in depth, recommended by the enabled Security Baseline's SECURITY-11)**: same rules tightening as A, PLUS move `aprovarCliente`/`rejeitarCliente`/`promoverParaAdmin` into 3 callable Cloud Functions that independently re-verify the caller is an admin server-side before writing. More robust against a future rules regression, more code to maintain.
X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 2 — Where do admin-facing notifications live?
FR-3.2 requires the admin to also receive notifications (client submitted a solicitação, decided on an orçamento, registered a payment, rated an obra).

A) Reuse the existing `notificacoes` collection, adding a `destinatarioTipo` field (`'admin'|'cliente'`) so one collection serves both directions
B) Create a new, separate collection (e.g. `notificacoes_admin`) so client-facing and admin-facing notifications never mix, at the cost of a second nearly-identical collection/listener/render path
X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 3 — Cloud Functions language/runtime
A) Plain JavaScript (Node.js), consistent with the rest of this zero-build-step codebase
B) TypeScript with a build step — this would be the project's first build step ever, anywhere
X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 4 — Invalid FCM token cleanup
When a push send fails because a device token expired/was revoked, something should remove it from that user's stored token list so future sends don't keep failing against it.

A) Handle it inline inside the same notification-dispatch function (on a failed send, delete that token from `usuarios/{uid}.fcmTokens`) — one component, simpler
B) A separate, dedicated token-maintenance function/component
X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 5 — Finding #2 fix scope confirmation
The cross-tenant `etapas` read leak (finding #2) can be fully fixed with a `firestore.rules` change alone (scope the read to the parent obra's `clienteId` via `get()`), with no Cloud Function involved.

A) Confirmed — rules-only fix, no function needed
B) Also want a Cloud Function / logging mechanism that records denied-access attempts for visibility (adds a logging component, ties into Security Baseline SECURITY-14 Alerting/Monitoring which is otherwise N/A for this project today)
X) Other (please describe after [Answer]: tag below)

[Answer]: a
