const test = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveRecipients, buildPushPayload, isInvalidTokenError, sendToTokens, handleNotificacaoCreated
} = require('./notificationDispatcher');

function fakeDb(usuarios) {
  return {
    collection(name) {
      assert.equal(name, 'usuarios');
      return {
        where(field, op, value) {
          return {
            async get() {
              const docs = Object.entries(usuarios)
                .filter(([, u]) => u[field] === value)
                .map(([id, u]) => ({ id, data: () => u }));
              return { docs };
            }
          };
        },
        doc(id) {
          return {
            async get() {
              const u = usuarios[id];
              return { exists: !!u, data: () => u };
            },
            async update(changes) { Object.assign(usuarios[id], changes); }
          };
        }
      };
    }
  };
}

test('resolveRecipients: destinatarioTipo cliente retorna só o clienteId', async () => {
  const recipients = await resolveRecipients({ destinatarioTipo: 'cliente', clienteId: 'c1' }, fakeDb({}));
  assert.deepEqual(recipients, ['c1']);
});

test('resolveRecipients: cliente sem clienteId retorna vazio', async () => {
  const recipients = await resolveRecipients({ destinatarioTipo: 'cliente' }, fakeDb({}));
  assert.deepEqual(recipients, []);
});

test('resolveRecipients: destinatarioTipo admin retorna todos os admins (broadcast, Q3=A)', async () => {
  const db = fakeDb({ a1: { tipo: 'admin' }, a2: { tipo: 'admin' }, c1: { tipo: 'cliente' } });
  const recipients = await resolveRecipients({ destinatarioTipo: 'admin' }, db);
  assert.deepEqual(recipients.sort(), ['a1', 'a2']);
});

test('buildPushPayload: monta payload com panel derivado do destinatarioTipo e copia linkPagina/linkId', () => {
  const payload = buildPushPayload('n1', {
    destinatarioTipo: 'admin', titulo: 'Nova solicitação', mensagem: 'texto',
    linkPagina: 'solicitacoes', linkId: 's1'
  });
  assert.equal(payload.notification.title, 'Nova solicitação');
  assert.equal(payload.data.panel, 'admin');
  assert.equal(payload.data.linkPagina, 'solicitacoes');
  assert.equal(payload.data.linkId, 's1');
  assert.equal(payload.data.notifId, 'n1');
});

test('isInvalidTokenError: reconhece os 2 códigos de token inválido do FCM', () => {
  assert.equal(isInvalidTokenError({ code: 'messaging/registration-token-not-registered' }), true);
  assert.equal(isInvalidTokenError({ code: 'messaging/invalid-registration-token' }), true);
  assert.equal(isInvalidTokenError({ code: 'messaging/internal-error' }), false);
  assert.equal(isInvalidTokenError(undefined), false);
});

test('sendToTokens: sem tokens retorna successCount 0 sem chamar o messaging', async () => {
  const result = await sendToTokens([], {}, {}, { sendEachForMulticast() { throw new Error('não deveria ser chamado'); } });
  assert.deepEqual(result, { successCount: 0, invalidTokens: [] });
});

test('sendToTokens: identifica tokens inválidos a partir das respostas do FCM', async () => {
  const messaging = {
    async sendEachForMulticast() {
      return {
        successCount: 1,
        responses: [
          { success: true },
          { success: false, error: { code: 'messaging/registration-token-not-registered' } }
        ]
      };
    }
  };
  const result = await sendToTokens(['tok-valido', 'tok-invalido'], {}, {}, messaging);
  assert.equal(result.successCount, 1);
  assert.deepEqual(result.invalidTokens, ['tok-invalido']);
});

test('handleNotificacaoCreated: envia para o token do destinatário cliente', async () => {
  const usuarios = { c1: { fcmTokens: ['tok1'] } };
  const db = fakeDb(usuarios);
  let sentTo = null;
  const messaging = { async sendEachForMulticast(msg) { sentTo = msg.tokens; return { successCount: 1, responses: [{ success: true }] }; } };
  await handleNotificacaoCreated('n1', { destinatarioTipo: 'cliente', clienteId: 'c1', titulo: 't', mensagem: 'm' }, {
    db, messaging, arrayRemove: (...t) => ({ _arrayRemove: t }), logger: { error() {} }
  });
  assert.deepEqual(sentTo, ['tok1']);
});

test('handleNotificacaoCreated: remove token inválido após falha de envio', async () => {
  const usuarios = { c1: { fcmTokens: ['tok-morto'] } };
  const db = fakeDb(usuarios);
  const messaging = { async sendEachForMulticast() { return { successCount: 0, responses: [{ success: false, error: { code: 'messaging/registration-token-not-registered' } }] }; } };
  await handleNotificacaoCreated('n1', { destinatarioTipo: 'cliente', clienteId: 'c1' }, {
    db, messaging, arrayRemove: (...t) => ({ _arrayRemove: t }), logger: { error() {} }
  });
  assert.deepEqual(usuarios.c1.fcmTokens, { _arrayRemove: ['tok-morto'] });
});

test('handleNotificacaoCreated: destinatário sem token não chama o messaging', async () => {
  const usuarios = { c1: { fcmTokens: [] } };
  const db = fakeDb(usuarios);
  let called = false;
  const messaging = { async sendEachForMulticast() { called = true; return { successCount: 0, responses: [] }; } };
  await handleNotificacaoCreated('n1', { destinatarioTipo: 'cliente', clienteId: 'c1' }, {
    db, messaging, arrayRemove: (...t) => ({ _arrayRemove: t }), logger: { error() {} }
  });
  assert.equal(called, false);
});

test('handleNotificacaoCreated: falha ao enviar para um destinatário não impede os demais nem lança (Fail-Fast Dispatch)', async () => {
  const usuarios = { a1: { tipo: 'admin', fcmTokens: ['t1'] }, a2: { tipo: 'admin', fcmTokens: ['t2'] } };
  const db = fakeDb(usuarios);
  let calls = 0;
  const messaging = {
    async sendEachForMulticast() {
      calls++;
      if (calls === 1) throw new Error('falha de rede');
      return { successCount: 1, responses: [{ success: true }] };
    }
  };
  const erros = [];
  await handleNotificacaoCreated('n1', { destinatarioTipo: 'admin' }, {
    db, messaging, arrayRemove: (...t) => ({ _arrayRemove: t }), logger: { error(...args) { erros.push(args); } }
  });
  assert.equal(calls, 2); // tenta os 2 admins mesmo apos falha no primeiro
  assert.equal(erros.length, 1);
});

test('handleNotificacaoCreated: destinatarioTipo desconhecido nao chama o messaging', async () => {
  const db = fakeDb({});
  let called = false;
  const messaging = { async sendEachForMulticast() { called = true; return { successCount: 0, responses: [] }; } };
  await handleNotificacaoCreated('n1', { destinatarioTipo: 'algo_invalido' }, {
    db, messaging, arrayRemove: (...t) => ({ _arrayRemove: t }), logger: { error() {} }
  });
  assert.equal(called, false);
});
