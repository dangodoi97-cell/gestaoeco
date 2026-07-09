# Tech Stack Decisions — Unit 3: Avaliação por Critérios vinculada ao Parceiro

**Summary**: This unit introduces zero new dependencies and zero new infrastructure. Everything reuses what Units 1 and 2 already established.

| Decision | Choice | Rationale |
|---|---|---|
| Persistence | Existing `obras/{obraId}` document, new field shapes only | No new collection — see domain-entities.md. |
| Backend component | None (client + `firestore.rules` only) | No new Cloud Function — attribution and averaging are computed client-side (client submission) and admin-side (read-time aggregation), matching Unit 1's precedent (pure client-side logic, no backend needed). |
| Rules testing | `@firebase/rules-unit-testing` (reused from Unit 2) | Already a dependency; the new one-shot guard and field-shape validation added to `firestore.rules` (Q1=A) get covered by this same tool, no new package. |
| Property-based testing | `fast-check` + Node's built-in `node:test` (reused from Unit 1/2) | Averaging/accumulation logic (business-rules.md's aggregation-correctness rule set) is a natural PBT-01 candidate — same tooling, no new framework. |

## New Dependencies Introduced by This Unit
None.

## Rules-Layer Additions (not a new dependency, but a scope note)
- One-shot submission guard: `!('avaliacaoCriterios' in resource.data)` added to the obra `allow update` condition for clients (Q1=A, NFR Requirements).
- Basic range/type validation on the 3 new criteria fields and `avaliacaoGeral` (SECURITY-05) — each criterion `is int` and `>= 1 && <= 5`; `avaliacaoGeral` `is number` and `>= 1 && <= 5`. Pure `request.resource.data` checks, no additional `get()`/`exists()` calls, no performance or quota impact.
- **Explicitly not added** (Q2=A, accepted risk — see nfr-requirements.md SECURITY-11): no cross-check that `avaliacaoParceiros` entries correspond to real `etapas` of that obra. Rules-layer verification would require multiple `get()`/`exists()` calls against the `etapas` subcollection per array entry, which is both awkward to express in Firestore's rules language and bounded by the platform's per-request `get()`/`exists()` call limit — not worth the complexity for a risk whose worst case is a business-integrity issue (an inflated average), not a data-confidentiality or account-takeover issue.
