# Code Generation Plan — Unit 2: Notificações Push e Correções Críticas de Segurança

**Workspace Root**: `c:\repos-true\gestaoeco` (brownfield — modify existing files in place)
**Design sources**: functional-design/, nfr-requirements/, nfr-design/, infrastructure-design/ (all under `aidlc-docs/construction/unit2-notificacoes-seguranca/`)

## Pre-Generation Finding (from reading the actual current code)
Fixing RE finding #1 by locking down `usuarios` writes would break the existing `cadastrarAdmin` feature as currently implemented: `createUserWithEmailAndPassword` on the **primary** Auth instance immediately signs the browser in as the *newly created* admin, replacing the original admin's session — so today's code, unmodified, would have the *new* admin self-writing `tipo:'admin'` to their own doc, which is indistinguishable from the attack we're closing. **Fix**: rewrite `cadastrarAdmin` to create the new Auth user on a **secondary, isolated Firebase App/Auth instance** so the original admin's primary session is never replaced, then write the new user's `usuarios` doc using the *original admin's* still-active primary session (an admin-writes-another-user's-doc, already permitted). This is a required correctness fix, not optional — without it, Unit 2 would ship a security fix that breaks a real feature.

## Steps

### Step 1: Business Logic Generation — Security Rules
- [ ] Modify `firestore.rules`: add `souProprietarioObra(obraId)` helper; fix `usuarios` create/update rules (finding #1, including the create-path tipo/status lockdown); fix `etapas` read rule (finding #2); extend `notificacoes` read/create/update rules (destinatarioTipo, the 5-value client-create allowlist)
- **Traceability**: business-rules.md's 4 rule sets; nfr-design-patterns.md's 3 named security patterns

### Step 2: Business Logic Generation — Cloud Function
- [ ] Create `functions/package.json` (firebase-admin, firebase-functions; devDeps: node:test via npm scripts only, no extra runner)
- [ ] Create `functions/index.js` (exports `onNotificacaoCreated`)
- [ ] Create `functions/notificationDispatcher.js` (`resolveRecipients`, `sendToTokens`, main handler — Fail-Fast Dispatch pattern, no retry, inline token cleanup)
- **Traceability**: business-logic-model.md A1-A2, A4; infrastructure-design.md

### Step 3: Business Logic Unit Testing
- [ ] Create `functions/notificationDispatcher.test.js` (`node:test`, dependency-injected/stubbed `firebase-admin` — no live Firebase project needed for these)
- [ ] Create `firestore.rules.test.js` (root level, using `@firebase/rules-unit-testing` + the Firestore emulator) covering: finding #1 (self-promotion denied, admin-creates-admin-via-primary-session allowed), finding #2 (cross-tenant etapas read denied, owner read allowed), the new `notificacoes` client-create allowlist (allowed shape succeeds, disallowed shape denied)
- **Traceability**: this is the direct verification that findings #1/#2 are actually closed

### Step 4: Business Logic Summary
- [ ] Document Steps 1-3 in `aidlc-docs/construction/unit2-notificacoes-seguranca/code/summary.md`

### Step 5: Data Layer Generation (extends `js/data.js`)
- [ ] Extend `criarNotificacao`, `escutarNotificacoes` (new `filtro` param shape); add `salvarFcmToken`, `removerFcmToken`
- **Traceability**: component-methods.md (Application Design), business-logic-model.md A1

### Step 6: Frontend Components Generation — Shared Client Code
- [ ] Create `js/notifications.js` (`initNotifications`, `onForegroundMessage`, `requestPermissionAndToken`, `handleNotificationOpen`, token tracking for logout)
- [ ] Extend `js/firebase-config.js` (Messaging SDK init/export, VAPID key constant placeholder — real key added by the user post-deploy per the infrastructure checklist)
- [ ] Create `firebase-messaging-sw.js` (repo root)

### Step 7: Frontend Components Generation — Admin Panel
- [ ] Modify `js/auth.js`: fix `cadastrarAdmin` per the Pre-Generation Finding above (secondary app instance)
- [ ] Modify `admin/app.js`: import `js/notifications.js`; call `initNotifications` after login; add admin-facing notification rendering inside the existing `page-aprovacao`; wire `handleNotificationOpen`; extend `sairConta` to remove the FCM token on logout; handle `location.search` deep-link params on load
- [ ] Modify `admin/index.html`: add `<link rel="manifest">`; add SRI to the Tabler Icons `<link>` tag (real hash computed — see below); add the admin notifications list container inside `page-aprovacao`
- **Traceability**: frontend-components.md (Unit 2), business-rules.md

### Step 8: Frontend Components Generation — Cliente Panel
- [ ] Modify `cliente/app.js`: import `js/notifications.js`; call `initNotifications`; add the 5 new `criarNotificacao` call sites (at `salvarSolicitacao`, `aprovarOrcamentoAtivo`/`rejeitarOrcamentoAtivo`, `salvarPagamentoCliente`, `confirmarPagamentoCob`/`contestarCobranca`, `enviarAvaliacaoObra`); wire click-through on the existing notification list to `handleNotificationOpen`; extend `sairConta`; handle deep-link params on load
- [ ] Modify `cliente/index.html`: `<link rel="manifest">`; SRI on the Tabler Icons tag
- **Traceability**: frontend-components.md's "Cliente Panel Changes" section

### Step 9: Frontend Components Generation — Login Shell + Manifest Linking (FR-3.7)
- [ ] Modify `index.html`, `pendente.html`: add `<link rel="manifest">` (no notification logic needed pre-login/pending)
- **Note**: SRI was explicitly scoped (NFR Requirements Q6) to files already touched for other reasons — `index.html`/`pendente.html` are not otherwise touched by this unit, so SRI there remains a documented remaining gap, consistent with that decision.

### Step 10: Frontend Components Testing
- [ ] No DOM/browser test framework (same rationale as Unit 1). Manual verification steps documented in Build and Test: permission prompt appears once, deep-link opens the right screen, admin sees client-triggered notifications and vice versa.

### Step 11: Deployment Artifacts Generation
- [ ] Create `firebase.json` (repo root)
- [ ] Update `LEIA-ME.md` with the new deploy steps (VAPID key generation, service account creation, `firebase deploy --only functions`, region/billing checklist) from deployment-architecture.md

### Step 12: Documentation Generation
- [ ] Finalize `aidlc-docs/construction/unit2-notificacoes-seguranca/code/summary.md` with full file list and the `cadastrarAdmin` fix explanation

## SRI Hash (pre-computed, verified against the exact pinned CDN URL)
`https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@2.47.0/tabler-icons.min.css` → `sha384-PwEnNZvp50/uDLtKrd1s2D4Xe/y+fCVtEigigjik/PgHlDXUF1uJ32m7guk/XWYV` (downloaded and hashed twice for consistency during this planning step). **Correction to NFR docs**: SRI applies only to this one `<link>` tag per HTML file — the Firebase SDK is loaded via ES module `import` statements (in `.js` files), which have no `integrity` attribute equivalent; SRI is a browser feature for `<script src>`/`<link>` tags only. NFR Requirements/Design's mention of "Firebase SDK CDN tags" needing SRI was imprecise — noting the correction here rather than silently narrowing scope.

## Not Applicable for This Unit
- **API Layer**: N/A — `NotificationDispatcher` is Firestore-triggered, not an HTTP endpoint
- **Database Migration Scripts**: N/A — Firestore is schemaless; new fields need no migration
