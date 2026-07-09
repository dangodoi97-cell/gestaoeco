# NFR Design Plan — Unit 3: Avaliação por Critérios vinculada ao Parceiro

## Category Evaluation (per nfr-design.md Step 3 — all evaluated, none skipped)

- **Resilience Patterns**: Fully settled by NFR Requirements — write failures follow the existing toast-and-retry-via-button-still-visible pattern (no new resilience mechanism to design; single atomic document write, no partial-state risk). No new question.
- **Scalability Patterns**: N/A — no scaling mechanism beyond Firebase's default autoscaling; no new component.
- **Performance Patterns**: Fully settled by NFR Requirements — in-memory computation from already-loaded `db_obras`/`window._todasEtapas`, no new listeners. No new question — this stage just names the pattern.
- **Security Patterns**: The substantive part of this stage — translating NFR Requirements' 2 decisions (rules-layer one-shot guard; input range/type validation; explicitly declined attribution cross-check) into named, reusable rule predicates for Infrastructure Design to express as literal `firestore.rules` syntax. No new question — substance already decided.
- **Logical Components**: Queues, caches, circuit breakers, rate limiters — **all N/A**, same rationale as Unit 2 (no backend component at all in this unit, let alone one with repeated-call or high-throughput behavior).

## Conclusion
No open questions remain — proceeding directly to generate `nfr-design-patterns.md` and `logical-components.md`.
