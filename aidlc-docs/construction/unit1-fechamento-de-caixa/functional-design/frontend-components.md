# Frontend Components — Unit 1: Fechamento de Caixa e Cores

**Location**: All changes are within the existing admin "Obras" page (`admin/index.html`'s `#page-obras` section) and `admin/app.js` — no new page/tab, per Application-Design-equivalent decision (Q1=A from the earlier application-design-plan question round in Unit 1's context: filter lives inside the existing tab).

## Component Hierarchy

```
#page-obras (existing)
├── [NEW] .fechamento-filtro-bar
│   └── <select id="fechamento-cliente-select">  — options: "(Todos)" default, one per aprovado client, "Sem cliente / Outros"
├── [NEW] .fechamento-resumo (rendered only when a filter is active; hidden when selection is "(Todos)")
│   ├── .stat-tile (Entrada — blue)
│   ├── .stat-tile (Repasse — red)
│   └── .stat-tile (Sobra — green, sign-aware per business-rules.md)
└── #lista-obras (existing — reused unmodified, just fed the filtered array instead of the full one)
```

## New DOM/State

### `<select id="fechamento-cliente-select">`
- **Options**: populated by a new `popularFiltroFechamento()` function (parallel to existing `popularSelectClientes()`), listing `status:'aprovado'` clients by name, plus a fixed trailing "Sem cliente / Outros" option (`value="__outros__"`), plus a default "(Todos)" option (`value=""`) that reproduces today's unfiltered behavior.
- **Event**: `onchange="window.filtrarObrasPorCliente(this.value)"`

### Module-level state (admin/app.js)
- `let fechamentoClienteSelecionado = '';` — mirrors the dropdown's current value; read by the existing obras-list render function and the new summary-render function.

### `window.filtrarObrasPorCliente(clienteId)`
- **Input**: the select's new value (`''`, a client uid, or `'__outros__'`)
- **Behavior**: sets `fechamentoClienteSelecionado`, then calls the existing obras-list re-render function (now filter-aware) and the new `renderFechamentoResumo()`.

### `renderFechamentoResumo()`
- **Behavior**: computes the `FechamentoCaixaViewModel` (per business-logic-model.md) from `db_obras`/`window._todasEtapas`, and renders/hides `.fechamento-resumo` accordingly (hidden entirely when `fechamentoClienteSelecionado === ''`, i.e. "(Todos)" — matches business-rules.md rule 3).

## Existing Component Reused
- The obras list render function (already renders `db_obras` filtered by `status:'andamento'` today) gains one additional filter predicate (`classifyObraClient`-based) applied before rendering — no new list markup, no new card component.

## Styling
- `.fechamento-filtro-bar`, `.fechamento-resumo`, `.stat-tile` are new CSS classes added to `css/style.css`, following the existing card/badge visual language (same border-radius/spacing tokens already used by `.card`); `.stat-tile` variants (`.stat-tile-entrada`, `.stat-tile-repasse`, `.stat-tile-sobra`) apply the color rules from business-rules.md.

## User Interaction Flow
1. Admin opens the Obras tab (unchanged entry point).
2. Admin selects a client (or "Sem cliente / Outros") from the new dropdown.
3. The obras list narrows to that client's in-execution obras; the summary tiles appear showing Entrada/Repasse/Sobra totals for exactly that filtered set.
4. Admin selects "(Todos)" to return to today's unfiltered view; the summary tiles disappear.

## Form Validation
None — this is a read-only filter/reporting view, no form submission is involved.

## API Integration Points
None beyond the existing in-memory `db_obras`/`window._todasEtapas`/clients data already populated by `js/data.js`'s existing listeners — no new Firestore reads are introduced by this unit (per the Performance NFR in requirements.md).
