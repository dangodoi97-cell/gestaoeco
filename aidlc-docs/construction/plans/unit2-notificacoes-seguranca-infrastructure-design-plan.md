# Infrastructure Design Plan — Unit 2: Notificações Push e Correções Críticas de Segurança

## Category Evaluation
- **Deployment Environment**: Fixed — this project is already 100% on Firebase/GCP (no provider choice to make). Deployed via `firebase deploy`, same as the existing `firestore.rules`/`storage.rules` deploy flow documented in `LEIA-ME.md`.
- **Compute Infrastructure**: 1 genuine open question below (region) + default sizing (documented, no question needed — this function is tiny, default 256MB memory / 60s timeout is far more than enough).
- **Storage Infrastructure**: No new storage — extends existing Firestore collections only (per domain-entities.md).
- **Messaging Infrastructure**: Firebase Cloud Messaging, already fully decided (Application Design + NFR Requirements).
- **Networking Infrastructure**: N/A — no load balancer/API Gateway; Firestore triggers have no network topology to design.
- **Monitoring Infrastructure**: Already decided (NFR Requirements Q5=A — default Cloud Logging, no alert policy).
- **Shared Infrastructure**: N/A — single small app, no multi-tenancy, nothing shared with another system.

## Questions

### Question 1 — Cloud Function deployment region
The Cloud Function should be deployed in the same GCP region as your existing Firestore database (co-locating avoids cross-region latency/egress). Do you know which region your Firebase project (`gestaoecosytem`) already uses?

A) Not sure — use `southamerica-east1` (São Paulo), the standard recommendation for a Brazil-based business when the existing region is unknown (you can check and correct this later in the Firebase console before deploying if it turns out your Firestore is elsewhere)
B) I know it's different — I'll specify the exact region after [Answer]
X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 2 — Firebase Blaze (pay-as-you-go) plan
Cloud Functions require Firebase's "Blaze" plan — the free "Spark" plan cannot run them at all. At this app's volume, actual cost should be negligible (well within Blaze's still-generous free-tier allowances), but billing must be enabled on the Firebase project before this unit can be deployed.

A) Already on Blaze, or will enable it before deploying — proceed with this design as planned
B) Not sure / need to check first — still write the design (nothing here blocks documentation), but flag this as a pre-deploy checklist item
X) Other (please describe after [Answer]: tag below)

[Answer]: A
