# Component Methods (Unit 2)

**Note**: Signatures and high-level purpose only. Detailed business rules (exact recipient-resolution logic, deep-link target rules, sobra-adjacent items) are defined in Functional Design.

## Cloud Functions — NotificationDispatcher

### `onNotificacaoCreated(event)`
- **Trigger**: Firestore `onCreate` on `notificacoes/{notifId}`
- **Input**: Firestore document snapshot (`clienteId?`, `destinatarioTipo`, `tipo`, `titulo`, `mensagem`, `obraId?`, ...)
- **Output**: `Promise<void>` (no return value consumed; errors are logged, not retried indefinitely — see NFR Design)
- **Purpose**: Resolve recipient(s), fetch their FCM tokens, send the push, prune invalid tokens.

### `resolveRecipients(notificacao)` *(internal helper)*
- **Input**: the notification document data
- **Output**: `Promise<string[]>` — array of recipient `uid`s
- **Purpose**: If `destinatarioTipo === 'cliente'`, returns `[clienteId]`; if `'admin'`, returns every `uid` with `tipo:'admin'`.

### `sendToTokens(tokens, payload)` *(internal helper)*
- **Input**: `tokens: string[]`, `payload: {title, body, data}`
- **Output**: `Promise<{successCount, invalidTokens: string[]}>`
- **Purpose**: Wraps the FCM Admin SDK's multicast send; identifies which tokens failed due to being unregistered/invalid.

## Client — `js/notifications.js` (new)

### `initNotifications(uid, tipo)`
- **Input**: `uid: string`, `tipo: 'admin'|'cliente'`
- **Output**: `Promise<void>`
- **Purpose**: Registers the service worker, requests notification permission if not already granted/denied, obtains the FCM token, and persists it via `salvarFcmToken`. Called once from each panel's `iniciarApp()` after `observarAuth` resolves.

### `onForegroundMessage(handler)`
- **Input**: `handler: (payload) => void`
- **Output**: `void` (registers a listener; no return value)
- **Purpose**: Subscribes to `onMessage` from the Firebase Messaging SDK for when the tab is focused; `handler` is provided by the calling panel to show a toast and/or refresh the in-app notification list.

### `requestPermissionAndToken()` *(internal helper)*
- **Input**: none
- **Output**: `Promise<string|null>` — the FCM token, or `null` if permission was denied
- **Purpose**: Wraps `Notification.requestPermission()` + `getToken()`.

## Extended — `js/data.js`

### `criarNotificacao(dados)` *(modified signature)*
- **Input**: `dados: {destinatarioTipo: 'admin'|'cliente', clienteId?: string, obraId?: string, tipo: string, titulo: string, mensagem: string}`
- **Output**: `Promise<DocumentReference>`
- **Purpose**: Same role as today, extended to support the admin-facing direction (FR-3.2) — `clienteId` becomes optional/omitted when `destinatarioTipo === 'admin'`.
- **Change from today**: previously implicitly cliente-only; now takes an explicit `destinatarioTipo`.

### `escutarNotificacoes(callback, filtro)` *(modified signature)*
- **Input**: `callback: (notifs) => void`, `filtro: {destinatarioTipo: 'admin'|'cliente', clienteId?: string}`
- **Output**: unsubscribe function (unchanged shape from today)
- **Purpose**: Same real-time listener pattern as today, now parameterized by `destinatarioTipo` so `admin/app.js`'s new notification view (Component: Admin Notifications View) and `cliente/app.js`'s existing one both use the same function.

### `salvarFcmToken(uid, token)`
- **Input**: `uid: string`, `token: string`
- **Output**: `Promise<void>`
- **Purpose**: Adds `token` to `usuarios/{uid}.fcmTokens` (array union, no duplicates).

### `removerFcmToken(uid, token)`
- **Input**: `uid: string`, `token: string`
- **Output**: `Promise<void>`
- **Purpose**: Removes a single token — called by the Cloud Function's inline cleanup (Q4=A) when a send fails, and optionally by the client on logout (to stop receiving pushes on a signed-out device — exact behavior confirmed in Functional Design).

## Admin Notifications View (extension of `admin/app.js`)

### `renderNotificacoesAdmin(lista)`
- **Input**: `lista: NotificacaoDoc[]`
- **Output**: `void` (renders into the DOM)
- **Purpose**: Mirrors `cliente/app.js`'s existing `renderNotificacoes` — reuse the same markup/badge/mark-as-read pattern rather than inventing a new one.

### `marcarNotificacaoLidaAdmin(id)`
- **Input**: `id: string`
- **Output**: `Promise<void>`
- **Purpose**: Thin wrapper calling the existing (unchanged) `marcarNotificacaoLida(id)` from `js/data.js` — no new data-layer method needed here, just wired into the admin UI for the first time.
