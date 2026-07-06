# Business Logic Model — Unit 1: Fechamento de Caixa e Cores

## Overview
All logic here is computed client-side from data already held in memory by the admin panel's existing real-time listeners (`db_obras`, `window._todasEtapas`, and the existing clients listener) — per requirements.md's Performance note, no new Firestore listeners are introduced.

## Core Computation Pipeline

```
1. Cliente Filter Selection
   selectedClienteId: string | '__outros__' | null (null = no filter, show all — existing default behavior)

2. Client Classification (per obra)
   classifyObraClient(obra, usuariosById) -> 'aprovado-client' | 'outros'
     - 'outros' if:
         - obra.clienteId is null/empty, OR
         - usuariosById[obra.clienteId] does not exist (deleted user doc), OR
         - usuariosById[obra.clienteId].status !== 'aprovado' (covers 'rejeitado' per Q2=A,
           and 'pendente' by the same generalized principle — see audit.md 2026-07-06 entry)
     - 'aprovado-client' otherwise (obra.clienteId references a usuarios doc with status:'aprovado')

3. Obra Filtering (list — FR-1.2)
   [CORRECTED 2026-07-06 during Code Generation — the original version below incorrectly applied
   the andamento-only restriction even when no filter is selected, contradicting business-rules.md's
   rule 3 ("no client selected = behaves exactly as today's unfiltered view"). Fixed to:]

   filteredObras =
     selectedClienteId is empty/null
       ? db_obras                                          [unchanged, today's default behavior]
       : db_obras.filter(o =>
           o.status === 'andamento' AND
           (selectedClienteId === '__outros__'
             ? classifyObraClient(o) === 'outros'
             : (o.clienteId === selectedClienteId AND classifyObraClient(o) === 'aprovado-client')))

4. Per-Obra Financial Values
   [CORRECTED 2026-07-06 during Build and Test manual verification — the original formula below
   computed sobra from entradaObra (down-payment received), which the product owner clarified is
   wrong: sobra/profit must be based on the obra's total contracted value, not on how much of it
   has actually been paid in so far. Fixed to:]

   repasseObra(obra)    = sum(etapa.valRepasse for etapa in etapasOf(obra))   [parseBRL each before summing]
   entradaObra(obra)    = parseBRL(obra.entrada || '0')                      [cash-flow indicator ONLY — see below]
   valorTotalObra(obra) = sum(etapa.val for etapa in etapasOf(obra))         [gross value charged to the client]
   sobraObra(obra)      = valorTotalObra(obra) - repasseObra(obra)           [net profit; can be negative, Q1=A: no special case]

5. Aggregate Financial Summary (Fechamento de Caixa — FR-1.2, Q4=A)
   Computed over the SAME filteredObras set as step 3 (no separate query, no status:'concluida' obras included):
     totalEntrada    = sum(entradaObra(o) for o in filteredObras)      [cash-flow indicator, shown on its own tile, decoupled from totalSobra]
     totalValorTotal = sum(valorTotalObra(o) for o in filteredObras)
     totalRepasse    = sum(repasseObra(o) for o in filteredObras)
     totalSobra      = totalValorTotal - totalRepasse   [== sum(sobraObra(o) for o in filteredObras); NOT totalEntrada - totalRepasse]

6. "Período" (Q3=A)
   No date filtering exists anywhere in this pipeline. "Período" means "right now" — the live
   snapshot of currently-in-execution obras for the selected client, recomputed on every relevant
   onSnapshot firing (obras, or the aggregated etapas listener), same as every other view in this app.
```

## Reused vs. New Logic
- **Reused unchanged**: `parseBRL`/`fmtBRL` (admin/app.js), `db_obras`/`window._todasEtapas` (existing listeners from `js/data.js`'s `escutarObras`/`escutarTodasEtapas`), the existing clients listener (`escutarClientes`, already populates a `usuariosById`-shaped lookup for `popularSelectClientes` — reuse or extend that lookup rather than adding a new one).
- **New**: `classifyObraClient`, the filter-application step (3), and the aggregate-summary computation (5) — all pure functions over already-in-memory data, no I/O.

## Recompute Triggers
The filter/summary must recompute whenever:
- The user changes the client-filter dropdown selection
- `db_obras` changes (existing `escutarObras` callback already re-renders the obras list — the Fechamento de Caixa view hooks into the same re-render, not a separate listener)
- The aggregated etapas data changes (existing `escutarTodasEtapas` callback), since `repasseObra`/`sobraObra` depend on etapa-level `valRepasse`
