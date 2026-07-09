# Code Generation Summary — Unit 3: Avaliação por Critérios vinculada ao Parceiro

## Created
- `js/avaliacao.js` — pure logic: `mediaCriterios`, `parceirosCreditados`, `calcularAcumuladoParceiro`
- `js/avaliacao.test.js` — 12 tests (9 example-based + 3 property-based via `fast-check`)
- `aidlc-docs/construction/unit3-avaliacao-parceiro/code/summary.md` — this file

## Modified
- `firestore.rules` — `match /obras/{obraId}` update rule: replaced `avaliacaoNota` with `avaliacaoCriterios`/`avaliacaoGeral`/`avaliacaoParceiros` in the `hasOnly` allow-list; added one-shot guard (`!('avaliacaoCriterios' in resource.data)`) and range/type validation (`notaValida`/`geralValida` helpers)
- `firestore.rules.test.js` — added 6 tests for the new obra avaliação rules (valid submission, one-shot block, out-of-range block, non-integer block, old-field block, cross-client block)
- `js/data.js` — `enviarAvaliacao` signature changed from `(obraId, nota, comentario)` to `(obraId, criterios, avaliacaoGeral, avaliacaoParceiros, comentario)`
- `cliente/index.html` — `#modal-avaliacao` restructured: 3 star rows (one per criterion) + parceiro name label + live "Avaliação Geral" preview, with `data-testid` attributes
- `cliente/app.js` — imports `mediaCriterios`/`parceirosCreditados` from `js/avaliacao.js`; module state changed from `avaliacaoNotaAtual` to `avaliacaoNotas`/`avaliacaoParceirosAtual`; `abrirAvaliacao`/`renderEstrelasAvaliacao`/`selecionarEstrela`/`enviarAvaliacaoObra` rewritten for the 3-criteria flow; notification gate/display updated from `avaliacaoNota` to `avaliacaoCriterios`
- `admin/app.js` — imports `calcularAcumuladoParceiro` from `js/avaliacao.js`; new `renderAvaliacaoParceiro(parceiroId)` function, called from `renderParceiroDetalhe` to render the accumulated-rating card (or empty state)
- `package.json` — `test` script now runs both `js/fechamento.test.js` and `js/avaliacao.test.js`

## Post-Deploy Correction (2026-07-09)
- `cliente/app.js` — `renderDetalheObra`: added a second "Avaliar serviço" access point (or the submitted breakdown) directly on the obra detail screen's header card, gated on `o.status === 'concluida' && !o.avaliacaoCriterios`. **Why**: manual testing (user's colleague, via a real browser session) found that an obra completed before this feature shipped — or one whose `obra_concluida` notification is no longer visible in the feed — had no way at all to be rated, since the notification row was the only entry point. See `functional-design/frontend-components.md` for the corrected flow. `npm test` re-run after the fix: 27/27 passing (no regression).

## Not Touched
- `admin/index.html` — no static markup change needed (the new card is rendered via `innerHTML` from `admin/app.js`, same as the rest of `renderParceiroDetalhe`)
- Existing `avaliacaoNota` values on already-rated obras — left as dead/unread data (Functional Design Q1=A, no migration)

## Tests
- `npm test` — 27/27 passing (15 pre-existing `js/fechamento.test.js` + 12 new `js/avaliacao.test.js`)
- `npm run test:rules` — 6 new tests added to `firestore.rules.test.js`; **not executed in this session** (requires the Firestore emulator, which requires Java — not installed in this environment, same limitation noted during the dev→main merge session). To run: `npm run test:rules` on a machine with Java installed.

## How to Run
```
npm install
npm test              # unit + property-based tests (no Java needed)
npm run test:rules    # firestore.rules tests (requires Java + Firestore emulator)
```
