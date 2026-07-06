# Unit of Work Dependency Matrix

| From | To | Type | Reason |
|---|---|---|---|
| Unit 1 (Fechamento de Caixa e Cores) | Unit 2 (Notificações + Correções) | None | Unit 1 only reads existing `obras`/`etapas` fields already covered by today's rules; it does not touch `usuarios`, `notificacoes`, or any path Unit 2's rules rewrite affects. Confirmed independent in execution-plan.md's Package Change Sequence. |
| Unit 2 | Unit 1 | None | Unit 2's Cloud Function, rules changes, and notification UI never read/write the `entrada`/`repasse`/`sobra` fields Unit 1 displays. |

**Net result**: no inter-unit dependency exists. The two units could theoretically be built in either order or in parallel — the only sequencing constraint that matters is *within* Unit 2 itself (rules before Cloud Functions/client code, per execution-plan.md), not between Unit 1 and Unit 2.

## Delivery Sequencing (per Question 1 = B)
Despite having no technical dependency, both units are held and delivered together as **one combined change set** — this is a delivery-process decision (the user's preference), not an architectural constraint. Code Generation will produce both units' code, and Build and Test will validate both together, before anything is considered ready to deploy.

## Shared Resources
- **`css/style.css`**: Unit 1 adds a new color token; Unit 2 does not touch this file. No conflict.
- **`admin/app.js`**: both units extend this file (Unit 1 adds the Fechamento de Caixa view/filter; Unit 2 adds the Admin Notifications View and push-registration call). Both additions are additive (new functions/render calls), not modifications of each other's code — Code Generation should sequence these as two independent diffs against the same file rather than a single intertwined change.
- **`js/data.js`**: Unit 1 reads existing exports only (no changes). Unit 2 extends this file (`criarNotificacao`, `escutarNotificacoes`, `salvarFcmToken`, `removerFcmToken`). No conflict.
- **`firestore.rules`**: Unit 2 only. Unit 1 has no rules changes.
