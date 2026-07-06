# NFR Design Plan — Unit 2: Notificações Push e Correções Críticas de Segurança

## Category Evaluation (per nfr-design.md Step 3 — all evaluated, none skipped)

- **Resilience Patterns**: Fully settled by NFR Requirements (Q2=A no-retry, try/catch + fail-closed logging, inline token cleanup). No new question — these translate directly into the **Fail-Fast Dispatch** pattern documented below.
- **Scalability Patterns**: N/A — no scaling mechanism beyond Firebase's default autoscaling; nothing to design.
- **Performance Patterns**: N/A — no optimization strategy needed at this app's volume; nothing to design.
- **Security Patterns**: This is the substantive part of this stage — translating business-rules.md's field-level rules into named authorization patterns (guard predicates, object-level ownership checks) that Infrastructure Design will then express as literal `firestore.rules` syntax. No new question — the substance was already fully decided in Functional Design/NFR Requirements; this stage's job is to name and structure it as a reusable pattern, not decide new tradeoffs.
- **Logical Components**: Queues, caches, circuit breakers — **all N/A**. A single Firestore-triggered function with no retry, no repeated-call-per-invocation behavior, and no throughput high enough to need buffering has no use for any of these. Rate limiting was already explicitly declined (NFR Requirements Q3=A).

## Conclusion
No open questions remain for this stage — every category was evaluated and either has an explicit prior decision to carry forward, or is genuinely N/A for a unit this size. Proceeding directly to generate `nfr-design-patterns.md` and `logical-components.md`.
