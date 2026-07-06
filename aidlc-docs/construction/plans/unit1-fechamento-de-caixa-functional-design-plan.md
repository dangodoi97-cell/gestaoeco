# Functional Design Plan — Unit 1: Fechamento de Caixa e Cores

## Execution Checklist
- [ ] Step 1: Answer the 4 questions below (2 are deferred edge cases from User Stories planning — A4/A5 — that must be resolved now)
- [ ] Step 2: Generate `aidlc-docs/construction/unit1-fechamento-de-caixa/functional-design/business-logic-model.md`
- [ ] Step 3: Generate `aidlc-docs/construction/unit1-fechamento-de-caixa/functional-design/business-rules.md`
- [ ] Step 4: Generate `aidlc-docs/construction/unit1-fechamento-de-caixa/functional-design/domain-entities.md`
- [ ] Step 5: Generate `aidlc-docs/construction/unit1-fechamento-de-caixa/functional-design/frontend-components.md`

## Questions

### Question 1 (deferred from User Stories A4) — Negative sobra styling
`sobra = entrada − repasse` (FR-2.2). What should happen when `repasse > entrada` (negative sobra — the contractor has paid partners more than the client has paid in so far)?

A) Still green, with a "-" sign — sobra is just a signed number, no special treatment
B) A distinct 4th style for negative values (e.g. red background regardless of the "repasse=red" mapping, to visually flag it as a problem) — please specify styling preference after [Answer]
C) This shouldn't realistically happen given billing practices — default number formatting is fine, no special case needed
X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 2 (deferred from User Stories A5) — "Sem cliente/Outros" bucket and rejected clients
Should obras linked to a client whose account status is `'rejeitado'` be grouped under "Sem cliente/Outros" in the filter (FR-1.3), or should they still filter under that (former) client's name?

A) Group under "Sem cliente/Outros" — same bucket as truly unlinked obras
B) Keep under the rejected client's own name — only truly empty `clienteId` goes to "Outros"
X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 3 — What does "período" mean in the Fechamento de Caixa financial summary?
Requirements FR-1.2 says the summary covers "total entrada/repasse/sobra for the period" for the selected client's obras in execution (`status:'andamento'`). No date-range widget was specified yet.

A) "Período" = right now — a live snapshot of current totals for that client's in-execution obras, no date picker at all (simplest, matches FR-1.2's literal wording)
B) Add a date-range picker (e.g. this month, last month, custom range) that filters which obras/etapas count toward the totals by their `criadoEm`/`dataConc` dates — a real periodic cash-closing report
X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 4 — Which obras count toward the client's financial summary?
FR-1.2 says the list shows obras "em execução" (`status:'andamento'`) for the selected client, but doesn't say whether the financial totals (entrada/repasse/sobra) should also include that client's already-**completed** (`status:'concluida'`) obras, or only the in-execution ones shown in the list.

A) Only the in-execution obras shown in the list — totals and list always match the same obra set
B) All of the client's obras regardless of status (andamento + concluida) — the list shows in-execution obras, but the financial totals are a full picture of the client relationship
X) Other (please describe after [Answer]: tag below)

[Answer]: A
