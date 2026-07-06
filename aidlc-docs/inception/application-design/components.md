# Components (Unit 2 — Notificações Push e Correções Críticas de Segurança)

**Scope note**: Unit 1 (Fechamento de Caixa e Cores) introduces no new components — it extends existing rendering/aggregation logic inside `admin/app.js` and is covered directly in that unit's Functional Design, not here.

## Component: Firestore Rules — Access Control Layer
- **Purpose**: Close reverse-engineering findings #1 and #2 at the data layer — the single source of truth for authorization in this Firebase-native architecture.
- **Responsibilities**:
  - Restrict self-writes to `usuarios/{uid}` so a non-admin can never set/change `tipo` or `status` on their own document (finding #1) — only an existing admin (or the Cloud Function acting with admin context, N/A here per Q1=A) may change those fields.
  - Scope `obras/{obraId}/etapas/{etapaId}` reads to admins or the client whose `clienteId` matches the parent obra's `clienteId` (finding #2), via `get(/databases/$(database)/documents/obras/$(obraId))`.
  - Extend existing per-field rules to cover the new `usuarios/{uid}.fcmTokens` field (client may add/remove its own tokens only) and the extended `notificacoes` shape (see Component: NotificationDispatcher below) so admin-facing notification docs are readable only by admins and cliente-facing ones only by the owning client.
- **Interface**: Not application code — a declarative `firestore.rules` policy file, deployed via Firebase CLI. Every other component's Firestore access is implicitly "behind" this layer.
- **Type**: Security/Config (no runtime code).

## Component: Cloud Functions — NotificationDispatcher
- **Purpose**: The project's first server-side component. Firebase Cloud Messaging (FCM) requires the Admin SDK to push to a device that isn't the caller's own — this function is what makes FR-3.1/FR-3.2/FR-3.3 possible at all.
- **Responsibilities**:
  - Trigger on `onCreate` of a `notificacoes` document.
  - Resolve the recipient(s): if `destinatarioTipo === 'cliente'`, the single client named by `clienteId`; if `destinatarioTipo === 'admin'`, every user with `tipo:'admin'` (there may be more than one admin account per the existing "Gestão de administradores" capability).
  - Look up each recipient's `usuarios/{uid}.fcmTokens` array and send a push via the FCM Admin SDK to every token.
  - On a send failure indicating an invalid/expired token (`messaging/registration-token-not-registered` or equivalent), remove that token from the recipient's `fcmTokens` array inline (Q4=A — no separate token-maintenance component).
- **Interface**: Firestore-triggered function, no client-callable surface (nothing outside Firebase invokes it directly).
- **Type**: Application (server-side, Node.js, no build step — Q3=A).

## Component: Client — NotificationClient module (`js/notifications.js`, new)
- **Purpose**: Shared client-side logic for requesting notification permission, registering/refreshing the device's FCM token, and handling incoming messages — used by both `admin/app.js` and `cliente/app.js` (mirrors how both already share `js/auth.js`/`js/data.js`).
- **Responsibilities**:
  - Request browser notification permission (only after login, not on page load, to avoid an unexplained prompt).
  - Obtain the FCM registration token for this browser/device and persist it to `usuarios/{uid}.fcmTokens` (via a new `js/data.js` helper — see component-methods.md).
  - Register the foreground message handler (`onMessage`) for when the app tab is focused, and hand off to the existing in-app toast/notification-list rendering already present in each panel.
  - Expose a single entry point the service worker's notification-click handler calls into (or, more simply, encodes the deep-link target directly in the FCM message's `data` payload — exact mechanics decided in Functional Design per the deferred A6 edge case).
- **Interface**: `initNotifications(uid)`, `onForegroundMessage(handler)` — see component-methods.md for full signatures.
- **Type**: Shared client library (ES module), parallel in role to `js/auth.js`/`js/data.js`.

## Component: Client — Service Worker (`firebase-messaging-sw.js`, new, served from the site root)
- **Purpose**: Required by the Web Push/FCM specification to receive and display notifications when neither app tab has focus.
- **Responsibilities**: Initialize the Firebase Messaging SDK in the service-worker context; display the OS-level notification; handle the notification's `click` event by opening/focusing the appropriate URL (encoded in the message's `data` payload).
- **Interface**: Standard Service Worker lifecycle (`install`, `activate`, `push`/`notificationclick` handlers) — not called directly by any other component; registered once by NotificationClient at app startup.
- **Type**: Client library (browser-managed background script). Also the natural place to finally link `manifest.json` (currently orphaned per reverse-engineering finding #21) since a working push experience and a working installable-PWA experience are delivered together.

## Component: Admin Notifications View (extension of `admin/app.js` + `admin/index.html`)
- **Purpose**: The admin panel currently has no notification list UI at all (only the cliente panel does) — FR-3.2 requires one.
- **Responsibilities**: Render the admin-facing subset of `notificacoes` (`destinatarioTipo === 'admin'`) using the same list/badge/mark-as-read pattern already implemented in `cliente/app.js`'s existing notification view, reused rather than reinvented.
- **Interface**: New `render*()` function(s) following the existing `admin/app.js` convention; no new public interface beyond what the rest of the admin app already does.
- **Type**: Application (UI, existing file extended — not a new file).

## Component: Extended Data Layer (`js/data.js`, extended)
- **Purpose**: Add the minimum new data-access functions FR-3 needs, without duplicating the existing CRUD/listener conventions already documented in `aidlc-docs/inception/reverse-engineering/api-documentation.md`.
- **Responsibilities**: `criarNotificacao` gains a `destinatarioTipo` parameter (and drops the assumption that every notification has exactly one `clienteId` recipient); a new `salvarFcmToken(uid, token)` / `removerFcmToken(uid, token)` pair persists device tokens.
- **Interface**: See component-methods.md.
- **Type**: Shared client library (existing file, extended).
