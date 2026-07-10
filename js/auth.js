// ============================================
// MÓDULO DE AUTENTICAÇÃO
// ============================================
import {
  auth, db,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile,
  updatePassword,
  updateEmail,
  reauthenticateWithCredential,
  EmailAuthProvider,
  doc, setDoc, getDoc, updateDoc
} from './firebase-config.js';

import {
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Cria conta de CLIENTE (auto-cadastro aprovado diretamente)
export async function cadastrarCliente(nome, email, senha, telefone) {
  const cred = await createUserWithEmailAndPassword(auth, email, senha);
  await updateProfile(cred.user, { displayName: nome });
  await setDoc(doc(db, 'usuarios', cred.user.uid), {
    nome, email, telefone: telefone || '',
    tipo: 'cliente',
    status: 'aprovado',
    criadoEm: new Date().toISOString()
  });
  return cred.user;
}

// Cria conta de ADMIN (usado pelo admin master para criar outros admins)
export async function cadastrarAdmin(nome, email, senha) {
  const cred = await createUserWithEmailAndPassword(auth, email, senha);
  await updateProfile(cred.user, { displayName: nome });
  await setDoc(doc(db, 'usuarios', cred.user.uid), {
    nome, email,
    tipo: 'admin',
    status: 'aprovado',
    criadoEm: new Date().toISOString()
  });
  return cred.user;
}

export async function login(email, senha) {
  const cred = await signInWithEmailAndPassword(auth, email, senha);
  return cred.user;
}

export async function loginComGoogle() {
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);
  const user = cred.user;
  // Verifica se já tem perfil — se não, cria como cliente aprovado
  const snap = await getDoc(doc(db, 'usuarios', user.uid));
  if (!snap.exists()) {
    await setDoc(doc(db, 'usuarios', user.uid), {
      nome: user.displayName || user.email,
      email: user.email,
      telefone: user.phoneNumber || '',
      tipo: 'cliente',
      status: 'aprovado',
      criadoEm: new Date().toISOString()
    });
  }
  return user;
}

export async function logout() {
  await signOut(auth);
}

export async function recuperarSenha(email) {
  await sendPasswordResetEmail(auth, email);
}

async function reautenticar(senhaAtual) {
  const cred = EmailAuthProvider.credential(auth.currentUser.email, senhaAtual);
  await reauthenticateWithCredential(auth.currentUser, cred);
}

export async function trocarSenha(senhaAtual, novaSenha) {
  await reautenticar(senhaAtual);
  await updatePassword(auth.currentUser, novaSenha);
}

export async function trocarEmailConta(senhaAtual, novoEmail) {
  await reautenticar(senhaAtual);
  await updateEmail(auth.currentUser, novoEmail);
  await updateDoc(doc(db, 'usuarios', auth.currentUser.uid), { email: novoEmail });
}

export async function buscarPerfilUsuario(uid) {
  const snap = await getDoc(doc(db, 'usuarios', uid));
  return snap.exists() ? snap.data() : null;
}

// Observa o estado de login e redireciona conforme o tipo/status de usuário.
// onReady(user, perfil) é chamado quando tudo está carregado.
export function observarAuth(onReady) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) { onReady(null, null); return; }
    const perfil = await buscarPerfilUsuario(user.uid);
    onReady(user, perfil);
  });
}

export function mensagemErroFirebase(err) {
  const code = err.code || '';
  const map = {
    'auth/invalid-email': 'E-mail inválido.',
    'auth/user-not-found': 'Não encontramos uma conta com esse e-mail.',
    'auth/wrong-password': 'Senha incorreta.',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/email-already-in-use': 'Esse e-mail já está cadastrado.',
    'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde um momento e tente de novo.',
    'auth/network-request-failed': 'Falha de conexão. Verifique sua internet.'
  };
  return map[code] || 'Ocorreu um erro. Tente novamente.';
}
