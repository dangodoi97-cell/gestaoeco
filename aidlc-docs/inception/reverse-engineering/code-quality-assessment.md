# Code Quality Assessment

**Reanalyzed**: 2026-07-06 (rerun — `dev` branch code fully replaced the codebase analyzed on 2026-07-01; see reverse-engineering-timestamp.md).

## Test Coverage
- **Overall**: None
- **Unit Tests**: Not present — no test files or test framework anywhere in the repository.
- **Integration Tests**: Not present.

## Code Quality Indicators
- **Linting**: Not configured — no `.eslintrc`, no `package.json`, no editor config found.
- **Code Style**: Reasonably consistent within each file (naming in Portuguese, `window.fn = ...` handler pattern, `try/catch` + button-disable pattern for async actions), but the same helpers/patterns are re-implemented independently in `admin/app.js` and `cliente/app.js` rather than shared, so style consistency is per-file rather than enforced.
- **Documentation**: Minimal. Files have short section-header comments (`// ---------- OBRAS ----------`) in `js/data.js`, but `admin/app.js`/`cliente/app.js` have almost no comments explaining the pricing/repasse/orçamento/cobrança business rules, which are the most complex part of the codebase. `LEIA-ME.md` documents setup/ops well but not code internals.

## Bugs and Improvement Recommendations

23 findings from a full-file review (every source file read in its entirety), ranked most severe first. Every item is anchored to a concrete file:line and a concrete failure scenario — see each entry for the exact trigger.

### Critical — Security

**1. Any user can self-promote to admin (privilege escalation)**
- **Location**: `firestore.rules:12-13`
- **Description**: The `usuarios/{uid}` create/update rules only check `request.auth.uid == uid` — they never restrict which fields a self-write may touch. A logged-in user can write `{tipo:'admin', status:'aprovado'}` to their own profile doc directly from the browser console.
- **Failure scenario**: A freshly self-registered client, before any admin approval, opens devtools and calls `updateDoc(doc(db,'usuarios',auth.currentUser.uid), {tipo:'admin', status:'aprovado'})`. On next reload, `observarAuth`'s callback reads `perfil.tipo === 'admin'` and grants full admin UI/data access. No Cloud Functions or other server-side check exists anywhere in the repo to catch this.
- **Recommendation**: Restrict the `usuarios` update/create rule so a self-write may only set/modify a safe allowlist of fields (`nome`, `telefone`) via `request.resource.data.diff(resource.data).affectedKeys().hasOnly([...])`, and forbid `tipo`/`status` from ever being set by anyone but an existing admin. Ideally, move `tipo`/`status` transitions to a Cloud Function (`aprovarCliente`/`promoverParaAdmin`) that runs with admin privileges, so the client can never write those fields at all.

**2. Cross-tenant data leak via `etapas` subcollection**
- **Location**: `firestore.rules:25-28`
- **Description**: The `etapas` read rule grants access to *any* approved client for *any* obra's etapas, not just their own — it never checks the parent obra's `clienteId` the way the `obras` read rule does.
- **Failure scenario**: An approved client who learns or guesses another client's `obraId` calls `getDocs(collection(db,'obras','<other-obra-id>','etapas'))` directly and reads every etapa, including the internal `valRepasse` margin figures the admin-only `repasses` table is specifically designed to hide.
- **Recommendation**: Change the etapas read rule to `allow read: if souAdmin() || (souClienteAprovado() && get(/databases/$(database)/documents/obras/$(obraId)).data.clienteId == request.auth.uid);`, matching the ownership check already used on `obras` itself.

**3. Storage rules let unapproved users read/write any obra's photos**
- **Location**: `storage.rules:7-13`
- **Description**: The only Storage rule (`match /obras/{obraId}/{allPaths=**} { allow read, write: if logado(); }`) gates solely on being authenticated — it doesn't check obra ownership or even client-approval status.
- **Failure scenario**: A brand-new self-registered client (`status:'pendente'`, blocked from `cliente/app.js` by `pendente.html`) is nonetheless a fully authenticated Firebase Auth user, and can call the Storage SDK/REST API directly to view, overwrite, or delete another client's before/after photos or receipts, before ever being approved.
- **Recommendation**: Scope the rule to the requesting client's own obras, e.g. check `firestore.get(/databases/(default)/documents/obras/$(obraId)).data.clienteId == request.auth.uid || souAdmin()` (Storage rules can call `firestore.get()`), and additionally gate on `souClienteAprovado()`-equivalent status.

