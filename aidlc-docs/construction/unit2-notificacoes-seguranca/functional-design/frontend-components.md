# Frontend Components — Unit 2: Notificações Push e Correções Críticas de Segurança

Builds on Application Design's `components.md`/`component-methods.md` — this document adds the concrete interaction flows and wiring those left to Functional Design.

## Permission Prompt Flow
1. Triggered once, right after `observarAuth`'s callback confirms a valid session (same point both panels already call `iniciarApp()`), not on page load — avoids an unexplained browser permission popup before the user has even seen the app.
2. If `Notification.permission === 'default'` (never asked), show a small in-app explanatory banner/toast first (Portuguese, e.g. "Ative as notificações para saber quando sua obra tiver uma atualização" for cliente / "Ative as notificações para saber quando um cliente enviar uma solicitação ou pagamento" for admin) with an "Ativar" button — only calling the browser's native permission dialog on that explicit click, not automatically.
3. If already `'granted'`: silently call `requestPermissionAndToken()` → `salvarFcmToken` (idempotent, no UI needed).
4. If already `'denied'`: skip silently — no repeated nagging. The existing in-app notification list (unchanged) remains fully functional regardless.

## Admin Panel Changes
- **New notification list view** (Component: Admin Notifications View, per Application Design): added as a new section/page reusing the existing bottom-nav + `.page` pattern. Placement decision: reuse the existing "Notificações" nav item that today shows solicitações/orçamentos/contestações (`page-aprovacao`) — admin-facing push-backed notifications (the 5 new event types) are rendered as an additional list within that same existing page, above or below the existing solicitações/contestações sections, rather than adding a brand-new nav item. This keeps the admin's "things needing my attention" surface unified instead of fragmenting it across two nav destinations.
- Each rendered notification item is clickable, calling `handleNotificationOpen({linkPagina, linkId})` (business-logic-model.md A3) directly — same function used for push-open, so in-app-click and push-click behave identically.
- 5 new call sites for `criarNotificacao({destinatarioTipo:'admin', ...})` are added, but **in `cliente/app.js`** (the client is the actor for all 5 new admin-facing events) — see Cliente Panel Changes below. No new admin-side write logic beyond rendering.

## Cliente Panel Changes
- Calls `initNotifications(uid, 'cliente')` after login (unchanged call site pattern from Application Design).
- 5 new `criarNotificacao` call sites, added at the exact point each existing client action already completes its primary write:
  1. `salvarSolicitacao` (new solicitação submit) → also creates `solicitacao_criada` notification
  2. Orçamento approve/reject handler → also creates `orcamento_decidido` notification
  3. `registrarPagamentoCliente` handler → also creates `pagamento_cliente_registrado` notification
  4. Cobrança pay/contest response handler → also creates `cobranca_respondida` notification
  5. Avaliação submit handler (`enviarAvaliacao` call site) → also creates `avaliacao_registrada` notification
- Existing cliente-facing notification list (unchanged rendering) gains one behavior: clicking an item now also calls `handleNotificationOpen` (previously these items likely had no click-through, or a weaker one — this unit makes it consistent with the admin side and with push-open).
- Cliente panel also needs the `cobranca_enviada` deep-link target (`financeiro` page) to support opening a specific cobrança by `linkId` — `abrirCobranca(id)` is a thin wrapper that calls `goPage('financeiro')` then scrolls to/opens the matching cobrança card (reuses existing financeiro rendering, no new data fetch).

## Service Worker Interaction
- `firebase-messaging-sw.js`'s `notificationclick` handler reads `event.notification.data` (the FCM Push Payload shape from domain-entities.md), builds the URL `/{panel}/index.html?linkPagina={linkPagina}&linkId={linkId}`, and either focuses an already-open matching client window (`clients.matchAll` + `focus()`) or opens a new one (`clients.openWindow`) — standard Web Push pattern, avoids duplicate tabs when the app is already open in the background.
- On load, both `admin/app.js` and `cliente/app.js` check `new URLSearchParams(location.search)` for `linkPagina`/`linkId` once `iniciarApp()`'s initial data listeners have fired at least once (so the target obra/solicitação/etc. is actually in memory to open), call `handleNotificationOpen`, then `history.replaceState(null, '', location.pathname)` to clear the query string.

## Logout Flow Change (Q2=A)
- `window.sairConta` (both panels, currently just `await logout(); window.location.href = ...`) is extended to call `removerFcmToken(uid, currentToken)` before `logout()` — requires NotificationClient to expose the currently-registered token (cached in module state from `initNotifications`, not re-fetched).
