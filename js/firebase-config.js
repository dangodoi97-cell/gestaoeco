// ============================================
// CONFIGURAÇÃO DO FIREBASE
// ============================================
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadString,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import {
  getMessaging,
  isSupported as isMessagingSupported
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js";

const firebaseConfig = {
  apiKey: "AIzaSyAB6sSRSNx1qloE5ZtpVeTyU9hBSspIWfU",
  authDomain: "gestaoecosytem.firebaseapp.com",
  projectId: "gestaoecosytem",
  storageBucket: "gestaoecosytem.firebasestorage.app",
  messagingSenderId: "1052037841825",
  appId: "1:1052037841825:web:3a6c13384020722c9841e0",
  measurementId: "G-K4MDKF53F7"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Chave pública VAPID (Web Push), gerada em: Console do Firebase > Configurações do projeto >
// Cloud Messaging > Configuração da Web > Certificados push da Web. Não é secreta (é enviada
// ao navegador do usuário), mas precisa ser preenchida antes do primeiro deploy com notificações —
// ver aidlc-docs/construction/unit2-notificacoes-seguranca/infrastructure-design/ e LEIA-ME.md.
export const VAPID_KEY = 'SUBSTITUA_PELA_CHAVE_VAPID_PUBLICA_DO_CONSOLE_FIREBASE';

let _messagingPromise = null;
// getMessaging() lança erro em navegadores/contextos sem suporte a Service Worker/Push
// (ex.: Safari mais antigo, iframes, contexto não-seguro) — por isso o suporte é checado
// primeiro e o resultado é cacheado (evita chamar isSupported() repetidamente).
export function obterMessaging() {
  if (!_messagingPromise) {
    _messagingPromise = isMessagingSupported().then(suportado => suportado ? getMessaging(app) : null);
  }
  return _messagingPromise;
}

export {
  firebaseConfig,
  initializeApp,
  deleteApp,
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  ref,
  uploadString,
  getDownloadURL,
  deleteObject
};
