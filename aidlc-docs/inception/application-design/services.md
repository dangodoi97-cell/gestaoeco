# Services (Unit 2)

This app has no formal "service layer" in the backend sense (it's a client-SDK-direct architecture) — the two logical services below describe *orchestration flows* that span multiple components, not standalone deployable services.

## Service: Notification Delivery
**Orchestrates**: any business event in FR-3.3's event list → in-app record → push delivery → user action.

**Flow**:
1. An existing or new admin/cliente action calls `criarNotificacao(dados)` (`js/data.js`) at the moment of the business event (e.g. admin marks an etapa complete, cliente approves an orçamento).
2. Cloud Functions **NotificationDispatcher** fires on that document's creation, resolves recipient(s) via `resolveRecipients`, fetches their `fcmTokens`, and sends via the FCM Admin SDK (`sendToTokens`).
3. On the recipient's device:
   - **Foreground** (app tab open): the Firebase Messaging SDK delivers to **NotificationClient**'s `onMessage` listener → the calling panel's registered handler shows a toast and/or refreshes its notification list view.
   - **Background** (app not focused/closed): the **Service Worker** receives the push, displays the OS notification, and handles the click.
4. The `notificacoes` document itself remains the durable in-app history — both panels' notification list views (existing `cliente/app.js` one, new **Admin Notifications View**) read from it via `escutarNotificacoes`, independent of whether the push itself was ever seen.

**Failure handling**: if `sendToTokens` reports an invalid token, NotificationDispatcher calls `removerFcmToken` inline before finishing (Q4=A) — no separate retry/dead-letter component for this unit's scope.

## Service: Access Control (cross-cutting, not a call flow)
**Orchestrates**: every read/write any component makes to `usuarios` and `etapas`.

Unlike Notification Delivery, this isn't a sequence of calls — it's the **Firestore Rules — Access Control Layer** component evaluated by Firestore itself on every request, from every other component (client apps, and indirectly the Cloud Function, which runs with Admin SDK privileges and is exempt from these rules by design). Listed here because Application Design's service-layer step (application-design.md Step 3) should make explicit that this "service" is declarative and stateless, not a running process — a common point of confusion when a project's first backend component (NotificationDispatcher) appears alongside a rules change and the two get conflated.
