# Build Instructions

## Prerequisites
- **Build Tool**: None for the deployed application — this is a static site with no bundler/transpiler (unchanged since the original reverse-engineering pass). `npm` is used only for local test tooling (never shipped).
- **Dependencies**: Node.js 20+ (test tooling and Cloud Functions runtime), Java 11+ (required by the Firestore emulator used for rules tests only)
- **Environment Variables**: None required to run tests. Deployment requires the real Firebase project's VAPID key pasted into `js/firebase-config.js` (see LEIA-ME.md PASSO 6) — not an env var, a source file edit, consistent with this project's existing config style (`firebaseConfig` is also hard-coded, not env-based).
- **System Requirements**: Any machine that runs Node 20 and Java; no special memory/disk needs at this project's scale.

## Build Steps

### 1. Install Dependencies
```bash
npm install              # root: test tooling (fast-check, firebase, rules-unit-testing, firebase-tools)
cd functions && npm install && cd ..   # Cloud Function runtime deps (firebase-admin, firebase-functions)
```

### 2. Configure Environment
No environment configuration needed to run the test suites below. For an actual deploy (out of scope for this stage — see LEIA-ME.md PASSO 6), the VAPID key, Blaze plan, and a dedicated service account must be set up first.

### 3. "Build" All Units
There is no compilation/bundling step for either unit — both are plain JavaScript, loaded directly by the browser (static site) or by the Cloud Functions runtime (`functions/`). "Build" here means: confirm every JS file parses correctly.
```bash
node --check admin/app.js
node --check cliente/app.js
node --check js/data.js js/auth.js js/firebase-config.js js/notifications.js js/fechamento.js js/avaliacao.js
node --check firebase-messaging-sw.js
node --check functions/index.js functions/notificationDispatcher.js
```

### 4. Verify Build Success
- **Expected Output**: no output at all from every `node --check` command above (silence = success; a `SyntaxError` would print and exit non-zero).
- **Build Artifacts**: none — the source files themselves are the deployable artifacts (static files → Netlify; `functions/` → Firebase CLI).
- **Common Warnings**: none expected.

## Troubleshooting

### `node --check` fails with a SyntaxError
- **Cause**: a typo or mismatched bracket introduced during editing.
- **Solution**: the error message includes the exact file/line — fix and re-run.

### `npm install` fails inside `functions/`
- **Cause**: usually a Node version mismatch (Cloud Functions 2nd gen requires the version pinned in `functions/package.json`'s `engines.node`, currently `20`).
- **Solution**: `nvm use 20` (or equivalent) before installing.
