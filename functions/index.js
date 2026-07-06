const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const logger = require('firebase-functions/logger');
const { handleNotificacaoCreated } = require('./notificationDispatcher');

initializeApp();

// Dispara em toda notificação criada (admin->cliente ou cliente->admin, ver firestore.rules)
// e envia push via FCM para os tokens registrados do(s) destinatário(s). Sem retry (NFR Requirements Q2=A).
exports.onNotificacaoCreated = onDocumentCreated(
  { document: 'notificacoes/{notifId}', region: 'southamerica-east1' },
  async (event) => {
    if (!event.data) return;
    await handleNotificacaoCreated(event.params.notifId, event.data.data(), {
      db: getFirestore(),
      messaging: getMessaging(),
      arrayRemove: FieldValue.arrayRemove,
      logger
    });
  }
);
