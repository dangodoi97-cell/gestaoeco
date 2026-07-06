# Deployment Architecture — Unit 2: Notificações Push e Correções Críticas de Segurança

## Deployment Topology
This app has always had a split deployment (static files vs. Firebase-managed backend config); this unit adds a third leg:

```
Netlify (static hosting)          <- admin/*, cliente/*, js/*, css/*, index.html, pendente.html,
                                      manifest.json, firebase-messaging-sw.js (unchanged deploy flow)

Firebase CLI (firebase deploy)    <- firestore.rules, storage.rules (unchanged flow)
                                      + functions/ (NEW — this unit's Cloud Function)

Firebase Console (manual, one-time) <- Cloud Messaging Web Push certificate (VAPID key) generation
                                      + Blaze plan confirmation
                                      + dedicated service account creation (SECURITY-06)
```

## `functions/` Directory Layout (new)
```
functions/
  package.json          (new — declares firebase-admin, firebase-functions, dev deps)
  index.js              (exports NotificationDispatcher)
  notificationDispatcher.js   (implementation — resolveRecipients, sendToTokens, inline cleanup)
  notificationDispatcher.test.js   (node:test — logic tests with firebase-admin mocked/stubbed)
```
Firebase CLI convention requires `functions/package.json` to be self-contained (its own `node_modules`, deployed as-is to the Cloud Functions runtime) — this is separate from the root `package.json` introduced in Unit 1 (which only holds test tooling for the static-site-side logic and is never deployed anywhere).

## Firebase Project Configuration (`firebase.json`, new file at repo root)
This project has no `firebase.json` today (rules are deployed ad hoc per `LEIA-ME.md`'s manual instructions). This unit introduces one, since `firebase deploy --only functions` requires it:
```json
{
  "firestore": { "rules": "firestore.rules" },
  "storage": { "rules": "storage.rules" },
  "functions": { "source": "functions", "runtime": "nodejs20" }
}
```
This also formalizes (but does not change the mechanics of) the existing rules deploy — `firebase deploy --only firestore:rules,storage:rules` continues to work exactly as documented in `LEIA-ME.md`, now backed by this config file instead of implicit CLI defaults.

## Deploy Sequence (per execution-plan.md's Package Change Sequence, made concrete)
1. `firebase deploy --only firestore:rules` — the tightened `usuarios`/`etapas` rules go live first, in isolation, per the plan's risk-first ordering. **Verify immediately**: attempt a self-promotion write and a cross-tenant etapas read from a non-admin test account; both must now fail.
2. Generate the Web Push VAPID key pair in the Firebase console (one-time, manual — see infrastructure-design.md).
3. Create the dedicated Cloud Functions service account (one-time, manual).
4. `firebase deploy --only functions` — deploys `NotificationDispatcher` to `southamerica-east1`.
5. Deploy the static site changes (Netlify — automatic on push, per the existing flow) — `js/notifications.js`, `firebase-messaging-sw.js`, updated `admin/`/`cliente/` files, updated `manifest.json` linking.
6. End-to-end verification: trigger one cliente-facing and one admin-facing event, confirm push arrives on a real device/browser for both.

## Pre-Deploy Checklist (manual, non-code)
- [ ] Confirm Firestore's actual region matches `southamerica-east1`, or adjust the function's region to match (infrastructure-design.md's noted verification step)
- [ ] Confirm Firebase Blaze plan is active (Q2=A)
- [ ] Generate Web Push VAPID key pair (Cloud Messaging console)
- [ ] Create dedicated service account with the 2 scoped roles (infrastructure-design.md)
- [ ] Add the VAPID public key to `js/firebase-config.js`

## Rollback
- `firestore.rules`: Firebase console retains a rules version history — rollback is a one-click revert to the previous version if the new rules unexpectedly block a legitimate existing flow.
- `functions`: `firebase deploy --only functions` of a previous commit re-deploys the prior version; Cloud Functions has no automatic traffic-splitting/canary in this simple setup, so rollback is "redeploy the old code," consistent with this project's existing (simple, non-CI/CD) deployment philosophy.
