# Performance Test Instructions

## Status: N/A — not executed, with rationale

Per NFR Requirements (both units), this project has no performance target that warrants load/stress tooling:
- **Unit 1**: pure client-side computation over data already held in memory; no new Firestore reads introduced (explicitly required by requirements.md's Performance section).
- **Unit 2**: Firebase-managed autoscaling (Cloud Functions 2nd gen) at a volume of a handful of notification events per day for a single small business — no capacity planning or benchmark is meaningful at this scale (documented in Unit 2's nfr-requirements.md).

## What Was Checked Instead
- **Unit 1's known performance risk** (reverse-engineering finding #12/#13 — listener churn, unbounded queries) was explicitly designed against: business-logic-model.md confirms no new Firestore listeners are added, reusing already-subscribed data.
- **Unit 2's dispatch function** has no loop over an unbounded collection — `resolveRecipients('admin')` queries `usuarios` filtered by `tipo=='admin'`, bounded by however many admin accounts exist (expected: 1-3 for this business), not by client/obra volume.

## If This Ever Needs Revisiting
Should this app's usage grow substantially (many admins, high notification volume), re-run NFR Requirements for a new unit to set actual targets before introducing load-testing tooling — premature performance tooling for a project this size would be disproportionate effort (per this project's consistent "proportionate to scale" decisions throughout Unit 2's NFR stages).