**4. Stored XSS via unescaped `innerHTML` in the admin's privileged session**
- **Location**: `admin/app.js:1183` (and recurring throughout both app files, e.g. `admin/app.js:210`, `:304`, `:881`; `cliente/app.js:161`, `:307`, `:731`)
- **Description**: Client-supplied free text (`s.desc`, `s.local`, notification/orçamento messages, etc.) is interpolated directly into `innerHTML` with no escaping.
- **Failure scenario**: A client submits a service request with `desc` set to `<img src=x onerror="...">`. When the admin opens the Notificações/Solicitações tab, `renderSolicitacoes` injects it unescaped, executing attacker JS inside the admin's authenticated session — which has full access to every `window.*` function the admin app exposes (approve/reject clients, promote to admin, delete obras).
- **Recommendation**: Add a small `esc(str)` helper (HTML-entity-escape `&<>"'`) and wrap every interpolated user-controlled string in every `render*()` function with it, or switch to `textContent`/`createElement` for untrusted fields.

### High

**5. Registration/Google sign-in "pending" gate is UI-only, not server-enforced**
- **Location**: `index.html:148`, `js/auth.js` (`cadastrarCliente`, `loginComGoogle`)
- **Description**: Same root cause as finding #1, reachable from the public, unauthenticated signup form — anyone who can reach `index.html` can create an account and, in the same session, immediately overwrite the `status`/`tipo` on the doc they just created.
- **Failure scenario**: Public signup → immediate self-write bypassing the "pending until admin approval" business rule entirely.
- **Recommendation**: Same fix as #1 (field-scoped rule and/or a Cloud Function callable for the create step) closes this simultaneously.

**6. Storage rules don't cover paths the app actually uploads to — real uploads fail**
- **Location**: `storage.rules:3-13`
- **Description**: Only `obras/{obraId}/**` has a rule. Uploads under `parceiros/**`, `solicitacoes/**`, `pagamentos_cliente/**`, `cobracas/**` — all used by real features — have no matching rule and are denied by Storage's default-deny.
- **Failure scenario**: `uploadFoto` calls from `admin/app.js:1047` (`parceiros/${parceiroDetalheId}/pagamentos/...`), `cliente/app.js:379` (`solicitacoes/${uid}/...`), `:616` (`pagamentos_cliente/${uid}/...`), and `:793` (`cobracas/${uid}/...`) throw `storage/unauthorized` every time; the surrounding catch blocks swallow the real error and show a generic "Erro ao salvar" toast, so partner-payment proof, service-request photos, client-payment proof, and billing-response proof uploads silently never work.
- **Recommendation**: Add matching `match` blocks for each of these path prefixes in `storage.rules`, scoped analogously to the fix in #3 (owning client or admin only).

**7. Clients can never edit a submitted solicitação — feature is fully broken**
- **Location**: `firestore.rules:60`
- **Description**: The rule `allow update, delete: if souAdmin();` on `solicitacoes` never grants the owning client update rights, even though `cliente/app.js` implements a complete "editar solicitação" flow.
- **Failure scenario**: Client opens a pending request, edits the description via `editarSolicitacao`/`salvarSolicitacao` (`cliente/app.js:337-396`, calling `atualizarSolicitacao` at line 386), and gets a generic "Erro ao enviar" — the write is always rejected by the rule above.
- **Recommendation**: Add `allow update: if souClienteAprovado() && resource.data.clienteId == request.auth.uid && resource.data.status == 'pendente';` so clients can edit only their own still-pending requests.

**8. Price rename silently orphans the linked repasse row**
- **Location**: `admin/app.js:1087`
- **Description**: `salvarPreco`'s rename branch looks up the linked repasse by the *new* name (`db_repasses.find(r => r.nome === nome)`) instead of the old one, so it never finds the existing repasse and never renames it.
- **Failure scenario**: Admin renames "Piso" → "Piso Cerâmico". The repasse row stays named "Piso" forever. `calcularValor`/`onTipoChange` (`admin/app.js:464-501`) look up repasse by the *current* preço name and find nothing, so every future etapa of that service type silently loses internal margin/repasse tracking with no error shown.
- **Recommendation**: Look up the existing repasse by the *old* name (captured before the rename) and update that document's `nome`/`val`, not `find` on the new name.

