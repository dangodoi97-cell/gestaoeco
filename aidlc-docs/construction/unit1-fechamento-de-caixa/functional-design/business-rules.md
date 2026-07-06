# Business Rules — Unit 1: Fechamento de Caixa e Cores

## Rule Set: Color Mapping (FR-2.1)
| Value | Color | CSS Token (new/reused) |
|---|---|---|
| Repasse | Red | Reuse `--bg-danger`/`--text-danger` (already defined in `css/style.css`, used by `.badge-rej`/`.badge-apagar`) |
| Entrada | Blue | **New** `--bg-info`/`--text-info` tokens, added to `css/style.css` following the exact same custom-property pattern as the existing danger/success/warning tokens |
| Sobra | Green | Reuse `--bg-success`/`--text-success` (already defined, used by `.badge-done`/`.badge-aprov`/`.badge-pago`) |

**Rule**: Sobra is shown in green **even when negative** (Q1=A) — render as `-R$ X,XX` with the same green styling, no conditional color/style branching on sign. No 4th color is introduced.

## Rule Set: Client Filter Classification (FR-1.3, extends Q2=A)
An obra falls under **"Sem cliente/Outros"** if ANY of:
1. `obra.clienteId` is null, empty, or undefined
2. `obra.clienteId` references a `usuarios` document that no longer exists (deleted account)
3. `obra.clienteId` references a `usuarios` document whose `status !== 'aprovado'` (covers `'rejeitado'` per Q2=A, and `'pendente'` by direct generalization of the same principle — a client filter should only meaningfully group obras under clients the admin can actually still select in the dropdown)

Otherwise, the obra filters under its linked client's name.

**Corollary**: the client-selector dropdown (FR-1.4) lists only `usuarios` with `tipo:'cliente'` AND `status:'aprovado'` — consistent with rule 3 above and with the existing `popularSelectClientes` convention already used elsewhere in `admin/app.js` for other client-pickers.

## Rule Set: List/Summary Scope (FR-1.2, Q3=A, Q4=A)
1. Both the obras list and the financial summary are scoped to `status:'andamento'` obras only — completed obras are excluded from both (Q4=A: list and totals always match the same set).
2. No date-range filtering exists — "período" means the current live state (Q3=A). If this needs to become a real periodic report later (Q3's option B), that is out of scope for this unit and would need its own requirements pass.
3. When no client is selected (default state), the view behaves exactly as the existing Obras tab does today (unfiltered) — Unit 1 adds a filter, it does not change the default/no-filter behavior.
4. When the selected client (or "Outros") has zero matching obras, show all three summary values as `R$ 0,00` and the existing empty-list treatment already used elsewhere in the admin panel (no new empty-state design needed).

## Rule Set: Aggregation Correctness
- **[CORRECTED 2026-07-06 during Build and Test]** `totalSobra` MUST always equal `totalValorTotal - totalRepasse` exactly (not `totalEntrada - totalRepasse`, and not a separately-summed value that could drift) — enforced by computing it as a derived value, never stored or summed independently. `totalEntrada` is a cash-flow indicator only (how much has actually been paid in so far) and has no bearing on the profit calculation — a job with R$0 received so far but fully-priced etapas still shows its true (positive or negative) profit in Sobra, not a misleading number derived from unrelated payment timing.
- This is also this unit's primary Property-Based Testing candidate: "for any set of obras/etapas, sum(sobraObra) === totalValorTotal - totalRepasse" is an invariant that must hold regardless of how many obras or their individual valorTotal/repasse values, including negative-sobra obras.
