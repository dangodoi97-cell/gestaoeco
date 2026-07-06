# Code Generation Plan — Unit 1: Fechamento de Caixa e Cores

**Workspace Root**: `c:\repos-true\gestaoeco` (brownfield — modify existing files in place per Critical Rules; never create `_new`/`_modified` copies)
**Requirements covered**: FR-1 (FR-1.1–FR-1.4), FR-2 (FR-2.1–FR-2.3)
**Design source**: `aidlc-docs/construction/unit1-fechamento-de-caixa/functional-design/`
**Dependencies**: None on Unit 2 (confirmed in unit-of-work-dependency.md)

## Tech-stack note (first test tooling in this repo)
This project has zero test infrastructure today. The Property-Based Testing extension is enabled (full enforcement), and business-rules.md flags a genuine invariant (`totalSobra === totalEntrada − totalRepasse`) worth a property test. Since Unit 1 has no NFR Requirements stage (per execution-plan.md) — the stage that would normally pick a PBT framework — this plan makes that call now, to be reused (not re-decided) by Unit 2:
- **Test runner**: Node's built-in `node:test` (zero extra dependency, matches this project's zero-build-step ethos as closely as a test runner can)
- **PBT framework**: `fast-check` (per requirements.md's recommendation and property-based-testing.md's JS/TS framework table)
- This introduces the project's **first `package.json`** (root-level, `devDependencies` only — the deployed static site is completely unaffected; tests run locally/CI only, never shipped to Netlify)

## Steps

### Step 1: Business Logic Generation
- [ ] Create `js/fechamento.js` (new file) exporting pure, dependency-free functions per `business-logic-model.md`:
  - `classifyObraClient(obra, usuariosById)`
  - `entradaObra(obra)`, `repasseObra(obra, etapas)`, `sobraObra(obra, etapas)`
  - `filtrarObras(obras, filtro, usuariosById)`
  - `calcularResumoFechamento(obras, etapasPorObra, usuariosById, filtro)` → returns the `FechamentoCaixaViewModel` shape from `domain-entities.md`
  - A small local `parseBRLValue(str)` helper (intentionally local/duplicated, same pattern already used elsewhere in this codebase — kept dependency-free so `admin/app.js` imports *from* this module, not the other way around)
- **Story/requirement traceability**: FR-1.2, FR-1.3, FR-2.2

### Step 2: Business Logic Unit Testing
- [ ] Create root-level `package.json` (new — first in this repo) with `devDependencies: { "fast-check": "^3" }` and a `"test": "node --test"` script
- [ ] Create `js/fechamento.test.js` (new) with:
  - Example-based tests (PBT-10: complementary, not sole coverage) covering: single obra, multiple obras for one client, "Sem cliente/Outros" bucket (empty `clienteId`, `rejeitado` client, `pendente` client, deleted-user reference), negative sobra
  - One `fast-check` property test asserting `calcularResumoFechamento(...).totalSobra === totalEntrada − totalRepasse` holds for randomly generated obra/etapa sets (including negative-sobra cases), per business-rules.md's flagged invariant
- **Story/requirement traceability**: business-rules.md "Aggregation Correctness"

### Step 3: Business Logic Summary
- [ ] Document Steps 1–2 in `aidlc-docs/construction/unit1-fechamento-de-caixa/code/summary.md` (markdown only)

### Step 4: Frontend Components Generation
- [ ] Modify `admin/index.html`: add the filter dropdown + summary tiles markup inside the existing `#page-obras` section, per `frontend-components.md`'s component hierarchy. Add `data-testid` attributes (`fechamento-cliente-select`, `fechamento-resumo-entrada`, `fechamento-resumo-repasse`, `fechamento-resumo-sobra`) per the Automation Friendly Code Rules.
- [ ] Modify `admin/app.js`: import from `js/fechamento.js`; add `popularFiltroFechamento()`, module-level `fechamentoClienteSelecionado` state, `window.filtrarObrasPorCliente(clienteId)`, `renderFechamentoResumo()`; apply the new filter predicate to the existing obras-list render function.
- [ ] Modify `css/style.css`: add `--bg-info`/`--text-info` custom properties (blue), and `.fechamento-filtro-bar`/`.fechamento-resumo`/`.stat-tile`(+ 3 color variants) classes, following the existing token/component conventions.
- **Story/requirement traceability**: FR-1.1, FR-1.4, FR-2.1, FR-2.3

### Step 5: Frontend Components Testing
- [ ] No DOM/browser test framework exists in this repo and introducing one is out of scope for this unit (not requested, adds significant new tooling for a small static site). The extracted pure logic (Step 2) covers the actual calculation/classification correctness. DOM wiring will be manually verified during Build and Test (dropdown selection narrows the list, tiles show correct colored totals, "(Todos)" reverts to today's behavior).
- **Story/requirement traceability**: N/A (manual verification only, documented here rather than silently skipped)

### Step 6: Frontend Components Summary
- [ ] Document Step 4 in the same `aidlc-docs/construction/unit1-fechamento-de-caixa/code/summary.md`

### Step 7: Documentation Generation
- [ ] Finalize `aidlc-docs/construction/unit1-fechamento-de-caixa/code/summary.md` with a full file list (created vs. modified) and a short "how to run the tests" note (`npm install && npm test`)

## Not Applicable for This Unit
- **Project Structure Setup**: N/A — brownfield, existing structure reused
- **API Layer / Repository Layer**: N/A — no backend component in Unit 1 (confirmed in Application Design: Unit 1 has no new components)
- **Database Migration Scripts**: N/A — no schema/data-model change, `js/fechamento.js` only reads existing fields
- **Deployment Artifacts**: N/A — static file changes only, picked up by the existing Netlify deploy flow with no new config
