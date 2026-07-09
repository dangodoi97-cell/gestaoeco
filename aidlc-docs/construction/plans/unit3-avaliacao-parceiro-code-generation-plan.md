# Code Generation Plan — Unit 3: Avaliação por Critérios vinculada ao Parceiro

**Workspace Root**: `C:\Users\Usuário\repos\gestaoeco` (brownfield — modify existing files in place; never create `_new`/`_modified` copies)
**Requirements covered**: FR-4 (FR-4.1–FR-4.9)
**Design source**: `aidlc-docs/construction/unit3-avaliacao-parceiro/{functional-design,nfr-requirements,nfr-design}/`
**Dependencies**: None on Units 1/2 beyond sharing `firestore.rules` (sequential edit, not a conflict — Units 1/2 are already merged into `dev`)

## Tech-stack note
Reuses `node:test` + `fast-check` (Units 1/2) for pure logic; reuses `@firebase/rules-unit-testing` (Unit 2) for rules tests. Zero new dependencies (per `tech-stack-decisions.md`).

## Steps

### Step 1: Business Logic Generation
- [x] Create `js/avaliacao.js` (new file, mirrors `js/fechamento.js`'s pure/dependency-free style) exporting:
  - `mediaCriterios({ tempoExecucao, acabamento, organizacaoLimpeza })` → rounded (1 decimal) arithmetic mean
  - `parceirosCreditados(etapas, obraId)` → distinct `[{parceiroId, nome}]` from etapas where `obraId` matches and `status === 'concluido'`, reading both the legacy `parceiroId` field and the `parceiros[]` array shape (per `business-logic-model.md` Flow 1, step 2)
  - `calcularAcumuladoParceiro(obras, parceiroId)` → `ParceiroAvaliacaoAcumulada` shape from `domain-entities.md` (`totalServicosAvaliados`, `mediaTempoExecucao`, `mediaAcabamento`, `mediaOrganizacaoLimpeza`, `mediaGeral`; all `null` when `totalServicosAvaliados === 0`)
- **Story/requirement traceability**: FR-4.3, FR-4.6, FR-4.7

### Step 2: Business Logic Unit Testing
- [x] Create `js/avaliacao.test.js` (new) with:
  - Example-based tests: single/multiple credited parceiros, legacy `parceiroId`-only etapa, zero-parceiro obra, non-`concluido` etapas excluded, `mediaCriterios` rounding
  - `fast-check` property tests for the 4 properties listed in `nfr-requirements.md`: bounds `[1,5]`, bounded change when adding a rating, attribution isolation between parceiros, submission round-trip (`avaliacaoGeral` = rounded mean of the 3 criteria)
- **Story/requirement traceability**: `business-rules.md` "Aggregation Correctness"

### Step 3: Business Logic Summary
- [x] Document Steps 1–2 in `aidlc-docs/construction/unit3-avaliacao-parceiro/code/summary.md` (new file, markdown only)

### Step 4: Firestore Rules Generation
- [x] Modify `firestore.rules`, `match /obras/{obraId}` client `allow update` condition:
  - Replace `hasOnly(['avaliacaoNota', 'avaliacaoComentario', 'avaliadoEm'])` with `hasOnly(['avaliacaoCriterios', 'avaliacaoGeral', 'avaliacaoParceiros', 'avaliacaoComentario', 'avaliadoEm'])`
  - Add one-shot guard: `!('avaliacaoCriterios' in resource.data)` (NFR Design — Rules-Layer Existence Guard)
  - Add range/type validation on the 3 criteria + Geral (NFR Design — Field-Level Type/Range Validation)
- **Story/requirement traceability**: FR-4.4, FR-4.5; NFR Requirements Q1/Q2

### Step 5: Firestore Rules Testing
- [x] Extend `firestore.rules.test.js` (existing file) with a new test group for the obra avaliação rules:
  - Client can submit a valid 3-criteria rating on their own obra (assertSucceeds)
  - Client cannot submit a second rating once `avaliacaoCriterios` already exists (assertFails — one-shot guard)
  - Client cannot submit a criterion value outside 1-5, or a non-integer (assertFails — range/type validation)
  - Client cannot write `avaliacaoNota` anymore (assertFails — removed from `hasOnly`)
  - Client cannot rate another client's obra (assertFails — existing ownership check, unchanged, regression check)
- **Story/requirement traceability**: NFR Requirements Security disposition (SECURITY-05, SECURITY-08)
- **Note**: execution requires the Firestore emulator (Java) — same environment dependency already documented for `npm run test:rules` in this session; tests are written now, run during Build and Test.

### Step 6: Frontend Components Generation
- [x] Modify `js/data.js`: change `enviarAvaliacao` signature from `(obraId, nota, comentario)` to `(obraId, criterios, avaliacaoGeral, avaliacaoParceiros, comentario)`, writing `{ avaliacaoCriterios: criterios, avaliacaoGeral, avaliacaoParceiros, avaliacaoComentario: comentario, avaliadoEm: serverTimestamp() }`.
- [x] Modify `cliente/index.html`'s `#modal-avaliacao`: replace the single `#avaliacao-estrelas` div with the 3-criteria + parceiro-label + Geral-preview structure from `frontend-components.md`. Add `data-testid` attributes: `avaliacao-parceiro-label`, `avaliacao-estrelas-tempo`, `avaliacao-estrelas-acabamento`, `avaliacao-estrelas-organizacao`, `avaliacao-geral-preview`.
- [x] Modify `cliente/app.js`:
  - Import `mediaCriterios`, `parceirosCreditados` from `js/avaliacao.js`
  - Replace `avaliacaoNotaAtual` module state with `avaliacaoNotas`/`avaliacaoParceirosAtual` per `frontend-components.md`
  - Rewrite `abrirAvaliacao`, `renderEstrelasAvaliacao`, `selecionarEstrela`, `enviarAvaliacaoObra` per the new signatures/flow
  - Update the `obra_concluida` notification row: gate on `!obra.avaliacaoCriterios`; confirmation text shows the 3 criteria + Geral instead of the old single nota
  - Update the `avaliacao_registrada` notification message text to reference `avaliacaoGeral`
- [x] Modify `admin/app.js`:
  - Import `calcularAcumuladoParceiro` from `js/avaliacao.js`
  - Add `renderAvaliacaoParceiro(parceiroId)`, called from within `renderParceiroDetalhe`, inserting the new `.parceiro-avaliacao-card` markup (empty state or 3 criteria + Geral + count) right after the existing header card
- **Story/requirement traceability**: FR-4.1, FR-4.2, FR-4.8, FR-4.9

### Step 7: Frontend Components Testing
- [x] No DOM/browser test framework exists in this repo (same decision as Unit 1) — the extracted pure logic (Step 2) covers calculation/attribution/accumulation correctness. DOM wiring verified manually during Build and Test (3-star submission, parceiro name display, admin card display, one-shot lock).
- **Story/requirement traceability**: N/A (manual verification, documented not silently skipped)

### Step 8: Frontend Components Summary
- [x] Document Steps 4–6 in the same `aidlc-docs/construction/unit3-avaliacao-parceiro/code/summary.md`

### Step 9: Documentation Generation
- [x] Finalize `aidlc-docs/construction/unit3-avaliacao-parceiro/code/summary.md` with full file list (created vs. modified) and "how to run the tests" note

## Not Applicable for This Unit
- **Project Structure Setup**: N/A — brownfield, existing structure reused
- **API Layer / Repository Layer**: N/A — no backend component (Workflow Planning: Application Design/Infrastructure Design both SKIP)
- **Database Migration Scripts**: N/A — no migration/backfill of legacy `avaliacaoNota` data (Functional Design Q1=A: left untouched, not migrated)
- **Deployment Artifacts**: N/A — static file + rules changes only, picked up by existing deploy flow
