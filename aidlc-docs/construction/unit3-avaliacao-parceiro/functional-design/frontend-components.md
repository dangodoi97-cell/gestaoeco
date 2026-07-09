# Frontend Components — Unit 3: Avaliação por Critérios vinculada ao Parceiro

**Location**: Two existing screens change — the client's rating modal (`cliente/index.html`/`cliente/app.js`, `#modal-avaliacao`) and the admin's parceiro detail screen (`admin/app.js`, `renderParceiroDetalhe`). No new page/tab.

## Component Hierarchy — Client Rating Modal (`#modal-avaliacao`)

```
#modal-avaliacao (existing modal, restructured)
├── [NEW] .avaliacao-parceiro-label   — "Serviço executado por: {nome}" / "{nome1}, {nome2}" / hidden if none
├── [CHANGED] 3× estrelas rows (was 1×), each with its own label:
│   ├── .avaliacao-criterio (label: "Tempo de execução")   → #avaliacao-estrelas-tempo
│   ├── .avaliacao-criterio (label: "Acabamento")          → #avaliacao-estrelas-acabamento
│   └── .avaliacao-criterio (label: "Organização e limpeza") → #avaliacao-estrelas-organizacao
├── [NEW] .avaliacao-geral-preview    — live-updating "Avaliação Geral: X.X/5" as the 3 rows are filled
├── #avaliacao-comentario (existing textarea, unchanged)
└── button "Enviar" → window.enviarAvaliacaoObra() (changed behavior, same entry point)
```

## New/Changed DOM/State (`cliente/app.js`)

### Module-level state
- **Replaced**: `let avaliacaoObraId = null, avaliacaoNotaAtual = 0;`
- **With**: `let avaliacaoObraId = null, avaliacaoNotas = { tempoExecucao: 0, acabamento: 0, organizacaoLimpeza: 0 }, avaliacaoParceirosAtual = [];`

### `window.abrirAvaliacao(obraId)` (changed)
- Sets `avaliacaoObraId`, resets `avaliacaoNotas` to all-zero.
- Computes `avaliacaoParceirosAtual` per business-logic-model.md Flow 1, step 2 (scan `window._todasEtapas` for concluded etapas of this obra, dedupe parceiros).
- Renders the parceiro label (step 3 of Flow 1) and calls `renderEstrelasAvaliacao()` for all 3 criteria.

### `renderEstrelasAvaliacao()` (changed — now renders 3 independent star rows instead of 1)
- Same star-icon markup pattern as today (`ti-star-filled`/`ti-star`), repeated for each of the 3 criteria keys, each row's `onclick` calling `window.selecionarEstrela(criterioKey, n)`.
- Also updates `.avaliacao-geral-preview` live: hidden/"—" until all 3 criteria have a value ≥ 1, then shows the running mean.

### `window.selecionarEstrela(criterio, n)` (changed signature — was `(n)`)
- Sets `avaliacaoNotas[criterio] = n`, re-renders.

### `window.enviarAvaliacaoObra()` (changed)
- **Validation**: all 3 criteria must be ≥ 1 (was: single nota ≥ 1) — if any is 0, toast "Selecione uma nota para todos os critérios" and abort.
- Computes `avaliacaoGeral` per business-logic-model.md step 5.
- Calls `enviarAvaliacao(avaliacaoObraId, avaliacaoNotas, avaliacaoGeral, avaliacaoParceirosAtual, comentario)` (new signature).
- Notification side-effect message text updated to reference `avaliacaoGeral` instead of the old single `nota`.

### Existing display of a submitted rating (notification list row)
- **Changed** condition: `n.tipo === 'obra_concluida' && obra && !obra.avaliacaoCriterios` (was `!obra.avaliacaoNota`) for showing the "Avaliar serviço" button.
- **Changed** confirmation line: was `"Você avaliou com ${obra.avaliacaoNota} estrelas"` → now shows the 3 criteria + Geral (per business-rules.md rule "always show criteria alongside Geral"), e.g.:
  ```
  Tempo de execução: X/5 · Acabamento: X/5 · Organização e limpeza: X/5 · Geral: X.X/5
  ```

