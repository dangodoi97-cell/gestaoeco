# NFR Design Patterns — Unit 3: Avaliação por Critérios vinculada ao Parceiro

## Pattern: In-Memory Aggregation (Performance)
**Applies to**: attribution computation (client, `cliente/app.js`) and accumulation computation (admin, `admin/app.js`'s `renderAvaliacaoParceiro`)
**Shape**: Both computations run as pure synchronous functions over data already held in memory (`window._todasEtapas`, `db_obras`) — no new Firestore reads, no new listeners, recomputed on every relevant render rather than cached or persisted incrementally.
**Why**: matches the Performance NFR already established project-wide (avoid new listener/read patterns); mirrors the exact shape of the existing `historico`/`totalDevido` computation already living in `renderParceiroDetalhe`.

## Pattern: Rules-Layer Existence Guard (Security — one-shot enforcement)
**Applies to**: `firestore.rules`, `match /obras/{obraId}` client update condition
**Shape**: `!('avaliacaoCriterios' in resource.data)` added as an additional `&&` clause alongside the existing `hasOnly([...])` field-scoping check — the update is only permitted while the rating hasn't been submitted yet, enforced independently of whatever the client UI does or doesn't hide.
**Why**: NFR Requirements Q1=A — closes the "UI-only lock" gap without adding any new `get()`/`exists()` call (pure `resource.data` check, zero extra read cost).

## Pattern: Field-Level Type/Range Validation (Security — SECURITY-05)
**Applies to**: `firestore.rules`, same update condition
**Shape**: Extends the existing `hasOnly([...])` structural check with per-field value constraints: `request.resource.data.avaliacaoCriterios.tempoExecucao is int && ... >= 1 && ... <= 5` (repeated for `acabamento`, `organizacaoLimpeza`), and `request.resource.data.avaliacaoGeral is number && ... >= 1 && ... <= 5`.
**Why**: the original `avaliacaoNota` rule never range-checked its single value either — this closes that latent gap for all 4 new numeric fields at once, at no extra cost (still pure `request.resource.data` checks).

## Pattern: Accepted-Risk Boundary (Security — explicitly not implemented)
**Applies to**: `avaliacaoParceiros` attribution
**Shape**: No rules-layer or backend cross-check exists between `avaliacaoParceiros` and the obra's actual `etapas`. The boundary of trust is: **the client's own already-loaded, already-legitimately-read `etapas` data** — the same data the UI uses to *display* credited parceiros is also what gets *written back*, so there's no additional attack surface beyond what a compromised client could already do to its own visible data (it could always have shown/reported anything client-side; this unit doesn't newly expose or newly trust anything it didn't already have read access to).
**Why**: NFR Requirements Q2=A — documents precisely *why* this is safe to leave unguarded (bounded blast radius: one parceiro's average, not confidentiality or account takeover), consistent with Unit 2's own accepted-gap precedent (rate limiting, MFA).

## N/A Categories (with rationale, per nfr-design.md's "do not skip" mandate)
- **Scalability Patterns**: N/A — Firebase-managed autoscaling; no new component to scale.
- **Resilience Patterns (retry/circuit-breaker)**: N/A — single atomic document write, no multi-step operation to retry or protect; existing toast-and-retry-via-visible-button UX is sufficient (no new pattern needed beyond what every other client write in this app already does).
- **Logical Components — Queue**: N/A — no asynchronous processing introduced.
- **Logical Components — Cache**: N/A — the aggregation already runs over in-memory data with no repeated-read hot path.
- **Logical Components — Circuit Breaker**: N/A — no external call chain exists within this unit's scope to protect.
- **Logical Components — Rate Limiter**: N/A — not revisited here; same accepted-gap disposition as the rest of this project (NFR Requirements).