**9. Billing (cobrança) writes are non-atomic — partial failure corrupts billing state**
- **Location**: `admin/app.js:1715-1768` (`enviarCobranca`), mirrored in `cancelarCobranca` (`admin/app.js:1804-1813`)
- **Description**: `enviarCobranca` creates the `solicitacoes_pagamento` doc, then loops with separate sequential `await atualizarEtapa(...)` calls to flag each referenced etapa `statusCobranca:'solicitacao_pagamento'`.
- **Failure scenario**: Network drops after the 2nd of 4 etapa updates. The solicitação already references all 4 etapas, but only 2 are actually flagged — the other 2 remain selectable in `carregarEtapasCobranca` for a second, duplicate cobrança.
- **Recommendation**: Use Firestore `writeBatch()` to create the solicitação doc and update all referenced etapas atomically in both `enviarCobranca` and `cancelarCobranca`.

### Medium

**10. `hoje()` uses UTC, misdating "today" for ~3 hours daily for Brazilian users**
- **Location**: `js/data.js:236`
- **Description**: `hoje()` derives today's date from `new Date().toISOString()`, which is UTC (Brazil is UTC-3).
- **Failure scenario**: A user in São Paulo opens the app at 21:30 local time; `toISOString()` already reads `00:30` the next day in UTC, so `hoje()` returns tomorrow's date. This flags obras as "Prazo vencido" a day early (`admin/app.js:205`, `cliente/app.js:188`) and mis-dates new etapas/diárias/payment records created in that window.
- **Recommendation**: Build the date string from local `Date` getters (`getFullYear()`/`getMonth()`/`getDate()`) instead of `toISOString()`.

**11. Missing error handling on several state-changing handlers**
- **Location**: `admin/app.js:224` (`salvarObra`) and similarly `confirmarExcluirObra`, `aprovarClienteAcao`, `rejeitarClienteAcao`, `promoverAdmin`, `concluirObra`, `concluirDiariaAntiga`
- **Description**: These handlers have no `try/catch` at all, unlike the disable-button → await → catch → toast pattern used elsewhere.
- **Failure scenario**: Admin clicks "Criar obra" while briefly offline; the promise rejects with no catch, so the modal never closes, no toast appears, and the button never re-enables — the admin has no idea whether the obra was created and may retry, risking duplicates once connectivity resumes.
- **Recommendation**: Wrap each in the same try/disable/catch/toast pattern already used by the majority of `salvar*` functions in the same file.

**12. `escutarTodasEtapas` fully tears down and rebuilds on every trivial obra edit**
- **Location**: `js/data.js:114-129`; callers at `admin/app.js:46-57`, `cliente/app.js:46-66`
- **Description**: The `escutarObras` callback unconditionally unsubscribes and recreates one etapas listener per obra on every single obras snapshot.
- **Failure scenario**: `salvarFinanceiroObra` calls `atualizarObra` on every `onchange` of the entrada field; each save re-triggers the obras listener, tearing down and recreating N per-obra etapas listeners and re-downloading every etapa of every obra. As obra count grows, this becomes O(N) listener churn on nearly every write anywhere in the app.
- **Recommendation**: Diff the incoming obra id list against the currently-subscribed ids and only add/remove listeners for obras that actually appeared/disappeared, rather than tearing down everything each time.

**13. Notification/history collections have no `limit()` and are never pruned**
- **Location**: `js/data.js:366` and similar (`escutarNotificacoes`, `escutarSolicitacoes`, `escutarPagamentosCliente`, `escutarSolicitacoesPagamento`, `escutarOrcamentos`)
- **Description**: These queries use `orderBy` with no `limit`; `marcarNotificacaoLida` only flips `lida`, nothing ever deletes old notifications.
- **Failure scenario**: After a year of normal use across dozens of obras, a client's notifications listener downloads and holds thousands of documents on every page load, with no pagination UI, steadily increasing load time and Firestore read cost.
- **Recommendation**: Add `limit(N)` with "load more" pagination, and/or a scheduled cleanup (Cloud Function or manual admin action) that archives/deletes notifications older than N days.

