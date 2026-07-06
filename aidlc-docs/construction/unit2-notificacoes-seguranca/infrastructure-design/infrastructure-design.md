# Infrastructure Design — Unit 2: Notificações Push e Correções Críticas de Segurança

## Cloud Function: NotificationDispatcher
| Setting | Value | Rationale |
|---|---|---|
| Product | Cloud Functions for Firebase, 2nd gen | Per tech-stack-decisions.md |
| Trigger | Firestore `onDocumentCreated('notificacoes/{notifId}')` | Matches business-logic-model.md's event flow |
| Region | `southamerica-east1` (Q1=A) | Co-located with the assumed Firestore region for a Brazil-based project; **must be verified against the actual Firestore region in the Firebase console before first deploy** — if they differ, either move this function's region to match, or accept the (likely negligible, for this volume) cross-region latency |
| Runtime | Node.js 20 | Per tech-stack-decisions.md |
| Memory | 256MB (default) | This function does a handful of small Firestore reads + FCM sends per invocation — default is far more than needed; no custom sizing justified |
| Timeout | 60s (default) | No long-running work exists in this function |
| Retry on failure | Disabled | Per NFR Requirements Q2=A |
| Max instances | Default (unbounded, but irrelevant at this volume) | No custom concurrency limit needed |
| Service account | New, dedicated (not the default) | SECURITY-06 — see IAM below |

## IAM / Service Account
- Create a dedicated service account (e.g. `notification-dispatcher@gestaoecosytem.iam.gserviceaccount.com`) via the Firebase/GCP console or `gcloud`.
- Grant it exactly two roles: `roles/datastore.user` scoped to read `usuarios`/`notificacoes` (Firestore's IAM model grants at the database level, not per-collection — document this as a known platform limitation: true per-collection IAM isn't available, so this is "least privilege within what Firestore's IAM supports," not perfect collection-level isolation) and the Firebase Cloud Messaging send permission (`roles/firebasecloudmessaging.admin` or the narrower send-only role if available at deploy time).
- Assign this service account to the function at deploy time (`--service-account` flag or `firebase.json` config — see deployment-architecture.md).

## Firestore Rules Deployment
- `firestore.rules` is extended (not replaced) with: the `souProprietarioObra()` helper, the 2-tier `usuarios` update rule, the `fcmTokens` field rule, and the extended `notificacoes` read/update/create rules — all per nfr-design-patterns.md's named patterns.
- Deployed via `firebase deploy --only firestore:rules` — same mechanism already documented in `LEIA-ME.md` for the existing rules file, no new tooling.

## Firebase Cloud Messaging Setup (manual, one-time, console-based — not code)
- A **Web Push certificate (VAPID key pair)** must be generated in the Firebase console (Project Settings → Cloud Messaging → Web configuration) before `getToken()` can work client-side. This is a one-time manual setup step, documented in deployment-architecture.md's checklist — there is no CLI/code equivalent to generate this.
- The resulting public VAPID key is added as a constant in `js/firebase-config.js` (alongside the existing, already-public Firebase config — not a secret, same trust model as the existing `apiKey`).

## Service Worker Hosting
- `firebase-messaging-sw.js` must be served from the **site root** (not `/admin/` or `/cliente/`) so its registration scope (`/`) covers both panels — placed at the repository root alongside `index.html`, `pendente.html`, `manifest.json`.
- No new hosting configuration needed — Netlify (the existing static-file host, per `LEIA-ME.md`) serves any file placed in the deployed directory automatically; no redirect/rewrite rules are required for a root-level static file.

## Billing
- Requires the Firebase **Blaze** (pay-as-you-go) plan — confirmed active or to-be-enabled before deploy (Q2=A). Expected cost at this app's volume: within Blaze's free-tier allowances for Cloud Functions invocations and Firestore reads; effectively $0/month in practice, but billing must still be technically enabled since Spark (free) plan cannot deploy Cloud Functions at all.

## No Shared Infrastructure
This unit introduces no infrastructure shared with any other system or unit — Unit 1 has no infrastructure at all (confirmed in unit-of-work-dependency.md), so there is nothing to share.
