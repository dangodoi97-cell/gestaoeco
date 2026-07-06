# Code Generation Summary — Unit 2: Notificações Push e Correções Críticas de Segurança

## Files Created
- `functions/package.json`, `functions/index.js`, `functions/notificationDispatcher.js` — the project's first Cloud Function (Firestore-triggered, `southamerica-east1`, no retry)
- `functions/notificationDispatcher.test.js` — 12 dependency-injected unit tests (no emulator needed)
- `firestore.rules.test.js` (root) — 12 tests against the **real Firestore emulator**, directly verifying findings #1 and #2 are closed
- `firebase.json`, `firestore.indexes.json` — project's first Firebase CLI config; 2 composite indexes for the new bidirectional `notificacoes` queries
- `js/notifications.js` — client-side push permission/token/deep-link module, shared by both panels
- `firebase-messaging-sw.js` (repo root) — background push receipt + click routing (including live-postMessage routing when the app is already open)
- `js/fechamento.js`, `js/fechamento.test.js`, `package.json`, `package-lock.json` — *(from Unit 1, unchanged by this unit)*

## Files Modified
- `firestore.rules` — closes RE finding #1 (`usuarios` create/update field-scoping, including a create-path lockdown that didn't exist before) and finding #2 (new `souProprietarioObra()` predicate scoping `etapas` reads); extends `notificacoes` rules for the new bidirectional/`destinatarioTipo` shape and the client-writable admin-facing allowlist
- `js/auth.js` — **`cadastrarAdmin` rewritten** to use a secondary, disposable Firebase App instance (see "Pre-Generation Finding" below) — required for the finding #1 fix to not break this existing feature
- `js/data.js` — `escutarNotificacoes` (new `filtro` shape), `criarNotificacao`/`enviarOrcamento` callers extended with `destinatarioTipo`/`linkPagina`/`linkId`; new `salvarFcmToken`/`removerFcmToken`
- `js/firebase-config.js` — Messaging SDK export (`obterMessaging`, lazily checks browser support), `VAPID_KEY` placeholder, `arrayUnion`/`arrayRemove` re-exports, and `firebaseConfig`/`initializeApp`/`deleteApp`/`getAuth` re-exports (needed by the `cadastrarAdmin` fix)
- `admin/app.js` — notification permission flow, admin-facing notification rendering (`page-aprovacao`), 6 existing + 1 new (`cobranca_enviada`) notification call sites extended with the new fields, deep-link handling, logout token cleanup
- `admin/index.html` — permission banner, admin notifications list section, `<link rel="manifest">`, SRI on the Tabler Icons tag
- `cliente/app.js` — notification permission flow, 5 new client-triggered notification call sites (solicitação, orçamento decisão, pagamento, resposta de cobrança ×2, avaliação), deep-link handling (incl. existing notification list click-through), logout token cleanup
- `cliente/index.html` — permission banner, `<link rel="manifest">`, SRI on the Tabler Icons tag
- `index.html`, `pendente.html` — `<link rel="manifest">` only (FR-3.7; no push logic pre-login)
- `LEIA-ME.md` — new dated changelog entry + PASSO 6 (Cloud Functions/FCM setup checklist) + updated file tree
- `.gitignore` — emulator debug logs, `.firebase/` cache

## Pre-Generation Finding: `cadastrarAdmin` had to be fixed, not just the rules
Discovered while reading the actual code (not caught in earlier design stages): `createUserWithEmailAndPassword` on the primary Auth instance signs the browser in as the *newly created* user, replacing the calling admin's session. Under the old, permissive rules this was invisible; under the new field-scoped rules it would have **broken admin creation entirely** (the new user's self-write of `tipo:'admin'` would now be rejected, same as the attack being closed). Fixed by creating the new user on a secondary, disposable Firebase App/Auth instance and writing the profile from the original admin's untouched primary session — verified by the emulator test `achado #1 (fix do cadastrarAdmin): admin existente pode criar o perfil de OUTRO usuário como admin`.

## Tests — All Passing
```
npm test              # 13/13 (Unit 1, unchanged) + resides alongside...
functions: npm test   # 12/12 (notificationDispatcher, mocked — no emulator needed)
npm run test:rules    # 12/12 (real Firestore emulator — findings #1/#2 verified live)
```
Total: 37/37 across all 3 suites, all run and passing during generation (not just written).

## Known Issue Tracked, Not Fixed
`functions/` has 8 moderate `npm audit` advisories, all transitive through `firebase-admin` → `@google-cloud/storage` → `retry-request`/`teeny-request`. Not introduced by this unit's code; forcing a fix (`npm audit fix --force`) would downgrade/change `firebase-admin` itself and risk breaking compatibility. Documented per SECURITY-10 rather than silently ignored or blindly force-fixed — revisit when `firebase-admin` ships an update with patched transitive deps.

## Requirements Coverage
FR-3.1–FR-3.7 and RE Critical findings #1/#2 — full coverage. User Stories' deferred deep-linking edge case (A6) implemented per business-logic-model.md's `linkPagina`/`linkId` design.

## Not Generated (per plan, N/A for this unit)
API layer (no HTTP endpoint), database migration scripts (schemaless additive fields only), automated DOM/browser tests (manual verification deferred to Build and Test).

## Manual Steps Still Required Before This Is Live (not code — see LEIA-ME.md PASSO 6)
VAPID key generation and paste into `js/firebase-config.js`, Blaze plan confirmation, dedicated service account creation, `firebase deploy --only firestore:rules,functions`.
