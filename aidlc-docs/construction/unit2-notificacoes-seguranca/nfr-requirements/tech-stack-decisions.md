# Tech Stack Decisions — Unit 2: Notificações Push e Correções Críticas de Segurança

| Decision | Choice | Rationale |
|---|---|---|
| Cloud Functions generation | 2nd gen | Current default/recommended for new Firebase Functions; better Firestore-trigger ergonomics than 1st gen. |
| Runtime | Node.js 20 (Q1=A) | Current LTS, broadly supported by Firebase Functions 2nd gen. |
| Language | Plain JavaScript, no build step | Application Design Q3=A — consistent with the rest of this zero-build-step codebase. |
| Function type | Firestore-triggered (`onDocumentCreated` on `notificacoes/{notifId}`) | Only mechanism needed — no HTTP callable functions in this unit (Application Design Q1=A: admin actions stay rules-only). |
| Trigger retry policy | Disabled (Q2=A) | Avoids duplicate-send risk; a missed push is non-critical given the in-app fallback (FR-3.5). |
| Firebase Admin SDK | `firebase-admin` (latest stable at implementation time) | Required for Firestore access + FCM send with elevated (Admin SDK) privileges, bypassing `firestore.rules` by design. |
| Firebase Functions SDK | `firebase-functions` v2 (2nd gen) | Matches the 2nd-gen function type decision. |
| Cloud Function service account | Dedicated, scoped (not the broad default) | SECURITY-06 least-privilege — configured in Infrastructure Design, not a code-level dependency. |
| Test runner | Node's built-in `node:test` (reused from Unit 1) | No new framework; already proven in Unit 1's `js/fechamento.test.js`. |
| Property-based testing framework | `fast-check` (reused from Unit 1) | PBT-09 — same framework, avoids fragmenting test tooling across units. |
| Firestore rules testing | `@firebase/rules-unit-testing` (new dependency, Unit 2 only) | The standard tool for testing `firestore.rules` logic (findings #1/#2 fixes) — distinct from `fast-check`, added specifically because this unit, unlike Unit 1, has security rules to verify. |
| Push messaging | Firebase Cloud Messaging (Web Push), via the Firebase JS SDK's Messaging module (client) + `firebase-admin`'s messaging module (server) | Already the platform in use everywhere else in this app; no third-party push provider introduced. |
| CDN integrity | SRI `integrity`/`crossorigin` attributes added to `admin/index.html`/`cliente/index.html`'s existing Firebase SDK + Tabler Icons `<script>`/`<link>` tags (Q6=A) | Closes a reverse-engineering-flagged gap opportunistically; `index.html`/`pendente.html` left as a documented remaining gap (not touched by this unit otherwise). |

## New Dependencies Introduced by This Unit
- `functions/package.json` (new file): `firebase-admin`, `firebase-functions` (runtime dependencies); `@firebase/rules-unit-testing` (dev dependency, for rules tests only).
- Root `package.json` (extended from Unit 1): no new root-level dependency — `fast-check`/`node:test` are reused as-is.
