# End-to-End Test Instructions

## Purpose
Complete user-facing workflows, both units. No browser-automation framework exists in this project (a deliberate decision in both units' Code Generation stages, proportionate to a small static site with no prior test infrastructure) — these are manual test scripts to run against a real deployed instance (or `localhost` via a static file server) before considering either unit done.

## Unit 1: Fechamento de Caixa e Cores

1. Log in as admin, open the **Obras** tab.
2. Confirm the view looks unchanged by default (no client selected) — same obras list as before this unit, including completed obras.
3. Select a client with at least one in-execution obra in the new dropdown.
   - **Expected**: the list narrows to only that client's in-execution obras; 3 colored tiles appear (Entrada = blue, Repasse = red, Sobra = green) with correct totals.
4. Select "Sem cliente / Outros".
   - **Expected**: obras with no linked client, plus any linked to a rejected/pending client, appear together.
5. Select "(Todos)" again.
   - **Expected**: reverts exactly to step 2's default view; summary tiles disappear.
6. Find (or create test data for) an obra where `repasse > entrada`.
   - **Expected**: Sobra tile shows a negative value in green with a "-" sign (per Q1=A — no special styling).

## Unit 2: Notificações Push e Correções Críticas de Segurança

**Prerequisite**: LEIA-ME.md PASSO 6 completed (VAPID key pasted, Cloud Function deployed, Blaze plan active).

### Permission flow
1. Log in as admin (or cliente) for the first time on a given browser.
2. **Expected**: no native browser permission popup appears immediately — instead, the in-app banner ("Ative as notificações...") shows.
3. Click "Ativar".
4. **Expected**: the native browser permission prompt appears now (not before); after granting, the banner disappears and a toast confirms activation.
5. Reload the page.
6. **Expected**: no banner reappears (permission already granted) — silent token registration happens in the background.

### Cliente → Admin notification (5 event types)
For each of: nova solicitação, decisão de orçamento (aprovar/rejeitar), pagamento registrado, resposta a cobrança (pagar/contestar), avaliação de obra —
1. Perform the action as the cliente.
2. **Expected**: within a few seconds, the admin (logged in on a separate device/browser with notifications activated) receives a push notification, and the item appears in the admin's "Atividade dos clientes" list (`page-aprovacao`).
3. Click the push notification (with the admin app backgrounded, not just minimized).
4. **Expected**: the admin app opens/focuses and lands on the correct screen for that event type (e.g. the specific obra for an avaliação, `page-aprovacao` for the others).

### Admin → Cliente notification (existing 6 + 1 new type)
Repeat the equivalent for admin-triggered events (obra criada/concluída, etapa iniciada/concluída, diária registrada, orçamento enviado, **cobrança enviada** — the one new admin→cliente type). Confirm the cliente receives the push and the in-app list, and that the cliente-facing deep-link (`obras` or `financeiro`) opens correctly.

### Foreground vs. background delivery
1. With the admin app **open and focused** in a tab, trigger a cliente-facing event isn't applicable (admin doesn't receive those) — instead, with the **cliente app open and focused**, have the admin complete an etapa.
2. **Expected**: a toast/in-app update appears without any OS-level notification popup (foreground `onMessage` path), and the notification list updates live.
3. Repeat with the cliente app **closed** (not just backgrounded) entirely.
4. **Expected**: an OS-level push notification appears (service worker path); clicking it opens the app to the right screen via the `?linkPagina=&linkId=` URL parameters.

### Logout token cleanup
1. Log out as cliente (or admin).
2. Have the admin trigger an event that would normally notify this now-logged-out account.
3. **Expected**: no push arrives on the logged-out device (token was removed on logout, per Q2=A) — this is hard to verify directly without server-side log access, but at minimum confirm no error is thrown client-side during logout.

## Unit 3: Avaliação por Critérios vinculada ao Parceiro

1. Log in as cliente, on an obra that is `andamento` with at least one `concluido` etapa linked to a parceiro.
2. Have the admin mark the obra as `concluida`.
   - **Expected**: cliente receives the `obra_concluida` notification; the notification row shows a "Avaliar serviço" button.
3. Tap "Avaliar serviço".
   - **Expected**: modal opens showing "Serviço executado por: {nome do parceiro}" and 3 empty star rows (Tempo de execução, Acabamento, Organização e limpeza) — no "Avaliação Geral" preview yet.
4. Rate all 3 criteria (e.g. 5, 4, 5).
   - **Expected**: "Avaliação Geral: 4.7/5" preview appears live as soon as all 3 are filled.
5. Add a comment, tap "Enviar avaliação".
   - **Expected**: toast confirms; modal closes; the notification row now shows the 3 criteria + Geral; the "Avaliar serviço" button never reappears for this obra (reload the page to confirm the gate persists).
6. As admin, open that parceiro's detail screen.
   - **Expected**: new avaliação card shows this obra's exact values for each criterion + Geral, "1 serviço avaliado".
7. Repeat steps 1-5 for a second obra crediting the **same** parceiro, with different star values.
   - **Expected**: the parceiro's detail card now shows the arithmetic mean of both obras' values, "2 serviços avaliados" — not the individual obra's last values.
8. Find (or create test data for) an obra with **no** parceiro linked to any concluded etapa.
   - **Expected**: rating modal opens without a parceiro name line; submission still succeeds; that obra never appears in any parceiro's accumulated count.
9. Find (or create test data for) an obra with **2 distinct parceiros** across its concluded etapas.
   - **Expected**: the rating modal lists both names (e.g. "Serviço executado por: Benedito, José"); after submission, **both** parceiros' detail screens show this obra counted in full (not split/averaged down).
10. Attempt to bypass the UI (e.g. via devtools, calling `enviarAvaliacao` again on an already-rated obra, or writing `avaliacaoNota` directly).
    - **Expected**: rejected by `firestore.rules` (see security-test-instructions.md §4) — confirms the one-shot guard and field removal are enforced server-side, not just hidden in the UI.

## Reporting
Record pass/fail for each numbered step in this file (or a copy) when actually executed against a live deployment — this document defines the script; actual execution requires a deployed Firebase project with real devices/browsers, which is outside what this session can perform directly.
