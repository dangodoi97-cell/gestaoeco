// Service worker de notificações push (FCM) — servido na raiz do site para que seu escopo
// ('/') cubra tanto /admin/ quanto /cliente/ (ver infrastructure-design.md).
// Service workers não suportam ES modules com import estático do jeito usado no resto do
// app, por isso aqui usamos o SDK "compat" via importScripts, conforme padrão documentado
// pelo próprio Firebase para este arquivo específico.
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAB6sSRSNx1qloE5ZtpVeTyU9hBSspIWfU',
  authDomain: 'gestaoecosytem.firebaseapp.com',
  projectId: 'gestaoecosytem',
  storageBucket: 'gestaoecosytem.firebasestorage.app',
  messagingSenderId: '1052037841825',
  appId: '1:1052037841825:web:3a6c13384020722c9841e0'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  const titulo = (payload.notification && payload.notification.title) || 'Nova notificação';
  const corpo = (payload.notification && payload.notification.body) || '';
  self.registration.showNotification(titulo, { body: corpo, data });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const panel = data.panel === 'admin' ? 'admin' : 'cliente';
  const params = new URLSearchParams({ linkPagina: data.linkPagina || '', linkId: data.linkId || '' });
  const url = `/${panel}/index.html?${params.toString()}`;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      const existente = janelas.find((c) => c.url.includes(`/${panel}/`));
      if (existente) {
        // App já aberto: manda a própria página tratar o deep-link sem recarregar
        // (ver handleNotificationOpen em js/notifications.js, escutado via 'message').
        existente.postMessage({ type: 'notification-click', data });
        return existente.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
