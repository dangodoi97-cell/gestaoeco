# Logical Components (NFR-Annotated) — Unit 3: Avaliação por Critérios vinculada ao Parceiro

No Application Design stage ran for this unit (Workflow Planning decided SKIP — no new component/service boundary). This document instead annotates the components already named in `functional-design/frontend-components.md` and `domain-entities.md` with the NFR patterns from `nfr-design-patterns.md`.

## Firestore Rules — `obras/{obraId}` update condition
- **NFR patterns applied**: Rules-Layer Existence Guard, Field-Level Type/Range Validation, Accepted-Risk Boundary
- **New logical elements**: one additional existence-guard clause; 4 new range/type checks (3 criteria + Geral); no new helper predicate needed (reuses existing `souClienteAprovado()`/ownership check unchanged)
- **Service account / IAM**: N/A — rules execute inside Firestore itself, same as every other rule in this project

## Client — Rating Submission (`cliente/app.js`)
- **NFR patterns applied**: In-Memory Aggregation (attribution computation)
- **No new listener, no new read**: consumes `window._todasEtapas`, already populated by the existing `escutarTodasEtapas` listener

## Admin — Parceiro Detail Accumulation (`admin/app.js`, `renderAvaliacaoParceiro`)
- **NFR patterns applied**: In-Memory Aggregation (accumulation computation)
- **No new listener, no new read**: consumes `db_obras`, already populated by the existing `escutarObras` listener

## Summary: No New Infrastructure
This unit adds zero new logical components beyond field-level rule predicates and two pure in-memory computation functions on the client/admin sides. No Cloud Function, no queue, no cache, no new service account — the smallest-footprint unit of the three delivered so far (smaller than Unit 1, which at least added a new dedicated `js/fechamento.js` module; this unit's logic lives directly in the two existing app files it touches).
