# NFR Requirements — Unit 2: Notificações Push e Correções Críticas de Segurança

## Scalability
- Cloud Functions (2nd gen, Firestore-triggered) autoscale automatically, including to zero — no capacity planning needed at this app's volume (a handful of notification events per day).
- No requirement beyond Firebase's platform defaults.

## Performance
- FCM delivery is near-real-time (typically sub-second); no formal latency SLA is meaningful to set for a project this size.
- `escutarTodasEtapas`-style listener churn concerns (flagged in reverse-engineering) are not touched by this unit — no new listener patterns are introduced beyond what Application Design already specified.

## Availability
- Fully dependent on Firebase's managed availability (Cloud Firestore, Cloud Functions, FCM, Cloud Messaging) — no self-managed failover/multi-region requirement for a business at this scale.
- **Q2=A**: Firestore trigger retries are **disabled** — a transient dispatch failure results in a missed push for that one event, not a retry-induced duplicate send. The in-app `notificacoes` record (FR-3.5) always exists regardless, so no notification is ever silently lost from the user's perspective, only potentially delayed until they next open the app.

## Reliability
- `NotificationDispatcher` wraps every external call (Firestore reads, FCM Admin SDK send) in try/catch; on any error, it logs (via `firebase-functions/logger`, structured) and exits cleanly rather than throwing (since retries are disabled per Q2=A, an uncaught throw would just be wasted — logging and returning is the correct fail-safe behavior here, satisfying SECURITY-15).
- Inline invalid-token cleanup (already decided in Application Design) is itself wrapped so a cleanup failure never blocks the primary send path for other tokens/recipients.

