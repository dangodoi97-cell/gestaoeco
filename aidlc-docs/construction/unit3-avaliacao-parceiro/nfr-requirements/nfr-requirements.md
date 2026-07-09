# NFR Requirements — Unit 3: Avaliação por Critérios vinculada ao Parceiro

## Scalability
- No new component, no new load pattern beyond what already exists (one extra field write per obra rating, same volume as today's single-field rating). Fully inherits Firebase's platform-managed autoscaling — no capacity planning needed.

## Performance
- Attribution computation (Flow 1) and accumulation computation (Flow 2) both run entirely from data already held in memory (`window._todasEtapas`, `db_obras`) — no new Firestore reads, no new listeners, consistent with the Performance NFR already established in `requirements.md` and reaffirmed in this unit's `business-logic-model.md`.
- `ParceiroAvaliacaoAcumulada`'s aggregation is O(number of obras) per render of the parceiro detail screen — negligible at this app's scale (same order of magnitude as the existing `historico`/`totalDevido` computation in the same function).

## Availability
- Fully dependent on Firebase's managed availability, same as every other unit — no new failure mode introduced (no new backend component to go down).

## Reliability
- One-shot submission is now enforced at two layers (Q1=A): the client UI (button disappears) and `firestore.rules` (`!('avaliacaoCriterios' in resource.data)`) — closes the gap where Unit 1/2's equivalent locks were UI-only.
- If the `enviarAvaliacao` write fails (network error, rules rejection), the existing toast-on-failure pattern applies — the button remains visible for retry, no partial/inconsistent state is possible since the write is a single atomic Firestore document update covering all new fields at once.

## Maintainability
- Zero new dependencies, zero new test frameworks — reuses `node:test` + `fast-check` (Units 1/2) and `@firebase/rules-unit-testing` (Unit 2) as-is. See `tech-stack-decisions.md`.

## Usability / Accessibility
- No new requirements beyond what Functional Design already specified (live "Avaliação Geral" preview, frozen parceiro name display, multi-name listing for multi-parceiro obras).

## Security — Security Baseline Compliance (full rule-by-rule disposition)

| Rule | Status | Rationale |
|---|---|---|
| SECURITY-01 (Encryption at rest/transit) | **Compliant** (platform-managed, inherited) | No change from Unit 2's disposition — same Firestore/Firebase platform. |
| SECURITY-02 (Access logging on network intermediaries) | **N/A** | No load balancer/API Gateway/CDN — unchanged. |
| SECURITY-03 (Application-level logging) | **N/A for this unit** | No new deployed backend component is introduced (no Cloud Function) — nothing new to instrument. |
| SECURITY-04 (HTTP security headers) | **N/A** | No new HTML-serving endpoint. |
| SECURITY-05 (Input validation) | **Compliant** | `firestore.rules` now validates type and range (1-5) on `avaliacaoCriterios.*` and `avaliacaoGeral` at write time (see `tech-stack-decisions.md`) — not just structural (`hasOnly`) validation as before, closing a gap the original `avaliacaoNota` rule also had (no range check existed on the old single-star field either). |
| SECURITY-06 (Least-privilege IAM) | **N/A** | No new service account/role — no new backend component. |
| SECURITY-07 (Restrictive network config) | **N/A** | No network resources introduced. |
| SECURITY-08 (Application-level access control) | **Compliant** | Object-level ownership unchanged (`resource.data.clienteId == request.auth.uid`, already enforced); one-shot re-submission is now blocked at the rules layer too (Q1=A), not just the UI — closes the same class of "don't trust the client UI alone" gap Unit 2 addressed elsewhere. |
| SECURITY-09 (Hardening) | **Compliant** (inherited) | No change — generic error messages, current runtime, no default credentials. |
| SECURITY-10 (Supply chain security) | **Compliant** (inherited, simpler than Unit 2) | Zero new dependencies added by this unit at all — nothing new to pin, scan, or audit. |
| SECURITY-11 (Secure design principles) | **Compliant, with one explicitly accepted gap (Q2=A)** | Misuse case explicitly considered: a malicious/compromised client could submit `avaliacaoParceiros` crediting a parceiro who never worked on the obra, inflating that parceiro's accumulated average. **Accepted, not fixed** — a rules-layer cross-check against the `etapas` subcollection is impractical (Firestore rules aren't well-suited to per-array-element cross-collection verification, and are bounded by a per-request `get()`/`exists()` call limit); a Cloud-Function-based verification would require introducing this project's first write-path backend component for a business-integrity risk, not a data-confidentiality or account-takeover risk. Consistent with Unit 2's own precedent of explicitly accepting bounded, non-critical risks (rate limiting, MFA) rather than over-engineering a low-severity gap. |
| SECURITY-12 (Auth/credential management) | **N/A change** | Unchanged from Unit 2's disposition — this unit touches no authentication/session logic. |
| SECURITY-13 (Software/data integrity) | **Compliant** | No new CDN resources (no new SRI surface). The `avaliacaoParceiros` snapshot itself is a small integrity *improvement*: every rating now carries an auditable, frozen record of exactly who was credited and with what name, at the moment of submission — more traceable than today's single anonymous `avaliacaoNota`. |
| SECURITY-14 (Alerting and monitoring) | **N/A change (accepted gap persists, inherited from Unit 2)** | No new security-relevant event type is introduced that would need alerting beyond what Unit 2 already accepted as a gap for this app's scale. |
| SECURITY-15 (Exception handling/fail-safe defaults) | **[CORRECTED 2026-07-09] Initially mis-assessed as Compliant — actually non-compliant until Build and Test's second manual-testing fix** | The original claim ("follows the existing try/catch-and-toast pattern") was inaccurate — `enviarAvaliacaoObra` had no error handling at all, so a failed write (e.g. rules rejecting the new field shape before `firestore.rules` is republished live) failed **silently**: no toast, modal stayed open, nothing told the user anything went wrong. Fixed during Build and Test: `enviarAvaliacao` now wrapped in try/catch (error toast, modal stays open for retry) and the admin-notify `criarNotificacao` call wrapped separately (non-blocking, doesn't mask a successful rating save). Now genuinely compliant — fails closed with user-visible feedback, and the UI gate (`!obra.avaliacaoCriterios`) still naturally prevents any partial-rated state. |

**Net compliance summary**: 6 Compliant, 7 N/A (5 unchanged from Unit 2's architecture, 2 newly N/A because this unit adds no backend component), 1 rule (SECURITY-11) with one explicitly accepted, user-confirmed gap. No gap involves data exposure or account takeover — the sole accepted gap is a bounded business-integrity risk (a possible inflated parceiro average), consistent with this project's established risk-acceptance bar.

## Property-Based Testing Compliance
- **PBT-09 (Framework Selection)**: reuses `fast-check` + `node:test` — no new framework.
- Testable properties to carry into Code Generation (per `business-rules.md`'s "Aggregation Correctness" rule set):
  1. For any set of N rated obras crediting the same parceiro, `mediaGeral`/`mediaTempoExecucao`/`mediaAcabamento`/`mediaOrganizacaoLimpeza` are always within `[1, 5]`.
  2. Adding one more rated obra to a parceiro's history changes each mean by a bounded, predictable amount (`|new_mean - old_mean| <= |value - old_mean| / (n+1)`).
  3. Attribution isolation: crediting/removing a rating for parceiro A never changes parceiro B's computed averages, for any set of obras.
  4. `avaliacaoGeral` computed at submission always equals the rounded mean of the 3 submitted criteria (round-trip property on the submission-side calculation).
