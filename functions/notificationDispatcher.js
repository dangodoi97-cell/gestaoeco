// Lógica pura do disparo de notificações push — sem dependência direta do firebase-admin,
// tudo (db, messaging, arrayRemove, logger) é recebido por injeção para permitir teste sem emulador.
// Padrão "Fail-Fast Dispatch": uma tentativa por destinatário, loga e segue em caso de erro,
// nunca relança (o trigger do Firestore está configurado sem retry).

const ADMIN_EVENT_TYPES = [
  'solicitacao_criada',
  'orcamento_decidido',
  'pagamento_cliente_registrado',
  'cobranca_respondida',
  'avaliacao_registrada'
];

async function resolveRecipients(notificacao, db) {
  if (notificacao.destinatarioTipo === 'cliente') {
    return notificacao.clienteId ? [notificacao.clienteId] : [];
  }
  if (notificacao.destinatarioTipo === 'admin') {
    const snap = await db.collection('usuarios').where('tipo', '==', 'admin').get();
    return snap.docs.map(d => d.id);
  }
  return [];
}

function buildPushPayload(notifId, notificacao) {
  const panel = notificacao.destinatarioTipo === 'admin' ? 'admin' : 'cliente';
  return {
    notification: {
      title: notificacao.titulo || 'Nova notificação',
      body: notificacao.mensagem || ''
    },
    data: {
      panel,
      linkPagina: notificacao.linkPagina || '',
      linkId: notificacao.linkId || '',
      notifId
    }
  };
}

function isInvalidTokenError(error) {
  const code = error && error.code;
  return code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token';
}

async function sendToTokens(tokens, notification, data, messaging) {
  if (!tokens.length) return { successCount: 0, invalidTokens: [] };
  const response = await messaging.sendEachForMulticast({ tokens, notification, data });
  const invalidTokens = [];
  response.responses.forEach((r, i) => {
    if (!r.success && isInvalidTokenError(r.error)) invalidTokens.push(tokens[i]);
  });
  return { successCount: response.successCount, invalidTokens };
}

async function dispatchToRecipient(uid, payload, db, messaging, arrayRemove) {
  const userSnap = await db.collection('usuarios').doc(uid).get();
  const tokens = (userSnap.exists && userSnap.data().fcmTokens) || [];
  if (!tokens.length) return;
  const { invalidTokens } = await sendToTokens(tokens, payload.notification, payload.data, messaging);
  if (invalidTokens.length) {
    await db.collection('usuarios').doc(uid).update({ fcmTokens: arrayRemove(...invalidTokens) });
  }
}

async function handleNotificacaoCreated(notifId, notificacao, deps) {
  const { db, messaging, arrayRemove, logger = console } = deps;
  try {
    const recipients = await resolveRecipients(notificacao, db);
    if (!recipients.length) return;
    const payload = buildPushPayload(notifId, notificacao);
    for (const uid of recipients) {
      try {
        await dispatchToRecipient(uid, payload, db, messaging, arrayRemove);
      } catch (err) {
        logger.error('notificationDispatcher: falha ao processar destinatario', uid, notifId, err.message);
      }
    }
  } catch (err) {
    logger.error('notificationDispatcher: falha no dispatch', notifId, err.message);
  }
}

module.exports = {
  ADMIN_EVENT_TYPES,
  resolveRecipients,
  buildPushPayload,
  isInvalidTokenError,
  sendToTokens,
  dispatchToRecipient,
  handleNotificacaoCreated
};