**14. `uploadFoto`/`fileParaBase64` have no size or type validation**
- **Location**: `js/data.js:12-25`
- **Description**: No error handling, size cap, or client-side compression before base64-encoding (≈33% overhead) and uploading a selected photo.
- **Failure scenario**: A user selects a 12MB photo; the resulting ~16MB base64 string can time out on slow mobile connections, and several callers don't wrap the related flow in try/catch, so failures surface as unhandled rejections rather than a user-facing message.
- **Recommendation**: Downscale/compress images client-side (e.g. via `<canvas>`) before encoding, cap accepted file size with a clear error toast, and ensure every `uploadFoto` call site is wrapped in try/catch.

### Low

**15. Detail-page listeners aren't unsubscribed on back-navigation**
- **Location**: `admin/app.js:253-263` (`abrirObra`), `:938-950` (`abrirParceiroDetalhe`); `cliente/app.js:227-235`
- **Description**: `unsubEtapasAtivas`/`unsubEncargos`/`unsubPagamentos` are only replaced the next time a detail page opens — not torn down when the user navigates back to the list.
- **Failure scenario**: Admin opens obra A's detail, then taps "Voltar"; the listener keeps firing re-renders against DOM elements no longer visible until another detail page is opened. Wastes reads/CPU proportional to session navigation.
- **Recommendation**: Call the relevant `unsub*()` in the "back" navigation handler (`goPage`), not only right before creating the next listener.

**16. Dead code: stale button-rebind selector never matches**
- **Location**: `admin/app.js:146`
- **Description**: A `DOMContentLoaded` handler looks for `[onclick="showModal('modal-nova-obra')"]`, but the actual button (`admin/index.html:45`) uses `onclick="abrirModalNovaObra()"` — the selector never matches.
- **Recommendation**: Delete the dead block; `window.abrirModalNovaObra` already handles this correctly.

**17. `setNomeParceiroAvulso` computes a DOM reference but never uses it**
- **Location**: `admin/app.js:1462`
- **Description**: Updates the underlying data model correctly but builds an unused `el` reference instead of updating the visible line summary.
- **Failure scenario**: Admin types a custom partner name for a diária line; the saved data is correct but the on-screen label stays stale until an unrelated re-render happens.
- **Recommendation**: Use the computed element to update the label's `textContent` directly, or call the existing `renderLinhasDiariaAvulsa()` after the assignment.

**18. Utility-function duplication between `admin/app.js` and `cliente/app.js`**
- **Location**: `admin/app.js:76-100` vs `cliente/app.js:92-114` (`toast`, `fmtBRL`/`parseBRL`, `openLightbox`/`closeLightbox`, `fotosHTML`)
- **Description**: Each is implemented twice with already-diverging behavior (e.g. admin's lightbox toggles a `.show` class, cliente's toggles inline `style.display`).
- **Recommendation**: Extract these into a shared `js/ui-helpers.js` imported by both app files.

**19. Missing `label for=` across form inputs (accessibility)**
- **Location**: `admin/index.html:185` and pervasively throughout both `admin/index.html` and `cliente/index.html`
- **Description**: `<label>` elements aren't associated with their inputs via `for`/`id`, so the relationship is only visual.
- **Recommendation**: Add matching `id`/`for` pairs to every labeled form control.

**20. Missing `alt` text on dynamically rendered photos**
- **Location**: `admin/app.js:88` (`fotosHTML`), shared lightbox `<img>`
- **Description**: Thumbnails render with no `alt` even though the caller already has label text available; `cliente/app.js`'s equivalent does set `alt` correctly, but the shared lightbox image never gets one.
- **Recommendation**: Pass the existing label text into the `alt` attribute at every `<img>` call site, including the lightbox.

**21. `manifest.json` is orphaned and has no icons**
- **Location**: `manifest.json:8`
- **Description**: `icons: []` is empty, and no HTML file links the manifest via `<link rel="manifest">`.
- **Failure scenario**: "Add to Home Screen" either doesn't prompt as an installable PWA or installs with no icon, despite `display:'standalone'` implying an app-like experience.
- **Recommendation**: Add a `<link rel="manifest" href="/manifest.json">` to every HTML entry point and populate `icons` with at least a 192px and 512px PNG.

