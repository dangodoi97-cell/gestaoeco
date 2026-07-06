# Unit of Work Definitions

**Delivery**: Both units are held and delivered together as one combined change set (Question 1=B) — this document still separates them logically for design/construction purposes, since they have different risk profiles and construction-stage needs (see execution-plan.md).

## Unit 1 — Fechamento de Caixa e Cores
- **Responsibility**: Add a client-scoped filter + period financial summary ("Fechamento de Caixa") to the existing admin Obras tab, and apply consistent red/blue/green color-coding to repasse/entrada/sobra values wherever they're displayed.
- **Requirements Covered**: FR-1 (FR-1.1–FR-1.4), FR-2 (FR-2.1–FR-2.3)
- **Architecture Impact**: None — stays entirely within the existing client-only architecture. No new components (Application Design was skipped for this unit).
- **Files Touched**: `admin/app.js`, `admin/index.html`, `css/style.css` (new "info/blue" design token)
- **Risk**: Low
- **Construction Stages**: Functional Design → Code Generation (NFR Requirements/Design/Infrastructure Design all skipped per execution-plan.md)

## Unit 2 — Notificações Push e Correções Críticas de Segurança
- **Responsibility**: Deliver real push notifications (FCM) covering an expanded, bidirectional event set (admin↔cliente), and close reverse-engineering's 2 Critical security findings (#1 admin self-promotion, #2 cross-tenant `etapas` leak).
- **Requirements Covered**: FR-3 (FR-3.1–FR-3.7) + RE Critical findings #1 and #2
- **Architecture Impact**: Introduces the project's first server-side component (1 Cloud Function), a service worker, and a new client-side shared module (`js/notifications.js`) — see `aidlc-docs/inception/application-design/` for full component breakdown.
- **Files Touched**: `firestore.rules`, new `functions/` package (Cloud Functions, first `package.json` in this repo), new `js/notifications.js`, new `firebase-messaging-sw.js`, `js/data.js` (extended), `js/firebase-config.js` (extended), `admin/app.js` + `admin/index.html` (new Admin Notifications View), `cliente/app.js` (register for push), `manifest.json` (finally linked)
- **Risk**: High (first backend component, first rules rewrite touching authorization-critical paths, first push/service-worker integration)
- **Construction Stages**: Functional Design → NFR Requirements → NFR Design → Infrastructure Design → Code Generation (all executed per execution-plan.md)

## Shared
- **Build and Test**: Runs once, after both units complete (per execution-plan.md) — not itself a unit, but the final shared gate before this work is considered done.