## Component Hierarchy — Admin Notification Card (`renderNotificacoesAdmin`) [ADDED 2026-07-09]
- **Changed**: notifications with `tipo === 'avaliacao_registrada'` now render an explicit `<button>Conferir</button>` inside the card (in addition to the whole card already being clickable), calling the same `abrirNotificacaoAdmin(id)` with `event.stopPropagation()`. **Why**: user request after testing — wanted an explicit, visible "Conferir" action rather than relying only on the whole card being clickable (which existed but wasn't discoverable enough).
- **Notification content** (`cliente/app.js`'s `enviarAvaliacaoObra`): `titulo` changed from `Nova avaliação de {nome}` to `Obra avaliada` (per user's requested wording); `mensagem` unchanged (still names the cliente, obra, and nota geral).

## Component Hierarchy — Admin Obra Detail (`renderDetalheObra`, admin/app.js) [ADDED 2026-07-09]
- **Changed**: when `o.avaliacaoCriterios` exists, a new section renders inside the existing header card, right after the progress bar and before the "Financeiro da obra" divider: the 3 criteria + Geral for **that specific obra** (not the parceiro's accumulated average — that stays on the parceiro detail screen, per FR-4.8) + the free-text comment if present.
- **Why**: user request — the admin notification for a new rating already links to `abrirObra(obraId)` (pre-existing routing, unchanged), but the obra detail screen had no rating display at all until now, so following the notification led nowhere useful.

## Component Hierarchy — Admin Parceiro Detail (`renderParceiroDetalhe`)

```
#parceiro-detalhe-content (existing)
├── (existing) CPF/CNPJ, telefone, editar/excluir buttons
├── [NEW] .parceiro-avaliacao-card   — inserted right after the existing header card, before "Aviso ao parceiro"
│   ├── if 0 obras avaliadas: empty state "Ainda sem avaliações"
│   └── if ≥1: 3 criterion rows (label + "X.X/5") + "Avaliação Geral: X.X/5" + "N serviços avaliados"
├── (existing) #resumo-financeiro-parceiro
├── (existing) Aviso ao parceiro / pagamentos / notificações — unchanged, unaffected
```

## New function (`admin/app.js`)

### `renderAvaliacaoParceiro(parceiroId)` (new, called from within `renderParceiroDetalhe`)
- Computes `ParceiroAvaliacaoAcumulada` per domain-entities.md, from `db_obras` already in memory.
- Returns the HTML fragment inserted into `.parceiro-avaliacao-card` — no new Firestore listener, matches existing in-memory computation pattern used elsewhere in this same function (`historico`, `totalDevido`).

## Styling
- Reuse existing star-icon pattern (`ti-star-filled`/`ti-star`, `#f59e0b`) for all 3 criteria rows in both the client modal and the admin card — no new icon set.
- `.parceiro-avaliacao-card` follows the existing `.card` visual language already used throughout `renderParceiroDetalhe`.

## User Interaction Flow (Client)
0. **[CORRECTED 2026-07-09 during Build and Test]** A second, persistent entry point was added to `renderDetalheObra`'s header card: whenever `o.status === 'concluida'`, either an "Avaliar serviço" button (if `!o.avaliacaoCriterios`) or the already-submitted breakdown (if rated) now renders directly on the obra detail screen — not just on the notification row. **Why**: manual testing found that an obra completed before the client opens/re-opens the notification (or one completed a while ago, whose notification may no longer be visible in the feed) had **no way at all** to be rated — the notification was the only access point, and it's not guaranteed to be visible/findable at the time the client wants to rate. This corrects the original Requirements/Functional Design choice (Q7=A, "same trigger as today, notification-only") — real testing showed that trigger alone is insufficient for a persistent "did we ever rate this obra" affordance, so this unit now implements Q7's declined Option B without a new question round (a bug-fix-level correction, not a new decision to revisit with the user).
1. Client receives the `obra_concluida` notification (unchanged entry point) and taps "Avaliar serviço" **or** opens the obra directly from the Obras list and taps the same button on its detail screen.
2. Modal opens showing the credited parceiro name(s) (or nothing, if none) and 3 empty star rows.
3. Client rates all 3 criteria; the "Avaliação Geral" preview updates live.
4. Client optionally adds a comment, taps "Enviar".
5. Modal closes; the notification row now shows the submitted breakdown; the button never reappears for this obra.

## User Interaction Flow (Admin)
1. Admin opens a parceiro's detail screen (unchanged entry point).
2. New card shows that parceiro's accumulated per-criterion + Geral averages (or the empty state), above the existing financial/payment sections — no extra navigation step.

## Form Validation
- Client modal: all 3 criteria required (≥1 star each) before "Enviar" is enabled/accepted — same one-shot lock as today, just gated on 3 values instead of 1.

## API Integration Points
- **Client**: `enviarAvaliacao` (changed signature, `js/data.js`) writes to the same `obras/{obraId}` document as today — no new collection, no new Cloud Function.
- **Admin**: no new reads — `renderAvaliacaoParceiro` consumes `db_obras`, already populated by the existing `escutarObras` listener.
