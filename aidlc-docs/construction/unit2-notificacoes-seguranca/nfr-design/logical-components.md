# Logical Components (NFR-Annotated) — Unit 2: Notificações Push e Correções Críticas de Segurança

Extends Application Design's `components.md` with the NFR patterns from `nfr-design-patterns.md` applied to each.

## Firestore Rules — Access Control Layer
- **NFR patterns applied**: Authorization Guard Predicates, Field-Scoped Self-Write, Narrow Client-Write Allowlist
- **New logical elements**: `souProprietarioObra(obraId)` helper predicate; a 2-tier `usuarios` update rule; an enumerated `notificacoes` create-allowlist for clients
- **Service account / IAM**: N/A — rules execute inside Firestore itself, not under any service account

## Cloud Functions — NotificationDispatcher
- **NFR patterns applied**: Fail-Fast Dispatch
- **Service account (SECURITY-06)**: runs under a dedicated, scoped service account — Firestore read access limited to `usuarios` and `notificacoes` collections, plus Firebase Cloud Messaging send permission. Not the project's default (typically broad) App Engine/Compute service account.
- **Logging**: `firebase-functions/logger`, structured — satisfies SECURITY-03 with zero additional infrastructure (ships to Cloud Logging automatically).
- **No queue/cache/circuit-breaker**: confirmed N/A per nfr-design-patterns.md.

## Client — NotificationClient (`js/notifications.js`)
- **NFR patterns applied**: none beyond what Functional Design already specified (permission-prompt flow, token lifecycle) — this component has no server-side NFR concerns; it's a thin SDK wrapper.

## Client — Service Worker (`firebase-messaging-sw.js`)
- **NFR patterns applied**: none new — background push receipt is entirely handled by the Firebase Messaging SDK's own internals.

## Admin Notifications View / Extended Data Layer
- **NFR patterns applied**: none new at the NFR level — these are UI/data-access components already fully specified in Functional Design; their only NFR-relevant property is that they never bypass the Access Control Layer (all reads/writes still go through the same `js/data.js` → `firestore.rules` path as everything else in this app).

## Summary: No New Infrastructure Beyond What Application Design Already Named
This stage did not introduce any new component beyond the 6 already named in Application Design — its job was to attach concrete security/resilience patterns to those components, not to expand the architecture. This keeps Unit 2's footprint exactly as scoped since Workflow Planning: 1 Cloud Function, 1 rules file, no queues/caches/new services.
