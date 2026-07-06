# NFR Requirements Plan — Unit 2: Notificações Push e Correções Críticas de Segurança

## Execution Checklist
- [ ] Step 1: Answer the 6 questions below
- [ ] Step 2: Generate `aidlc-docs/construction/unit2-notificacoes-seguranca/nfr-requirements/nfr-requirements.md`
- [ ] Step 3: Generate `aidlc-docs/construction/unit2-notificacoes-seguranca/nfr-requirements/tech-stack-decisions.md`

## Context: where "full enforcement" meets a very small project
The Security Baseline extension is enabled with full blocking enforcement (decided in Requirements Analysis). Going rule-by-rule against this unit's actual design (1 Firestore-triggered Cloud Function, no HTTP endpoint, no CI/CD, no load balancer/CDN), most of the 15 SECURITY rules are either already satisfied by Firebase's platform defaults, genuinely N/A (no load balancer/VPC/CI pipeline exists), or cheap to satisfy outright (structured logging, least-privilege service account, fail-safe error handling) — these are simply included in the plan below, no question needed. A handful of rules only resolve cleanly with a real tradeoff decision given this app's tiny scale — those are the 6 questions here. Full rule-by-rule disposition will be in `nfr-requirements.md`.

## Scalability / Performance / Availability (no open questions)
- Cloud Functions (2nd gen) autoscale to zero and back automatically — no capacity planning needed at this app's volume (a handful of notifications per day, at most).
- FCM delivery latency is near-real-time (typically <1s); no performance benchmark is meaningful to set for a project this size.
- Firebase's default availability SLA is far beyond what a small contracting business needs; no multi-region/failover requirement.

## Questions

### Question 1 — Cloud Functions runtime version
A) Node.js 20 (current LTS, broadly supported by Firebase Functions 2nd gen — recommended)
B) Node.js 22 (newest supported by Firebase Functions)
X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 2 — Firestore trigger retry policy on failure
If `NotificationDispatcher` throws (e.g. a transient FCM API error), Cloud Functions can either retry the trigger (risking a duplicate push send if the first attempt partially succeeded before failing) or not retry (risking a missed push for that one event — the in-app `notificacoes` record still exists either way, per FR-3.5's fallback).

A) No retry — simpler, avoids duplicate-send edge cases; a missed push is a minor inconvenience given the in-app fallback always exists (recommended)
B) Enable retry — prioritizes delivery over avoiding rare duplicates
X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 3 (SECURITY-11) — Abuse mitigation for the new client-writable notification surface
Functional Design flagged that clients can now create admin-facing `notificacoes` documents directly (no Cloud Function mediates it), accepting spam/noise as a bounded risk. Should this unit add any mitigation, or accept the risk as-is?

A) Accept as-is — no rate limiting added; a malicious client can only generate misleading in-app noise for admins, not access/alter any data (recommended for this app's size and trust level — all clients are pre-approved by an admin before they can do anything)
B) Add a simple per-user rate limit inside a small Cloud Function wrapper (e.g. max N notification-creates per client per hour) — meaningfully more code/complexity for a low-severity risk
X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 4 (SECURITY-12) — MFA for admin accounts
Full Security Baseline compliance calls for MFA support for admin accounts. This app has none today, and enabling it (Firebase phone-based MFA) requires a paid Firebase plan tier and phone-number collection — a meaningfully larger change than this unit's approved scope (FR-3 + findings #1/#2).

A) Out of scope for this unit — document as a known gap against SECURITY-12, to be addressed as its own future unit if desired (recommended — keeps this unit focused)
B) Add it now, expanding this unit's scope
X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 5 (SECURITY-14) — Alerting/monitoring depth
Full compliance calls for automatic alerts on privilege-escalation attempts and authorization failures. Application Design already declined a dedicated logging/alerting Cloud Function for finding #2 (Q5=A). Firebase's default Cloud Logging still captures Cloud Function errors/invocations automatically (viewable manually in the console) even with no extra code.

A) Accept the gap — rely on default Cloud Logging (manually reviewable), no automated alert policy configured; document as a known gap against SECURITY-14 (recommended for this app's size — no on-call/ops team to receive alerts anyway)
B) Add one minimal Cloud Monitoring alert policy on `NotificationDispatcher`'s error rate (cheap, partial coverage — does not cover Firestore-rules-denied attempts, which aren't easily exportable to a metric without heavier tooling)
X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 6 (SECURITY-13) — Subresource Integrity (SRI) on CDN scripts
Not part of this unit's original scope, but `admin/index.html`/`cliente/index.html` are already being modified for other Unit 2 reasons, and reverse-engineering flagged the Firebase SDK/Tabler Icons CDN `<script>`/`<link>` tags as missing SRI hashes. Low effort to add while these files are open.

A) Yes — add SRI `integrity`/`crossorigin` attributes to the existing CDN tags in the files this unit already touches (small, valuable bonus fix)
B) No — keep this unit strictly scoped to FR-3 + findings #1/#2; leave SRI as a separate future fix
X) Other (please describe after [Answer]: tag below)

[Answer]: A
