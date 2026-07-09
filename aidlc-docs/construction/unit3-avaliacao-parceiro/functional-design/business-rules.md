# Business Rules — Unit 3: Avaliação por Critérios vinculada ao Parceiro

## Rule Set: Rating Composition (FR-4.2, FR-4.3)
1. Exactly 3 fixed criteria, all required, no admin-configurable list (Requirements Q3=A): **Tempo de execução**, **Acabamento**, **Organização e limpeza** — each an integer 1-5.
2. `avaliacaoGeral` is **always** the arithmetic mean of the 3 criteria from that same submission (Requirements Q4=A) — never a value chosen independently by the client. Rounded to 1 decimal.
3. The UI must always show the 3 individual criteria alongside the Geral, never the Geral alone (Requirements Q4 clarification) — applies both to the client's own past-rating display and the admin's parceiro-detail accumulated view.

## Rule Set: Parceiro Attribution (FR-4.6)
1. Only parceiros linked via an etapa with `status === 'concluido'` count (Functional Design Q2=A) — etapas in `'execucao'` or any other status are ignored for attribution purposes, even if the obra itself is now `'concluida'`.
2. If more than one distinct parceiro is found across the obra's concluded etapas, **every one of them receives the full rating** — no proportional split by `repasse` value, no averaging-down (Requirements Q2=A). A parceiro who did one small etapa is credited identically to one who did the obra's largest etapa.
3. If zero parceiros are found, the rating is still submitted and stored (comment + criteria remain on the obra for the client's own record), but `avaliacaoParceiros = []` and it contributes to no parceiro's accumulated average (Functional Design Q3=A).
4. Attribution is computed **once**, at submission time, and frozen into `avaliacaoParceiros` on the obra document. It is **not** recomputed later even if the obra's etapas subsequently change (e.g., an etapa's parceiro is corrected after the fact, or a new etapa is added post-rating) — the rating reflects who was credited at the moment the client rated, matching the one-shot/no-edit nature of the rating itself (FR-4.5).

## Rule Set: Name Display to Client (FR-4.9)
1. The parceiro name(s) shown to the client at rating time come from the `nome` already denormalized on `etapas.parceiros[]` entries — **no new `firestore.rules` read grant is introduced**; the client already has read access to their own obra's etapas.
2. The name is frozen into `avaliacaoParceiros` at submission time (Functional Design Q4=A) — if the parceiro is renamed in the admin cadastro afterward, the client's already-submitted rating continues showing the old name. (The admin's own accumulated-rating view, `ParceiroAvaliacaoAcumulada`, is keyed by `parceiroId`, not by name, so renames don't fragment the accumulated average — only the historical display text is "frozen".)
3. When more than one distinct parceiro is credited, **all distinct names are listed** to the client (Functional Design Q5=A) — no generic "equipe" label is used.
4. **Explicitly out of scope, flagged as a pre-existing finding, not introduced by this unit**: the client's existing read access to `etapas` (granted by Unit 2's `souProprietarioObra` rule) already exposes the full `parceiros[]` array today, including the `repasse` (subcontractor payment) amount — a commercially sensitive figure the UI has simply never rendered. This unit does not change that exposure (it only reads the already-accessible `nome` field) and does not fix it — noted here for future security-baseline review, not actioned now.

## Rule Set: Legacy Data (FR-4.4, Requirements Q6=A + Functional Design Q1=A)
1. Obras rated before this change (carrying the old `avaliacaoNota`/`avaliacaoComentario`/`avaliadoEm` shape) are left untouched — no migration script, no backfill.
2. Those legacy ratings are excluded from every parceiro's `ParceiroAvaliacaoAcumulada` (which only scans for the new `avaliacaoCriterios`/`avaliacaoGeral`/`avaliacaoParceiros` fields) — a parceiro's accumulated average only reflects services rated after this unit ships.
3. `avaliacaoNota` is removed from code and from the `firestore.rules` allow-list, but **not deleted from existing documents** — old values simply become dead/unread data.

## Rule Set: One-Shot Submission (FR-4.5, Requirements Q7=A/Q8=A)
1. The rating button appears once, keyed by the absence of `avaliacaoCriterios` on the obra.
2. No UI path exists to edit or resubmit a rating once `avaliacaoCriterios` is set — same lock semantics as today's `avaliacaoNota`, just on the new field.
3. `firestore.rules` enforces this the same way the old rule did: the client's `allow update` for an obra only permits writing the new rating fields via `hasOnly([...])`, but does **not** itself prevent a second write attempt with different values (Firestore rules don't easily express "only if this field was previously absent" without a `resource.data` existence check) — **Functional Design recommendation for NFR**: add `!('avaliacaoCriterios' in resource.data)` to the update condition so the rules layer, not just the UI, enforces one-shot submission. This closes the same class of gap Unit 2's security work already addressed elsewhere (never trust the client UI alone for a security/integrity invariant).

## Rule Set: Aggregation Correctness (mirrors Unit 1's precedent)
- `ParceiroAvaliacaoAcumulada.mediaGeral` is the mean of each rated obra's already-stored `avaliacaoGeral` — **not** recomputed as the mean of the means of the 3 criteria across obras (these can differ slightly due to rounding; Requirements Q5=A says "average of all evaluations received", i.e. average the per-service Geral values directly).
- Property-Based Testing candidate (extension enabled project-wide): "for any set of N rated obras crediting the same parceiro, `mediaGeral` recomputed after adding an (N+1)th rated obra changes by a bounded, predictable amount" and "removing a parceiro's credit from one obra and recomputing never changes any *other* parceiro's average" (attribution isolation).
