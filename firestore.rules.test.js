// Testes das regras do Firestore usando o emulador (@firebase/rules-unit-testing).
// Verifica diretamente os 2 achados críticos da engenharia reversa e o novo formato de notificações.
// Execução: npx firebase-tools emulators:exec --only firestore "node --test firestore.rules.test.js"
import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, getDoc, collection } from 'firebase/firestore';

let testEnv;

// Nota: as regras (firestore.rules) já são carregadas automaticamente pelo Firebase CLI
// ao iniciar o emulador (via firebase.json), então não as reenviamos aqui — apenas
// conectamos ao emulador já em execução (ver package.json: "test:rules").
test.before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-gestaoeco',
    firestore: {
      host: '127.0.0.1',
      port: 8080
    }
  });
});

test.after(async () => {
  if (testEnv) await testEnv.cleanup();
});

test.beforeEach(async () => {
  await testEnv.clearFirestore();
});

async function seed(fn) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await fn(context.firestore());
  });
}

// ---------- Achado #1: autopromoção a admin ----------

test('achado #1: cliente não pode se autopromover a admin via update', async () => {
  await seed(async (db) => {
    await setDoc(doc(db, 'usuarios', 'user1'), { tipo: 'cliente', status: 'pendente', nome: 'X' });
  });
  const db = testEnv.authenticatedContext('user1').firestore();
  await assertFails(updateDoc(doc(db, 'usuarios', 'user1'), { tipo: 'admin', status: 'aprovado' }));
});

test('achado #1: autocadastro não pode nascer já como admin (create)', async () => {
  const db = testEnv.authenticatedContext('user2').firestore();
  await assertFails(setDoc(doc(db, 'usuarios', 'user2'), { tipo: 'admin', status: 'aprovado', nome: 'Y' }));
});

test('achado #1: autocadastro normal como cliente pendente continua funcionando', async () => {
  const db = testEnv.authenticatedContext('user3').firestore();
  await assertSucceeds(setDoc(doc(db, 'usuarios', 'user3'), { tipo: 'cliente', status: 'pendente', nome: 'Z' }));
});

test('achado #1: autoescrita de nome/telefone/fcmTokens continua permitida', async () => {
  await seed(async (db) => {
    await setDoc(doc(db, 'usuarios', 'user4'), { tipo: 'cliente', status: 'pendente', nome: 'A' });
  });
  const db = testEnv.authenticatedContext('user4').firestore();
  await assertSucceeds(updateDoc(doc(db, 'usuarios', 'user4'), { nome: 'A2', telefone: '11999999999', fcmTokens: ['tok1'] }));
});

test('achado #1 (fix do cadastrarAdmin): admin existente pode criar o perfil de OUTRO usuário como admin', async () => {
  await seed(async (db) => {
    await setDoc(doc(db, 'usuarios', 'admin1'), { tipo: 'admin', status: 'aprovado', nome: 'Admin' });
  });
  const db = testEnv.authenticatedContext('admin1').firestore();
  await assertSucceeds(setDoc(doc(db, 'usuarios', 'newAdmin'), { tipo: 'admin', status: 'aprovado', nome: 'Novo Admin' }));
});

// ---------- Achado #2: leitura de etapas entre clientes ----------

test('achado #2: cliente não pode ler etapas de obra de outro cliente', async () => {
  await seed(async (db) => {
    await setDoc(doc(db, 'usuarios', 'clienteA'), { tipo: 'cliente', status: 'aprovado', nome: 'A' });
    await setDoc(doc(db, 'usuarios', 'clienteB'), { tipo: 'cliente', status: 'aprovado', nome: 'B' });
    await setDoc(doc(db, 'obras', 'obraB'), { nome: 'Obra do B', clienteId: 'clienteB', status: 'andamento' });
    await setDoc(doc(db, 'obras', 'obraB', 'etapas', 'etapa1'), { tipo: 'Piso', valRepasse: '100,00' });
  });
  const db = testEnv.authenticatedContext('clienteA').firestore();
  await assertFails(getDoc(doc(db, 'obras', 'obraB', 'etapas', 'etapa1')));
});

