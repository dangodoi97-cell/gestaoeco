# Technology Stack

## Programming Languages
- JavaScript (ES2020+ modules, no transpilation) - N/A version - Client-side app logic (all of `admin/app.js`, `cliente/app.js`, `js/*.js`)
- HTML5 - N/A - Page structure and inline `<script type="module">` bootstrapping
- CSS3 (custom properties, `prefers-color-scheme` media query) - N/A - Styling (`css/style.css`, plus small `<style>` blocks inline in each HTML entry point)

## Frameworks
- None. No UI framework (no React/Vue/Angular/etc.), no CSS framework, no state-management library. All DOM rendering is manual `innerHTML` templating.

## Infrastructure
- Firebase Authentication - Email/password auth, Google OAuth popup sign-in, password reset
- Cloud Firestore - Primary data store (documents/collections/subcollections, real-time listeners)
- Firebase Storage - Photo storage (uploaded as base64 data URLs)
- Netlify (recommended, per `LEIA-ME.md`) - Static file hosting for deployment; not embedded in the codebase

## Build Tools
- None - N/A - No bundler, no package manager, no build script. Firebase SDK and the icon font are both loaded directly from CDNs at runtime.

## Testing Tools
- None - N/A - No test framework, no test files, no CI configuration found in the repository.
