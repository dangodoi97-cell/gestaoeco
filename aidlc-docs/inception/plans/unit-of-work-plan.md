# Unit of Work Plan

## Execution Checklist
- [ ] Step 1: Confirm the 1 remaining open question below
- [ ] Step 2: Generate `aidlc-docs/inception/application-design/unit-of-work.md`
- [ ] Step 3: Generate `aidlc-docs/inception/application-design/unit-of-work-dependency.md`
- [ ] Step 4: Generate `aidlc-docs/inception/application-design/unit-of-work-story-map.md` (maps requirements → units, since User Stories was skipped)

## Category Assessment (per units-generation.md Step 3 — evaluated, not skipped)

- **Story Grouping**: Already resolved in `execution-plan.md` — Unit 1 = FR-1+FR-2 (client-only, admin panel), Unit 2 = FR-3 + RE findings #1/#2 (new backend). No open question; both units are cohesive by shared architecture (client-only vs. introduces-a-backend) and shared risk profile.
- **Dependencies**: Already resolved in `execution-plan.md`'s Package Change Sequence — Unit 2's rules first, then Unit 2's functions/client code; Unit 1 has no dependency on Unit 2 and can proceed independently. No open question.
- **Team Alignment**: N/A — solo/small-team project (no sub-teams to assign units to).
- **Technical Considerations**: Unit 1 deploys as static files only (existing Netlify flow, unchanged). Unit 2 additionally requires a Firebase Cloud Functions deploy (`firebase deploy --only functions`) and a rules deploy (`firebase deploy --only firestore:rules`) — genuinely new deployment steps for this project. No open question about *whether* this is needed (Application Design already settled the architecture); Infrastructure Design (Unit 2) will produce the exact deploy instructions.
- **Business Domain**: Bounded contexts are clear and don't overlap — Unit 1 is a financial-reporting view, Unit 2 is notifications/security. No open question.
- **Code Organization**: Brownfield (not greenfield) — N/A per units-generation.md Step 2's greenfield-only clause. Unit 2 does introduce the repo's first `functions/` directory with its own `package.json` (the project's first ever) — exact layout is an Infrastructure Design (Unit 2) concern, not a unit-boundary concern.

## Question

### Question 1 — Delivery granularity
Should Unit 1 and Unit 2 be built and delivered as two separate change sets (e.g. two separate commits/PRs, Unit 1 shippable and usable on its own before Unit 2 is ready), or as one combined change set delivered together?

A) Two separate change sets — Unit 1 (Fechamento de Caixa e Cores) can ship and be used as soon as it's done, independent of Unit 2's progress (matches the "no dependency" finding above)
B) One combined change set — hold both until everything is ready, deliver together
X) Other (please describe after [Answer]: tag below)

[Answer]: B