test('achado #2 (fix): cliente pode ler etapas da própria obra', async () => {
  await seed(async (db) => {
    await setDoc(doc(db, 'usuarios', 'clienteC'), { tipo: 'cliente', status: 'aprovado', nome: 'C' });
    await setDoc(doc(db, 'obras', 'obraC'), { nome: 'Obra do C', clienteId: 'clienteC', status: 'andamento' });
    await setDoc(doc(db, 'obras', 'obraC', 'etapas', 'etapa1'), { tipo: 'Piso', valRepasse: '100,00' });
  });
  const db = testEnv.authenticatedContext('clienteC').firestore();
  await assertSucceeds(getDoc(doc(db, 'obras', 'obraC', 'etapas', 'etapa1')));
});

test('achado #2: admin pode ler etapas de qualquer obra', async () => {
  await seed(async (db) => {
    await setDoc(doc(db, 'usuarios', 'admin2'), { tipo: 'admin', status: 'aprovado', nome: 'Admin2' });
    await setDoc(doc(db, 'usuarios', 'clienteH'), { tipo: 'cliente', status: 'aprovado', nome: 'H' });
    await setDoc(doc(db, 'obras', 'obraH'), { nome: 'Obra do H', clienteId: 'clienteH', status: 'andamento' });
    await setDoc(doc(db, 'obras', 'obraH', 'etapas', 'etapa1'), { tipo: 'Piso', valRepasse: '100,00' });
  });
  const db = testEnv.authenticatedContext('admin2').firestore();
  await assertSucceeds(getDoc(doc(db, 'obras', 'obraH', 'etapas', 'etapa1')));
});

// ---------- Notificações: novo formato bidirecional ----------

test('notificacoes: cliente pode criar notificação admin-facing com tipo permitido', async () => {
  await seed(async (db) => {
    await setDoc(doc(db, 'usuarios', 'clienteD'), { tipo: 'cliente', status: 'aprovado', nome: 'D' });
  });
  const db = testEnv.authenticatedContext('clienteD').firestore();
  await assertSucceeds(setDoc(doc(collection(db, 'notificacoes'), 'n1'), {
    destinatarioTipo: 'admin', tipo: 'solicitacao_criada', titulo: 't', mensagem: 'm', lida: false
  }));
});

test('notificacoes: cliente não pode criar notificação com tipo fora da lista permitida', async () => {
  await seed(async (db) => {
    await setDoc(doc(db, 'usuarios', 'clienteE'), { tipo: 'cliente', status: 'aprovado', nome: 'E' });
  });
  const db = testEnv.authenticatedContext('clienteE').firestore();
  await assertFails(setDoc(doc(collection(db, 'notificacoes'), 'n2'), {
    destinatarioTipo: 'admin', tipo: 'tipo_forjado', titulo: 't', mensagem: 'm', lida: false
  }));
});

test('notificacoes: cliente não pode criar notificação já marcada como lida', async () => {
  await seed(async (db) => {
    await setDoc(doc(db, 'usuarios', 'clienteF'), { tipo: 'cliente', status: 'aprovado', nome: 'F' });
  });
  const db = testEnv.authenticatedContext('clienteF').firestore();
  await assertFails(setDoc(doc(collection(db, 'notificacoes'), 'n3'), {
    destinatarioTipo: 'admin', tipo: 'solicitacao_criada', titulo: 't', mensagem: 'm', lida: true
  }));
});

test('notificacoes: cliente não pode criar notificação cliente-facing diretamente (só admin cria essas)', async () => {
  await seed(async (db) => {
    await setDoc(doc(db, 'usuarios', 'clienteG'), { tipo: 'cliente', status: 'aprovado', nome: 'G' });
  });
  const db = testEnv.authenticatedContext('clienteG').firestore();
  await assertFails(setDoc(doc(collection(db, 'notificacoes'), 'n4'), {
    destinatarioTipo: 'cliente', clienteId: 'clienteG', tipo: 'obra_criada', titulo: 't', mensagem: 'm', lida: false
  }));
});
