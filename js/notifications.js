// ============================================
// NOTIFICAÇÕES PUSH (Firebase Cloud Messaging) — módulo compartilhado admin/cliente
// ============================================
import { obterMessaging, VAPID_KEY } from './firebase-config.js';
import { salvarFcmToken, removerFcmToken } from './data.js';
import { getToken, onMessage } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js';

let tokenAtual = null;
let foregroundHandler = null;

// Estado da permissão do navegador para notificações — usado pela tela para decidir
// se mostra o banner explicativo (nunca chama o prompt nativo direto, ver frontend-components.md).
export function permissaoNotificacao() {
  return (typeof Notification !== 'undefined') ? Notification.permission : 'unsupported';
}

export function onForegroundMessage(handler) {
  foregroundHandler = handler;
}

// Quando o app já está aberto e o usuário clica numa notificação em background,
// o service worker manda essa mensagem em vez de recarregar a página (ver firebase-messaging-sw.js).
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'notification-click' && foregroundHandler) {
      foregroundHandler(event.data.data || {});
    }
  });
}

async function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  } catch (e) {
    console.error('Falha ao registrar o service worker de notificações', e);
    return null;
  }
}

// Chamado quando a permissão já está concedida (silencioso) OU pelo clique no botão
// "Ativar" do banner explicativo (única situação em que o prompt nativo do navegador aparece).
export async function ativarNotificacoes(uid) {
  const messaging = await obterMessaging();
  if (!messaging) return false; // navegador/contexto sem suporte a push

  if (Notification.permission === 'default') {
    const resultado = await Notification.requestPermission();
    if (resultado !== 'granted') return false;
  } else if (Notification.permission === 'denied') {
    return false;
  }

  await registrarServiceWorker();

  try {
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (token) {
      tokenAtual = token;
      await salvarFcmToken(uid, token);
    }
  } catch (e) {
    console.error('Falha ao obter token FCM', e);
    return false;
  }

  onMessage(messaging, payload => {
    if (foregroundHandler) foregroundHandler(payload.data || {});
  });

  return !!tokenAtual;
}

// Chamado no logout (Q2=A da NFR Requirements da Unidade 2) — evita que o dispositivo
// continue recebendo push depois que o usuário saiu da conta.
export async function removerTokenAtual(uid) {
  if (!tokenAtual) return;
  await removerFcmToken(uid, tokenAtual);
  tokenAtual = null;
}

// Roteia o clique numa notificação (push em background/foreground, ou item da lista in-app)
// para a tela correspondente. `gotoFns` é um mapa { linkPagina: (linkId) => void } fornecido
// por cada painel (admin/cliente têm páginas e funções de abertura diferentes).
export function handleNotificationOpen(data, gotoFns) {
  if (!data || !data.linkPagina) return;
  const fn = gotoFns[data.linkPagina];
  if (fn) fn(data.linkId);
}
