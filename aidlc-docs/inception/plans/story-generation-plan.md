# User Story Generation Plan

**Role**: Product Owner
**Source**: `aidlc-docs/inception/requirements/requirements.md` (FR-1, FR-2, FR-3)

## Execution Checklist

- [ ] Step A: Confirm personas (reuse existing Admin/Cliente, or add new ones)
- [ ] Step B: Confirm story breakdown approach
- [ ] Step C: Confirm acceptance criteria format/detail level
- [ ] Step D: Resolve open edge cases (negative sobra, "Outros" bucket membership, notification deep-linking)
- [ ] Step E: Resolve the carried-over open item (security-fix bundling) from Requirements Analysis
- [ ] Step F: Generate `aidlc-docs/inception/user-stories/personas.md`
- [ ] Step G: Generate `aidlc-docs/inception/user-stories/stories.md` (INVEST-compliant, with acceptance criteria, mapped to personas)

## Story Breakdown Approach — Options

- **User Journey-Based**: Stories follow an end-to-end flow (e.g. "admin closes the cash register for a client at month-end"). Best for showing sequence, weaker at isolating independently-shippable pieces.
- **Feature-Based**: Stories organized around FR-1 / FR-2 / FR-3 directly, mirroring the requirements doc. Best for traceability back to requirements; slightly weaker at surfacing cross-feature persona flows.
- **Persona-Based**: Stories grouped by "As an Admin..." vs "As a Cliente...". Best for FR-3's bidirectional notification flows; weaker for FR-1/FR-2 which are admin-only.
- **Hybrid (recommended)**: Group by feature (FR-1, FR-2, FR-3) as epics, but within FR-3 split stories by persona (admin-facing vs cliente-facing notification stories), since that feature is the one with real cross-persona behavior. FR-1/FR-2 stay single-persona (Admin) throughout.

## Questions

### Question A1 — Personas
The system already has two real user types: **Admin** (contractor/business owner) and **Cliente** (approved customer). Do we need any additional persona for these stories, or are these two sufficient?

A) These two personas are sufficient — no new persona needed
B) Add a distinct "Cliente pendente" persona (different from approved Cliente) since FR-3 could theoretically also need pending-client behavior
C) Other (please describe after [Answer]: tag below)

[Answer]: 

### Question A2 — Story breakdown approach
Which breakdown approach should be used? (see descriptions above)

A) Hybrid (recommended): epics by feature (FR-1/FR-2/FR-3), with FR-3 stories split by persona
B) Pure Feature-Based: one flat list of stories per FR, no persona split even within FR-3
C) Pure Persona-Based: two top-level groups (Admin stories, Cliente stories), features interleaved within each
D) Other (please describe after [Answer]: tag below)

[Answer]: 

### Question A3 — Acceptance criteria format
What level of detail / format should acceptance criteria use?

A) Given/When/Then (Gherkin-style) — more rigorous, useful if these will later back automated tests
B) Simple checklist of pass/fail conditions per story — faster to read/write, less formal
C) Other (please describe after [Answer]: tag below)

[Answer]: 

### Question A4 — Negative sobra edge case
Requirements FR-2.2 defines `sobra = entrada − repasse`. What should happen when `repasse > entrada` (i.e. sobra is negative — the contractor has paid out more to partners than the client has paid in so far)?

A) Still show it in green with a "-" sign — no special treatment, sobra is just a signed number
B) Show negative sobra in a 4th color (e.g. keep the red/blue/green mapping for positive values, but negative sobra renders in a distinct "alert" style) — please specify the color/style after [Answer]
C) This should never realistically happen given how obras are billed, so no special UI is needed — just don't let it look broken (default number formatting is fine)
X) Other (please describe after [Answer]: tag below)

[Answer]: 

### Question A5 — "Sem cliente/Outros" bucket membership
FR-1.3 groups obras with empty `clienteId` under "Sem cliente/Outros". Should this bucket also include obras whose linked client exists but has `status:'rejeitado'` (rejected)?

A) Yes — treat rejected-client obras the same as no-client obras in this filter (they show under "Outros")
B) No — only obras with a truly empty `clienteId` go under "Outros"; an obra linked to a rejected client still filters under that (former) client's name
C) Other (please describe after [Answer]: tag below)

[Answer]: 

### Question A6 — Notification deep-linking
When a user taps a push notification (FR-3.1), what should happen?

A) Deep-link directly into the relevant obra/etapa/cobrança/orçamento the notification is about
B) Just open the app to its default landing page (Obras tab for admin, Obras tab for cliente) — user finds the relevant item themselves via the in-app notification list (FR-3.5)
C) Other (please describe after [Answer]: tag below)

[Answer]: 

### Question A7 — Carried-over open item: bundling the 2 Critical security fixes
From Requirements Analysis: should the reverse-engineering's Critical findings #1 (any user can self-promote to admin) and #2 (cross-tenant `etapas` read leak) be fixed as part of the same unit of work that introduces Cloud Functions for FR-3, or handled as separate, later work?

A) Yes — bundle both fixes into the Cloud Functions unit now (it's the same underlying architecture change: moving privileged writes/authorization checks server-side)
B) No — keep this unit scoped strictly to FR-1/FR-2/FR-3; the 2 security fixes should be planned as separate follow-up work after this
C) Other (please describe after [Answer]: tag below)

[Answer]: 
