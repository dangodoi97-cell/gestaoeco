# Component Inventory

## Application Packages
- `index.html` + `pendente.html` — Login / registration / role-based redirect shell
- `admin/` (`index.html` + `app.js`) — Admin back-office panel
- `cliente/` (`index.html` + `app.js`) — Client-facing companion panel

## Infrastructure Packages
- None (no CDK/Terraform/CloudFormation). Firebase project configuration is managed manually through the Firebase console per `LEIA-ME.md`, and security rules are checked into the repo as plain rule files (`firestore.rules`, `storage.rules`) rather than IaC.

## Shared Packages
- `js/firebase-config.js` — Firebase SDK initialization/re-export (Client library)
- `js/auth.js` — Authentication helpers, incl. Google sign-in (Client library)
- `js/data.js` — Firestore/Storage data-access layer (Client library)
- `css/style.css` — Shared stylesheet (Static asset)
- `manifest.json` — PWA manifest, currently orphaned/unlinked (Static asset)

## Test Packages
- None found. No test files, test framework, or CI configuration exist in the repository.

## Total Count
- **Total Packages**: 8 (3 application surfaces + 5 shared/static files, counting each as one logical unit)
- **Application**: 3
- **Infrastructure**: 0
- **Shared**: 5
- **Test**: 0
