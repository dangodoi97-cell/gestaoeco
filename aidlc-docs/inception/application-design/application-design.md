# Application Design — Unit 2: Notificações Push e Correções Críticas de Segurança

**Consolidates**: components.md, component-methods.md, services.md, component-dependency.md (all in this directory). Unit 1 (Fechamento de Caixa e Cores) has no new components and is not covered here — see its Functional Design instead.

## Summary

Unit 2 introduces this project's **first-ever server-side component** (a single Cloud Function) to make real push notifications possible, and closes 2 Critical security findings from reverse-engineering entirely through `firestore.rules` changes — no new server code was needed for those fixes (per Application Design Q1=A and Q5=A).

## Components (6)

| Component | Type | New/Extended |
|---|---|---|
| Firestore Rules — Access Control Layer | Security/Config | Extended (`usuarios`, `etapas`, `fcmTokens`, `notificacoes`) |
| Cloud Functions — NotificationDispatcher | Application (server, Node.js) | **New** |
| Client — NotificationClient (`js/notifications.js`) | Shared client library | **New** |
| Client — Service Worker (`firebase-messaging-sw.js`) | Client library (browser-managed) | **New** |
| Admin Notifications View | Application (UI) | Extension of `admin/app.js`/`admin/index.html` |
| Extended Data Layer (`js/data.js`) | Shared client library | Extended |

Full responsibilities, interfaces, and rationale: see `components.md`.

## Key Design Decisions (from Application Design Q&A)
1. **No new callable Cloud Functions for admin actions** — `aprovarCliente`/`rejeitarCliente`/`promoverParaAdmin` keep their existing direct-`updateDoc` shape; finding #1 is closed purely by tightening `firestore.rules` field-scoping. (Q1=A)
2. **Single `notificacoes` collection serves both directions** — a new `destinatarioTipo` field (`'admin'|'cliente'`) replaces the implicit "always cliente" assumption, avoiding a duplicate collection/listener/render path. (Q2=A)
3. **Cloud Functions in plain JavaScript, no build step** — consistent with the rest of the codebase; this remains the project's only Node.js code, but doesn't introduce a bundler/transpiler anywhere. (Q3=A)
4. **Invalid FCM token cleanup happens inline** inside NotificationDispatcher, not as a separate scheduled/dedicated function. (Q4=A)
5. **Finding #2 (cross-tenant `etapas` leak) is a pure rules fix** — no logging/auditing Cloud Function added in this unit. (Q5=A)

## Service-Level Orchestration (2 flows)
- **Notification Delivery**: event → `criarNotificacao` → Firestore `onCreate` trigger → NotificationDispatcher resolves recipients & sends via FCM → foreground (`onMessage`) or background (service worker) delivery → user sees it; the `notificacoes` doc remains the durable in-app history regardless of push delivery success. See `services.md`.
- **Access Control**: not a call flow — the Rules layer is evaluated by Firestore on every request from every component; the Cloud Function alone runs with Admin SDK privileges and bypasses it by design. See `services.md`.

## Dependency Highlights
- Both `admin/app.js` and `cliente/app.js` now depend on the new shared `js/notifications.js`, mirroring how they already share `js/auth.js`/`js/data.js`.
- The Cloud Function is the only component that talks to the FCM Admin SDK — no other part of the system can push to another user's device, which is precisely why it had to be introduced.
- `firestore.rules` becomes a dependency of literally every existing and new Firestore read/write in the app (not just the new notification/token paths) — this is what makes findings #1/#2 actually closed, not just newly-avoided by new code.
- Full diagram and per-edge rationale: see `component-dependency.md`.

## Explicitly Deferred to Functional Design (per-unit, Construction phase)
- Exact deep-linking target per notification type (User Stories' deferred question A6).
- Exact wording/UX of the notification-permission prompt.
- Whether `removerFcmToken` also runs on logout (mentioned as an open point in component-methods.md).
- Precise Firestore rules syntax for the `etapas` ownership check and the `usuarios` field-scoping (`diff().affectedKeys().hasOnly([...])` expressions) — component-level design says *what* must be true, Functional Design will write the exact rule.