**22. Even-split repasse rounding can desync from the etapa total (Plausible)**
- **Location**: `admin/app.js:602-606` (`distribuirRepasseIgual`)
- **Description**: Dividing a repasse total evenly across N partners with per-item `.toFixed(2)` rounding can lose/gain a cent versus the etapa's own `valRepasse`.
- **Failure scenario**: R$10,00 split three ways becomes 3×R$3,33 = R$9,99, one cent short of the recorded R$10,00 total — small discrepancies accumulate across many etapas between per-partner payables and the obra-level repasse total.
- **Recommendation**: Compute all-but-last shares by truncation and assign the remainder to the last partner so the sum always exactly matches the total.

**23. `diarias` collection is client-readable though the client UI never uses it (Plausible)**
- **Location**: `firestore.rules:44`
- **Description**: `allow read: if souAdmin() || souClienteAprovado();` exposes internal day-rate labor pricing to any approved client, even though `cliente/app.js`/`cliente/index.html` never fetch or display it.
- **Recommendation**: Tighten to `allow read: if souAdmin();` unless a client-facing use is planned, consistent with the deliberately admin-only `repasses` collection.

## Technical Debt

- **Duplicated UI/helper logic between `admin/app.js` and `cliente/app.js`** — see finding #18.
- **Unescaped HTML interpolation in every render function** — see finding #4 (stored XSS).
- **String-based currency arithmetic** — `parseBRL`/`fmtVal` convert between comma-decimal display strings and numbers ad hoc at each call site rather than storing/working with numeric cents; rounding/parsing bugs are easy to introduce here (see finding #22). Location: `admin/app.js`, `cliente/app.js`.
- **Implicit global data bus** — `window._todasEtapas` is populated independently by each app and consumed by several unrelated render functions with no type/freshness contract; it only works because both files happen to agree on the same variable name and shape.
- **Legacy schema compatibility fields left in place** — `etapas.aprovacao` is a holdover from before the orçamento-based approval flow (per `LEIA-ME.md`'s 2026-07-04 changelog note) and is largely superseded but still read in places; `etapas.parceiros` vs a possible legacy single-`parceiroId` shape should be verified against production data before removing either code path.
- **No pagination/virtualization** — every list view replaces `innerHTML` wholesale on each Firestore snapshot (see findings #12, #13); this won't scale past a modest number of obras/etapas/parceiros and will lose scroll position/focus on re-render.
- **Hard-coded Firebase config committed to the repo** — `js/firebase-config.js` contains the live `apiKey`/`projectId`/etc. for the `gestaoecosytem` project directly in source. This is normal/expected for Firebase web apps (the API key is not a secret; access control is enforced by `firestore.rules`/`storage.rules`), but it does mean the app is pinned to one specific Firebase project with no environment-based configuration.

## Patterns and Anti-patterns

- **Good Patterns**:
  - Firestore security rules (`firestore.rules`) correctly encode the admin/cliente-aprovado access model with helper functions (`logado`, `souAdmin`, `souClienteAprovado`) and field-level update restrictions on several collections (e.g. clients may only touch `status`/`motivo`/`decididoEm` on `orcamentos`, only `lida` on `notificacoes`) — though this discipline is inconsistently applied (see findings #1, #2, #7).
  - Consistent real-time "listen and re-render" pattern makes the UI reactive without any state-management library.
  - Consistent manual subscription cleanup (`unsub*` variables) prevents most listener leaks when navigating to a *new* detail view (though not on back-navigation — see finding #15).
  - Centralized Firebase SDK access through `js/firebase-config.js` (single import chokepoint) makes an eventual SDK version bump or backend swap easier.
  - Portuguese domain naming is consistent and matches the business domain throughout (`obra`, `etapa`, `encargo`, `parceiro`, `repasse`, `diária`, `orçamento`, `cobrança`), aiding readability for the intended (Brazilian Portuguese-speaking) maintainers.

- **Anti-patterns**:
  - Global mutable state instead of encapsulated components (see Technical Debt above).
  - Inline `onclick="..."` + `window.fn` handler wiring instead of `addEventListener`/event delegation.
  - String-templated HTML with no escaping (XSS risk, finding #4) instead of a templating/sanitization layer.
  - Copy-pasted logic across create/edit flows and across the two app files instead of shared functions/modules (finding #18).
  - Authorization logic duplicated in principle between Firestore rules and client-side UI gating, with the two drifting out of sync (findings #1, #2, #6, #7) instead of the rules being the sole, carefully-audited source of truth.
  - Native blocking `confirm()` dialogs for destructive actions instead of the app's own modal system, inconsistent with the rest of the UX.