## Maintainability
- **Test tooling reused from Unit 1** (Node's built-in `node:test` + `fast-check`) — no second framework introduced. `functions/` gets its own `package.json` (Cloud Functions requirement) but references the same testing approach.
- No build step for the Cloud Function itself (plain JS, per Application Design Q3=A) — `firebase deploy --only functions` deploys the `functions/` directory as-is.

## Usability / Accessibility
- No new requirements beyond what Functional Design already specified (permission-prompt copy, deep-link behavior).

## Security — Security Baseline Compliance (full rule-by-rule disposition)

| Rule | Status | Rationale |
|---|---|---|
| SECURITY-01 (Encryption at rest/transit) | **Compliant** (platform-managed) | Firestore/Storage/Cloud Functions encrypt at rest and enforce TLS by default; no app-level configuration exists or is needed. |
| SECURITY-02 (Access logging on network intermediaries) | **N/A** | No load balancer, API Gateway, or CDN distribution exists in this architecture (Firestore trigger, not an HTTP-fronted service). |
| SECURITY-03 (Application-level logging) | **Compliant** | `NotificationDispatcher` uses `firebase-functions/logger` (structured, timestamped, auto-shipped to Cloud Logging) — no PII/secrets logged (token values are never logged, only counts/uids where necessary). |
| SECURITY-04 (HTTP security headers) | **N/A for this unit** | No new HTML-serving endpoint is introduced (Firestore trigger, not HTTP). Pre-existing site-wide header configuration is a separate, out-of-scope concern. |
| SECURITY-05 (Input validation on API params) | **Compliant (scoped)** | Not a public API endpoint; "input" is a Firestore document already constrained by `firestore.rules`. `NotificationDispatcher` still defensively validates expected fields exist before use. |
| SECURITY-06 (Least-privilege IAM) | **Compliant (action item for Infrastructure Design)** | The Cloud Function will be assigned a dedicated, scoped service account (Firestore read on `usuarios`/`notificacoes` + FCM send only) rather than a default broad-permission one — see Infrastructure Design. |
| SECURITY-07 (Restrictive network config) | **N/A** | No self-managed VPC/firewall/network resources exist or are introduced — fully serverless, Google-managed. |
| SECURITY-08 (Application-level access control) | **Compliant** | This unit's entire purpose for findings #1/#2 — deny-by-default `firestore.rules`, object-level ownership scoping (etapas→obra→clienteId), function-level admin checks (tipo/status writes), token validation delegated to Firebase Auth's SDK-enforced ID tokens. No CORS-exposed surface added. |
| SECURITY-09 (Hardening) | **Compliant** | Generic user-facing error messages (existing toast pattern, unchanged); current, supported Node.js runtime (Q1=A: Node 20); no default credentials anywhere in this architecture. |
| SECURITY-10 (Supply chain security) | **Compliant (lightweight)** | `package-lock.json` committed (established in Unit 1, extended for `functions/`); `npm audit` recommended as a manual pre-deploy check (documented in Build and Test, not automated — no CI/CD pipeline exists to automate it against). SBOM generation: **N/A**, no CI/CD pipeline to attach it to; revisit if one is ever added. |
| SECURITY-11 (Secure design principles) | **Compliant, with one documented accepted risk** | Security-critical logic isolated in `firestore.rules` (dedicated file). Misuse case explicitly documented (Functional Design's "accepted, bounded risk" note). Defense-in-depth: **partial** — admin-action protection is rules-only, single-layer (Application Design Q1=A, a conscious choice, not an oversight). Rate limiting: **accepted gap** (Q3=A) — the client-writable notification-create surface has no rate limit; justified given all clients are pre-approved by an admin before gaining any write access at all, and the worst case is UI noise, not data/privilege exposure. |
| SECURITY-12 (Auth/credential management) | **Compliant except MFA (accepted gap, Q4=A)** | Password hashing/session management fully delegated to Firebase Authentication (industry-standard, not custom code). Brute-force protection on login: built into Firebase Auth by default. **MFA for admin accounts: not implemented** — explicitly out of scope for this unit (Q4=A), documented here as a known gap; would require a paid Firebase plan tier + phone-number collection, a meaningfully larger change than this unit's approved scope. No hardcoded credentials (the Firebase client config is not a secret, per reverse-engineering's existing determination). |
| SECURITY-13 (Software/data integrity) | **Compliant (expanded scope, Q6=A)** | SRI `integrity`/`crossorigin` attributes added to the Firebase SDK + Tabler Icons CDN tags in `admin/index.html`/`cliente/index.html` (already being modified by this unit) — closes a reverse-engineering-flagged gap opportunistically. `index.html`/`pendente.html` (not otherwise touched by this unit) are **not** included — flagged as a small remaining gap for a future pass. No unsafe deserialization anywhere in this codebase. CI/CD pipeline security: N/A, no pipeline exists. Data-integrity audit trail (who-changed-what): pre-existing gap, unrelated to this unit's scope, not addressed here. |
| SECURITY-14 (Alerting and monitoring) | **Accepted gap (Q5=A)** | No automated alert policy is configured. Cloud Functions invocation/error logs remain available by default in Cloud Logging for manual review. Justified given this app's scale (no on-call/ops team to receive alerts) and the earlier Application Design decision (Q5=A) not to build a dedicated denied-access logging mechanism. Log retention: left at Cloud Logging's default (30 days) rather than raised to the rule's 90-day minimum — a one-line GCP Console setting if ever needed later, not worth automating now. |
| SECURITY-15 (Exception handling / fail-safe defaults) | **Compliant** | All external calls in `NotificationDispatcher` wrapped in try/catch; fails closed (logs and exits, never throws given retries are disabled); no unhandled promise rejections; error paths never bypass the authorization checks already enforced by `firestore.rules`. |

**Net compliance summary**: 10 Compliant, 4 N/A (with rationale), 1 rule with 2 explicitly accepted/documented gaps (SECURITY-12's MFA, SECURITY-14's alerting) plus SECURITY-11's partial defense-in-depth and rate-limiting acceptance — all gaps were surfaced as explicit questions and confirmed by the user as acceptable for this project's size, not silently skipped. None of the accepted gaps involve data exposure or privilege escalation — they are auth-hardening depth (MFA) and operational alerting depth (monitoring), both reasonable to defer for a single-admin small-business app.

## Property-Based Testing Compliance
- **PBT-09 (Framework Selection)**: reuses the Unit 1 decision — `fast-check` + Node's built-in `node:test`. No new framework introduced for Unit 2.
- Testable properties for this unit (to carry into Code Generation): round-trip-style property for `resolveRecipients` (given a notification, the resolved recipient set is deterministic and non-empty for valid input), and an invariant for the `usuarios`/`etapas` rules logic once expressed as pure predicate functions mirroring the rules (see Infrastructure Design) — rules themselves are typically tested via the Firebase Rules Unit Testing library (`@firebase/rules-unit-testing`), a separate, standard tool from `fast-check`, documented here and added as a dependency in Code Generation.
