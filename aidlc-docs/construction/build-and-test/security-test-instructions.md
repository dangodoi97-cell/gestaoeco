# Security Test Instructions

## Purpose
Directly verify the 2 Critical reverse-engineering findings are closed, and check for new issues introduced by this work (dependency vulnerabilities, the new client-writable notification surface).

## 1. Automated: Firestore Rules Tests (primary security test suite)

### Run
```bash
npm run test:rules
```

### What It Covers (12 tests, all passing — run live against the real Firestore emulator, not mocked)
- **Finding #1 (self-promotion to admin)**: a non-admin cannot self-write `tipo:'admin'`/`status:'aprovado'` via `update` or `create`; normal self-registration (cliente/pendente) still works; an existing admin can still create another admin's profile (via the fixed `cadastrarAdmin` flow) without ever self-elevating.
- **Finding #2 (cross-tenant etapas leak)**: a client cannot read another client's obra's etapas; a client can read their own; an admin can read any.
- **New notification write surface**: a client can create an admin-facing notification only with an allowed `tipo`, `lida:false`, and no `clienteId` — any deviation is rejected.

### Expected Results
12/12 passing. **Do not deploy `firestore.rules` if any of these fail** — that would mean the fix doesn't actually close the finding it claims to.

## 2. Manual: Post-Deploy Attack Verification (repeat after every `firebase deploy --only firestore:rules`)

Run these from a **non-admin browser session** using devtools, exactly reproducing the original reverse-engineering attack steps — this is the same verification the deploy sequence in `infrastructure-design/deployment-architecture.md` already calls for at Step 1:

1. Log in as a non-admin (approved) client.
2. Open devtools console, run:
   ```js
   import { doc, updateDoc } from './js/firebase-config.js';
   updateDoc(doc(db, 'usuarios', auth.currentUser.uid), { tipo: 'admin', status: 'aprovado' });
   ```
   **Expected**: rejected with a `permission-denied` error. If this succeeds, **stop and roll back the rules deploy immediately** (see deployment-architecture.md's Rollback section).
3. As the same client, attempt to read another client's obra's etapas (requires knowing/guessing another `obraId` — use one from your own test data):
   ```js
   import { collection, getDocs } from './js/firebase-config.js';
   getDocs(collection(db, 'obras', '<outra-obra-id>', 'etapas'));
   ```
   **Expected**: rejected with `permission-denied`.
4. Confirm the **positive** cases still work: log in as admin and confirm you can still approve/reject clients, promote a client to admin, and create a new admin account end-to-end (this exercises the fixed `cadastrarAdmin` for real, beyond what the emulator test can simulate — the emulator test verifies the *rule*, this manual step verifies the *whole client-side flow including the secondary Firebase App instance*).

## 3. Dependency Vulnerability Check (SECURITY-10)
```bash
npm audit --omit=dev          # root: 0 vulnerabilities (verified during Code Generation)
(cd functions && npm audit)   # functions/: 8 moderate, transitive via firebase-admin — documented in code/summary.md, not force-fixed
```
Re-run before every deploy; if `firebase-admin` ships an update resolving the transitive `retry-request`/`teeny-request` advisories, take it via a normal `npm update` rather than `--force`.

## 4. Storage Rules — Explicitly Out of Scope, Not Re-Tested
`storage.rules` was **not** modified by this work (Workflow Planning bundled only findings #1 and #2, both Firestore-only). The broader Storage findings from reverse-engineering (overly-permissive `logado()`-only rule; missing rules for non-`obras` upload paths) remain open — do not assume this Build and Test stage covers them.
