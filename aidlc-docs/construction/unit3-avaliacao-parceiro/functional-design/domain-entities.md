# Domain Entities — Unit 3: Avaliação por Critérios vinculada ao Parceiro

**Note**: This unit introduces no new Firestore collection. It changes the shape of existing `obras/{obraId}` rating fields and adds one computed, non-persisted view model (the parceiro's accumulated rating).

## Changed Entity: `obras/{obraId}` — rating fields

| Field | Type | Status | Notes |
|---|---|---|---|
| `avaliacaoNota` | `number (1-5)` | **REMOVED** (Q6=A, Requirements) | Legacy single-score field. Existing values are left untouched on old obra documents (Q1=A, Functional Design) — they are simply no longer read or written by any code path. No migration/backfill. |
| `avaliacaoCriterios` | `{ tempoExecucao: number(1-5), acabamento: number(1-5), organizacaoLimpeza: number(1-5) }` | **NEW** | The 3 fixed criteria (FR-4.2). Presence of this field is the "already rated" gate, replacing the old `!obra.avaliacaoNota` check. |
| `avaliacaoGeral` | `number (1-5, may be fractional, e.g. 4.67)` | **NEW** | Auto-computed as the arithmetic mean of the 3 `avaliacaoCriterios` values at submission time (FR-4.3). Stored (not recomputed on read) since the source criteria are immutable once submitted (one-shot, FR-4.5). |
| `avaliacaoParceiros` | `Array<{ parceiroId: string, nome: string }>` | **NEW** | Snapshot of every **distinct** parceiro credited by this rating, taken at submission time (FR-4.6, FR-4.9/Q4=A frozen name). Empty array `[]` when the obra had no parceiro linked to any `'concluido'` etapa (FR-4/Q3=A) — the rating still exists, just credits nobody. |
| `avaliacaoComentario` | `string` | **UNCHANGED** | Free-text comment, kept as-is (Requirements FR-4.4 note — its removal was never requested). |
| `avaliadoEm` | `string (ISO date, via existing `hoje()` helper)` | **UNCHANGED** | Same semantics as today. |

**Removed in the same change**: `avaliacaoNota` is dropped from the `hasOnly([...])` allow-list in `firestore.rules`' `match /obras/{obraId}` update rule, replaced by `avaliacaoCriterios`, `avaliacaoGeral`, `avaliacaoParceiros`, `avaliacaoComentario`, `avaliadoEm`.

## Existing Entities Referenced (unchanged schema)

- **`obras/{obraId}/etapas/{etapaId}`**: read fields — `status` (must be `'concluido'` to count, per Q2=A), `parceiroId` (legacy single-parceiro shape) and/or `parceiros: Array<{parceiroId, nome, repasse}>` (current multi-parceiro shape) — both shapes exist in current data (see `renderParceiroDetalhe`'s own dual check) and both must be read when computing distinct parceiros for an obra.
- **`parceiros/{parceiroId}`**: **not read at all by this unit's client-facing code.** The parceiro's `nome` needed for FR-4.9 is already denormalized onto each `etapas.parceiros[]` entry by existing admin code (`parceirosDaEtapa.push({parceiroId, nome, repasse})` in `admin/app.js`) — the client reads this name straight off the `etapas` documents it already has permission to read (`souProprietarioObra`), with **no new `firestore.rules` grant needed** for name exposure.

## New Computed (non-persisted) View Model: `ParceiroAvaliacaoAcumulada`

Computed entirely in `admin/app.js` (`renderParceiroDetalhe`), from `db_obras` already held in memory — no new Firestore read/listener.

| Field | Type | Derivation |
|---|---|---|
| `parceiroId` | `string` | The parceiro being viewed |
| `totalServicosAvaliados` | `number` | Count of obras in `db_obras` whose `avaliacaoParceiros` array contains this `parceiroId` |
| `mediaTempoExecucao` | `number \| null` | Mean of `avaliacaoCriterios.tempoExecucao` across those obras; `null` if `totalServicosAvaliados === 0` |
| `mediaAcabamento` | `number \| null` | Same, for `acabamento` |
| `mediaOrganizacaoLimpeza` | `number \| null` | Same, for `organizacaoLimpeza` |
| `mediaGeral` | `number \| null` | Mean of `avaliacaoGeral` across those obras (**not** recomputed from the 3 per-criterion means — averaging the already-averaged per-service `avaliacaoGeral` values directly, consistent with FR-4.7's "média das avaliações já recebidas") |

**Lifetime**: recomputed every time `renderParceiroDetalhe` runs (same pattern as the existing `historico`/`totalDevido` computed values in that function); never cached, never written to Firestore.

## Relationships

```
obras (avaliacaoCriterios, avaliacaoGeral, avaliacaoParceiros[]) --N:M--> parceiros
   (an obra can credit 0..N distinct parceiros; a parceiro accumulates across N obras)

obras --1:N--> etapas (existing relationship, unchanged)
   (etapas.parceiros[]/.parceiroId is the ONLY source used to compute which parceiros
    an obra's rating credits — obras carry no direct parceiro reference of their own)

ParceiroAvaliacaoAcumulada --computed-over--> { obra ∈ db_obras : parceiroId ∈ obra.avaliacaoParceiros[].parceiroId }
```
