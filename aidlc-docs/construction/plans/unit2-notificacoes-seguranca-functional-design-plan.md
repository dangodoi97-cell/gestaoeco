# Functional Design Plan — Unit 2: Notificações Push e Correções Críticas de Segurança

## Execution Checklist
- [ ] Step 1: Answer the 3 questions below (1 is the still-deferred User Stories edge case A6)
- [ ] Step 2: Generate `aidlc-docs/construction/unit2-notificacoes-seguranca/functional-design/business-logic-model.md`
- [ ] Step 3: Generate `aidlc-docs/construction/unit2-notificacoes-seguranca/functional-design/business-rules.md`
- [ ] Step 4: Generate `aidlc-docs/construction/unit2-notificacoes-seguranca/functional-design/domain-entities.md`
- [ ] Step 5: Generate `aidlc-docs/construction/unit2-notificacoes-seguranca/functional-design/frontend-components.md`

## Questions

### Question 1 (deferred from User Stories A6) — Notification deep-linking
When a user taps a push notification, what should happen?

A) Deep-link directly into the relevant obra/etapa/cobrança/orçamento the notification is about
B) Just open the app to its default landing page (Obras tab) — user finds the relevant item via the in-app notification list
X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 2 — FCM token removal on logout
Should a device's stored FCM token be removed (via `removerFcmToken`) when the user logs out of that device, so a signed-out browser stops receiving pushes for that account?

A) Yes — remove the token on logout (cleaner; if the same browser logs into a different account later, it won't get the previous account's pushes)
B) No — keep the token; it'll only get cleaned up later if a send to it ever fails (per the inline cleanup already decided in Application Design)
X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 3 — Admin-facing notification recipients
The business may have more than one admin account (existing "Gestão de administradores" capability). For admin-facing events (FR-3.2/FR-3.3 — client submitted a request, decided on an orçamento, registered a payment, rated an obra, responded to a cobrança), should the notification go to:

A) Every admin account, broadcast (simplest — matches Application Design's `resolveRecipients` description: "every uid with tipo:'admin'")
B) Only a specific "owner" admin — this would require adding a new concept (e.g. a primary-admin flag) that doesn't exist in the data model today
X) Other (please describe after [Answer]: tag below)

[Answer]: A
