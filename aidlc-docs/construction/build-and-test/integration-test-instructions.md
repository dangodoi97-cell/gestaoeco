# Integration Test Instructions

## Purpose
Both units share files (`admin/app.js`, `admin/index.html`, `js/data.js`) despite having no functional dependency on each other (confirmed in `unit-of-work-dependency.md`). These tests confirm the two units' additions coexist correctly in those shared files, and that Unit 2's rules changes don't regress Unit 1's admin-side data access.

## Test Scenarios

### Scenario 1: No DOM id / function-name collisions in shared files
- **Description**: Unit 1 (`fechamento-*` ids/functions) and Unit 2 (`notificacoes-admin`/`banner-notificacoes` ids, `ativarNotificacoesAdmin`/etc. functions) were both added to `admin/app.js`/`admin/index.html`.
- **Verified during this stage**: `grep`-based duplicate-id scan across all 4 HTML entry points — 0 real duplicates (an initial false-positive from a naive regex matching `data-testid="..."` was caught and re-verified with a stricter pattern; see audit.md).
- **Expected Results**: exactly one element per id; no `querySelector`/`getElementById` call in either unit's code silently grabs the wrong element.

### Scenario 2: Admin's Fechamento de Caixa view is unaffected by Unit 2's `etapas` rules fix
- **Description**: Unit 1's `renderFechamentoResumo`/`filtrarObras` read `db_obras`/`window._todasEtapas`, populated by `escutarObras`/`escutarTodasEtapas` running under the **admin's own session**.
- **Setup**: none beyond a normal admin login.
- **Test Steps**: as admin, open the Obras tab, select a client in the Fechamento de Caixa filter.
- **Expected Results**: the filtered list and Entrada/Repasse/Sobra tiles populate exactly as before Unit 2's rules changes — `souAdmin()` grants unconditional etapas read, so the new `souProprietarioObra()` predicate (which only gates the *client* read path) never applies to the admin's own reads. No regression possible by construction, but worth confirming visually once deployed.
- **Cleanup**: none.

### Scenario 3: A notification's deep-link target matches what Unit 1's obra detail shows
- **Description**: `obra_criada`/`obra_concluida`/`etapa_*`/`diaria_registrada` notifications carry `linkPagina:'obras', linkId: obraId` — the same `obraId` Unit 1's Fechamento de Caixa view groups by.
- **Test Steps**: as admin, complete an etapa on an obra linked to a client → a `notificacoes` doc is created with that obra's id → (once deployed) tapping the resulting notification opens that exact obra via `abrirObra(obraId)`.
- **Expected Results**: the opened obra matches the one the action was performed on; no cross-unit id mismatch.

### Scenario 4: `js/data.js` changes are additive, not breaking, for Unit 1's read paths
- **Description**: Unit 2 extended `criarNotificacao`/`escutarNotificacoes` and added `salvarFcmToken`/`removerFcmToken`. Unit 1 doesn't call any of these.
- **Verified during this stage**: `node --check js/data.js` passes; `npm test` (Unit 1's suite, which imports nothing from the notification-related exports) still passes 13/13 after Unit 2's edits to the same file.

## Setup Integration Test Environment
No separate integration environment is needed — both units run against the same static-file + Firebase project setup. For rules-related integration checks, use the Firestore emulator (`npm run test:rules`), which already exercises both units' data model assumptions together (Unit 1's `obras`/`etapas` reads, Unit 2's `usuarios`/`notificacoes` rules) in one rules file.

## Run Integration Tests
```bash
npm test && (cd functions && npm test) && npm run test:rules
```
All 3 commands were run together during this stage — see build-and-test-summary.md for the consolidated result.

## Cleanup
`npm run test:rules` starts and stops its own emulator per run (`firebase emulators:exec`) — no manual cleanup needed. Debug logs (`firestore-debug.log`, etc.) are git-ignored and safe to delete locally.
