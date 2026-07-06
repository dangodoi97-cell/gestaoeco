# NFR Design Patterns — Unit 2: Notificações Push e Correções Críticas de Segurança

## Pattern: Fail-Fast Dispatch (Resilience)
**Applies to**: `NotificationDispatcher`
**Shape**: Every external call (Firestore read, FCM Admin SDK send) is wrapped in try/catch. On failure, log via `firebase-functions/logger` (structured: event type, notifId, error) and return normally — never rethrow, since trigger retries are disabled (NFR Requirements Q2=A). This is deliberately simpler than a true circuit-breaker (no repeated-attempt state to track): one invocation, one attempt per recipient token, fail closed and move on.
**Why**: matches SECURITY-15 (fail-safe defaults) without over-engineering resilience infrastructure this app's volume doesn't need.

## Pattern: Authorization Guard Predicates (Security)
**Applies to**: `firestore.rules` (exact syntax in Infrastructure Design)
**Shape**: Named boolean predicates, extending the existing `logado()`/`souAdmin()`/`souClienteAprovado()` helpers already in `firestore.rules` (per reverse-engineering) with one new one:
- `souProprietarioObra(obraId)` — true if the requesting client's uid equals `get(/databases/$(database)/documents/obras/$(obraId)).data.clienteId`. This single predicate is the fix for finding #2 (`etapas` read) and is written once, reused everywhere ownership scoping is needed.
**Why**: keeps the rules file's existing readable-helper-function style (a documented Good Pattern from reverse-engineering) rather than inlining a `get()` call at every rule site.

## Pattern: Field-Scoped Self-Write (Security)
**Applies to**: `usuarios/{uid}` rules (finding #1 fix)
**Shape**: Two-tier write rule — (1) a self-write tier permitting only a fixed allowlist of fields (`nome`, `telefone`, `fcmTokens`) via `request.resource.data.diff(resource.data).affectedKeys().hasOnly([...])`, and (2) an admin tier (`souAdmin()`) with no field restriction. The two tiers are combined with `allow update: if <tier 1> || <tier 2>` — either condition alone is sufficient, and a non-admin can never satisfy tier 2, closing the gap regardless of what they attempt in tier 1.
**Why**: this is the same field-scoping style already used elsewhere in the existing rules (e.g. `etapas`'s `aprovacao`/`pagamento`/`nota` client-update scoping, per reverse-engineering) — consistent with the codebase's existing (if inconsistently applied) authorization idiom.

## Pattern: Narrow Client-Write Allowlist (Security)
**Applies to**: `notificacoes` create rule (the new client-writable admin-facing surface)
**Shape**: A client's create is permitted only when the written document's `destinatarioTipo == 'admin'`, `tipo` is one of the 5 fixed allowed values, `lida == false`, and `clienteId` is absent — enumerated exactly as business-rules.md specifies, not a general-purpose "any authenticated write" rule.
**Why**: the accepted risk (NFR Requirements Q3=A) is bounded specifically because the rule enumerates an allowlist rather than granting broad create access.

## N/A Categories (with rationale, per nfr-design.md's "do not skip" mandate)
- **Scalability Patterns**: N/A — Firebase-managed autoscaling is the entire scaling story; no custom pattern to design.
- **Performance Patterns**: N/A — no latency/throughput target exists to design against (NFR Requirements).
- **Logical Components — Queue**: N/A — a single Firestore trigger with no batching/buffering need.
- **Logical Components — Cache**: N/A — every read in this unit (`usuarios.fcmTokens`, `usuarios` role checks) is already a single-document lookup with no repeated-read hot path to cache.
- **Logical Components — Circuit Breaker**: N/A — see Fail-Fast Dispatch above; no repeated-call state exists within one invocation to protect.
- **Logical Components — Rate Limiter**: N/A — explicitly declined in NFR Requirements (Q3=A), documented there as an accepted risk, not redesigned here.
