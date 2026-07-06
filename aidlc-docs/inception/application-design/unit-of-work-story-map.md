# Unit of Work → Requirement Map

**Note**: User Stories was skipped for this work (user override — see aidlc-state.md). This document maps requirements (`aidlc-docs/inception/requirements/requirements.md`) and reverse-engineering findings directly to units instead of stories.

## Unit 1 — Fechamento de Caixa e Cores

| Requirement | Description |
|---|---|
| FR-1.1 | Client-selector dropdown on the admin Obras tab |
| FR-1.2 | Filtered obras list + period financial summary (entrada/repasse/sobra totals) |
| FR-1.3 | "Sem cliente / Outros" bucket for obras with no linked client |
| FR-1.4 | Dropdown populated from existing `usuarios` (tipo:'cliente') data |
| FR-2.1 | Red/blue/green color mapping for repasse/entrada/sobra |
| FR-2.2 | `sobra = entrada − repasse` calculation |
| FR-2.3 | Coloring applied on obra detail screen + Fechamento de Caixa view |

**Deferred edge cases** (to this unit's Functional Design): negative-sobra styling (User Stories question A4), "Sem cliente/Outros" bucket membership for rejected-client obras (A5).

## Unit 2 — Notificações Push e Correções Críticas de Segurança

| Requirement / Finding | Description |
|---|---|
| FR-3.1 | Real push notifications via FCM |
| FR-3.2 | Admin also receives notifications for client-initiated actions |
| FR-3.3 | Expanded notification event set (cobrança, resposta à cobrança, decisão de orçamento) |
| FR-3.4 | Cloud Functions dispatcher (server-side send) |
| FR-3.5 | Existing `notificacoes` feed remains the in-app history/fallback |
| FR-3.6 | FCM device-token storage on `usuarios/{uid}` |
| FR-3.7 | Service worker + fixing the orphaned `manifest.json` |
| RE Finding #1 | Firestore rules fix — block self-promotion to admin |
| RE Finding #2 | Firestore rules fix — scope `etapas` reads to the owning client |

**Deferred edge case** (to this unit's Functional Design): notification deep-linking behavior (User Stories question A6).

## Coverage Check
All FR-1/FR-2/FR-3 sub-items from requirements.md, and both RE Critical findings bundled per the Workflow Planning decision, are assigned to exactly one unit. No unassigned requirements remain.
