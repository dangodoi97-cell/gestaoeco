# Business Logic Model — Unit 3: Avaliação por Critérios vinculada ao Parceiro

## Flow 1: Client Submits Rating (`cliente/app.js`)

**Trigger**: Same as today — the "Avaliar serviço" button on the `obra_concluida` notification row, gated by the obra not yet being rated (FR-4.5, Q7/Q8=A from Requirements).

1. **Gate check**: show the button only when `n.tipo === 'obra_concluida' && obra && !obra.avaliacaoCriterios` (replaces today's `!obra.avaliacaoNota` check).
2. **Compute credited parceiros** (runs client-side, from already-loaded data — no new Firestore read):
   a. Let `etapasDaObra = (window._todasEtapas || []).filter(e => e.obraId === obra.id && e.status === 'concluido')` (Q2=A: only concluded etapas count).
   b. For each etapa in `etapasDaObra`, collect parceiro refs from **both** possible shapes: the legacy single `{parceiroId}` field (if present, name unavailable there — see note below) and the multi-parceiro `parceiros: [{parceiroId, nome, repasse}]` array (if present).
   c. Dedupe by `parceiroId`, keeping the first `nome` encountered for each.
   d. **Note**: if an etapa only carries the legacy `parceiroId` field (no `nome`), fall back to looking up the name from `db_parceiros` if available client-side, or omit the name and only keep the id — this is an existing data-shape inconsistency already handled elsewhere in the codebase (`renderParceiroDetalhe`'s own dual check) and is not introduced by this unit.
   e. Result: `avaliacaoParceiros = [{parceiroId, nome}, ...]` — may be `[]` (Q3=A: rating still proceeds, credits nobody).
3. **Show parceiro name(s) in the rating UI** (FR-4.9): if `avaliacaoParceiros.length === 1`, show that one name; if `> 1`, list all distinct names (Q5=A); if `0`, show no name line at all.
4. **Client fills in 3 star rows** (Tempo de execução, Acabamento, Organização e limpeza — each independently 1-5, all required) **plus** the existing free-text comment field.
5. **Compute `avaliacaoGeral`** = arithmetic mean of the 3 selected criteria, rounded to 1 decimal place, e.g. `Math.round(((t + a + o) / 3) * 10) / 10`.
6. **Submit**: call the updated `enviarAvaliacao(obraId, { tempoExecucao, acabamento, organizacaoLimpeza }, avaliacaoGeral, avaliacaoParceiros, comentario)` (signature change from today's `enviarAvaliacao(obraId, nota, comentario)`).
7. `js/data.js`'s `enviarAvaliacao` writes exactly `{ avaliacaoCriterios, avaliacaoGeral, avaliacaoParceiros, avaliacaoComentario, avaliadoEm }` to the obra doc — matching the new `hasOnly([...])` list in `firestore.rules`.
8. Existing notification side-effect (admin gets notified of the new rating, `criarNotificacao({tipo: 'avaliacao_registrada', ...})`) is unchanged in shape, but its message text should mention `avaliacaoGeral` instead of the old single `nota` value.
9. **No edit path**: once `avaliacaoCriterios` exists on the obra, the button never reappears (same one-shot semantics as today, just keyed off the new field).

## Flow 2: Admin Views Parceiro's Accumulated Rating (`admin/app.js`, `renderParceiroDetalhe`)

**Trigger**: Admin opens a parceiro's detail screen (existing navigation, unchanged).

1. Reuse the already-loaded `db_obras` (no new listener).
2. Filter: `obrasAvaliadasDoParceiro = db_obras.filter(o => (o.avaliacaoParceiros || []).some(p => p.parceiroId === parceiroDetalheId))`.
3. If empty → render a neutral "Ainda sem avaliações" state (no criteria/averages shown) — do not show zeroes, which would misleadingly read as a bad score.
4. If non-empty → compute the 4 means described in `domain-entities.md`'s `ParceiroAvaliacaoAcumulada` and render them in the format from the user's original example:
   ```
   Acabamento      X.X/5
   Tempo de execução  X.X/5
   Organização e limpeza  X.X/5
   Avaliação Geral: X.X/5   (+ "N serviços avaliados")
   ```
5. This section is additive to the existing `renderParceiroDetalhe` markup (financial summary, payment history, notifications) — it does not replace or reorder any existing block (FR-4.8/Q9=A: shown only here, not on the general parceiro list).

## Recompute Triggers
- Flow 1 runs once, on explicit user submission — not reactive/listener-driven.
- Flow 2's aggregation recomputes every time `renderParceiroDetalhe` is called — which already happens today whenever `db_obras` changes (via the existing `escutarObras` listener re-render chain) or the admin navigates to that parceiro's screen. No new listener is introduced, consistent with the Performance NFR already established for this project (avoid new per-view Firestore listeners; compute from data already held in memory).

## Known Limitation Flagged for NFR (not fixed in this unit)
`avaliacaoParceiros` is computed and written entirely client-side, from client-supplied data, with no source-of-truth cross-check by `firestore.rules` against the obra's actual `etapas`. A malicious/compromised client account could in principle submit a rating crediting a `parceiroId` that never actually worked on that obra, inflating that parceiro's accumulated average. This mirrors an accepted pattern already established in Unit 2 (clients writing structured data trusted at face value for a non-financial, UI-facing feature) — carried forward to NFR Requirements/Design for this unit to explicitly accept or mitigate, not decided here.
