// ============================================
// CAMADA DE DADOS (Firestore + Storage)
// ============================================
import {
  db, storage, auth,
  collection, doc, setDoc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, onSnapshot, serverTimestamp,
  ref, uploadString, getDownloadURL, deleteObject
} from './firebase-config.js';

// ---------- UPLOAD DE FOTOS ----------
export async function uploadFoto(base64DataUrl, caminho) {
  const storageRef = ref(storage, caminho);
  await uploadString(storageRef, base64DataUrl, 'data_url');
  return await getDownloadURL(storageRef);
}

export function fileParaBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ---------- SOLICITAÇÕES (pedidos de obra/orçamento feitos pelo cliente) ----------
export async function criarSolicitacao(dados) {
  const ref_ = await addDoc(collection(db, 'solicitacoes'), {
    ...dados,
    status: 'pendente', // pendente | aceita | recusada
    criadoEm: serverTimestamp()
  });
  return ref_.id;
}

export function escutarSolicitacoes(callback, filtroClienteId = null) {
  let q;
  if (filtroClienteId) {
    q = query(collection(db, 'solicitacoes'), where('clienteId', '==', filtroClienteId), orderBy('criadoEm', 'desc'));
  } else {
    q = query(collection(db, 'solicitacoes'), orderBy('criadoEm', 'desc'));
  }
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export async function atualizarSolicitacao(id, dados) {
  await updateDoc(doc(db, 'solicitacoes', id), dados);
}

export async function excluirSolicitacao(id) {
  await deleteDoc(doc(db, 'solicitacoes', id));
}

// ---------- OBRAS ----------
export async function criarObra(obraData) {
  const ref_ = await addDoc(collection(db, 'obras'), {
    ...obraData,
    status: 'andamento',
    criadoEm: serverTimestamp()
  });
  return ref_.id;
}

export async function atualizarObra(obraId, dados) {
  await updateDoc(doc(db, 'obras', obraId), dados);
}

export function escutarObras(callback, filtroClienteId = null) {
  let q;
  if (filtroClienteId) {
    q = query(collection(db, 'obras'), where('clienteId', '==', filtroClienteId), orderBy('criadoEm', 'desc'));
  } else {
    q = query(collection(db, 'obras'), orderBy('criadoEm', 'desc'));
  }
  return onSnapshot(q, snap => {
    const obras = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(obras);
  });
}

export async function buscarObra(obraId) {
  const snap = await getDoc(doc(db, 'obras', obraId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ---------- ETAPAS (subcoleção de cada obra) ----------
export async function criarEtapa(obraId, etapaData) {
  const ref_ = await addDoc(collection(db, 'obras', obraId, 'etapas'), {
    status: 'execucao',
    aprovacao: 'pendente',
    pagamento: 'a_pagar',
    ...etapaData, // spread depois para permitir sobrescrever status (ex: diária que nasce concluída)
    criadoEm: serverTimestamp()
  });
  return ref_.id;
}

export async function atualizarEtapa(obraId, etapaId, dados) {
  await updateDoc(doc(db, 'obras', obraId, 'etapas', etapaId), dados);
}

export function escutarEtapas(obraId, callback) {
  const q = query(collection(db, 'obras', obraId, 'etapas'), orderBy('criadoEm', 'asc'));
  return onSnapshot(q, snap => {
    const etapas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(etapas);
  });
}

// Escuta TODAS as etapas de TODAS as obras (útil para telas "em execução" / "executados" globais)
export function escutarTodasEtapas(obras, callback) {
  // obras: array já carregado de { id, nome, ... }
  // Faz um listener por obra e agrega
  const unsubs = [];
  let agregando = {};
  obras.forEach(o => {
    const q = query(collection(db, 'obras', o.id, 'etapas'), orderBy('criadoEm', 'asc'));
    const unsub = onSnapshot(q, snap => {
      agregando[o.id] = snap.docs.map(d => ({ id: d.id, obraId: o.id, obraNome: o.nome, ...d.data() }));
      const todas = Object.values(agregando).flat();
      callback(todas);
    });
    unsubs.push(unsub);
  });
  return () => unsubs.forEach(u => u());
}

// ---------- ENCARGOS (custos avulsos: material, aluguel, etc.) ----------
export async function criarEncargo(obraId, encargoData) {
  const ref_ = await addDoc(collection(db, 'obras', obraId, 'encargos'), {
    ...encargoData,
    criadoEm: serverTimestamp()
  });
  return ref_.id;
}

export function escutarEncargos(obraId, callback) {
  const q = query(collection(db, 'obras', obraId, 'encargos'), orderBy('criadoEm', 'desc'));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export async function excluirEncargo(obraId, encargoId) {
  await deleteDoc(doc(db, 'obras', obraId, 'encargos', encargoId));
}

// ---------- TABELA DE PREÇOS (única, global) ----------
export function escutarPrecos(callback) {
  const q = query(collection(db, 'precos'), orderBy('nome', 'asc'));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export async function criarPreco(nome, valorM2) {
  await addDoc(collection(db, 'precos'), { nome, val: valorM2 });
}

export async function atualizarPreco(precoId, nome, valorM2) {
  await updateDoc(doc(db, 'precos', precoId), { nome, val: valorM2 });
}

export async function excluirPreco(precoId) {
  await deleteDoc(doc(db, 'precos', precoId));
}

// ---------- TABELA DE REPASSE (interna, admin) ----------
export function escutarRepasses(callback) {
  const q = query(collection(db, 'repasses'), orderBy('nome', 'asc'));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export async function criarRepasse(nome, valorM2) {
  await addDoc(collection(db, 'repasses'), { nome, val: valorM2 });
}

export async function atualizarRepasse(repasseId, nome, valorM2) {
  await updateDoc(doc(db, 'repasses', repasseId), { nome, val: valorM2 });
}

export async function excluirRepasse(repasseId) {
  await deleteDoc(doc(db, 'repasses', repasseId));
}

// ---------- PARCEIROS (pedreiros / prestadores) ----------
export function escutarParceiros(callback) {
  const q = query(collection(db, 'parceiros'), orderBy('nome', 'asc'));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export async function criarParceiro(dados) {
  await addDoc(collection(db, 'parceiros'), { ...dados, criadoEm: serverTimestamp() });
}

export async function atualizarParceiro(parceiroId, dados) {
  await updateDoc(doc(db, 'parceiros', parceiroId), dados);
}

export async function excluirParceiro(parceiroId) {
  await deleteDoc(doc(db, 'parceiros', parceiroId));
}

// ---------- CLIENTES (gestão de usuários tipo cliente) ----------
export function escutarClientes(callback) {
  const q = query(collection(db, 'usuarios'), where('tipo', '==', 'cliente'));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export async function aprovarCliente(uid) {
  await updateDoc(doc(db, 'usuarios', uid), { status: 'aprovado' });
}

export async function rejeitarCliente(uid) {
  await updateDoc(doc(db, 'usuarios', uid), { status: 'rejeitado' });
}

// ---------- ADMINS ----------
export function escutarAdmins(callback) {
  const q = query(collection(db, 'usuarios'), where('tipo', '==', 'admin'));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

// ---------- HELPERS ----------
export function hoje() { return new Date().toISOString().split('T')[0]; }
export function diasDiff(d1, d2) { return Math.round((new Date(d2) - new Date(d1)) / (1000 * 60 * 60 * 24)); }

// ---------- EXCLUIR OBRA ----------
export async function excluirObra(obraId) {
  await deleteDoc(doc(db, 'obras', obraId));
}

// ---------- PAGAMENTOS AO PARCEIRO (comprovantes vinculados ao parceiro) ----------
export async function registrarPagamentoParceiro(parceiroId, dados) {
  const ref_ = await addDoc(collection(db, 'parceiros', parceiroId, 'pagamentos'), {
    ...dados,
    criadoEm: serverTimestamp()
  });
  return ref_.id;
}

export function escutarPagamentosParceiro(parceiroId, callback) {
  const q = query(collection(db, 'parceiros', parceiroId, 'pagamentos'), orderBy('criadoEm', 'desc'));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export async function excluirPagamentoParceiro(parceiroId, pagamentoId) {
  await deleteDoc(doc(db, 'parceiros', parceiroId, 'pagamentos', pagamentoId));
}

// ---------- TABELA DE DIÁRIAS ----------
export function escutarDiarias(callback) {
  const q = query(collection(db, 'diarias'), orderBy('nome', 'asc'));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export async function criarDiaria(nome, valorDia) {
  await addDoc(collection(db, 'diarias'), { nome, val: valorDia });
}

export async function atualizarDiaria(diariaId, nome, valorDia) {
  await updateDoc(doc(db, 'diarias', diariaId), { nome, val: valorDia });
}

export async function excluirDiaria(diariaId) {
  await deleteDoc(doc(db, 'diarias', diariaId));
}

// ---------- PROMOVER CLIENTE A ADMIN ----------
export async function promoverParaAdmin(uid) {
  await updateDoc(doc(db, 'usuarios', uid), { tipo: 'admin', status: 'aprovado' });
}

// ---------- PAGAMENTOS DO CLIENTE (registrado pelo cliente, confirmado pelo admin) ----------
export async function registrarPagamentoCliente(dados) {
  const ref_ = await addDoc(collection(db, 'pagamentos_cliente'), {
    ...dados,
    status: 'pendente', // pendente | confirmado | contestado
    criadoEm: serverTimestamp()
  });
  return ref_.id;
}

export function escutarPagamentosCliente(callback, filtroClienteId = null) {
  let q;
  if (filtroClienteId) {
    q = query(collection(db, 'pagamentos_cliente'), where('clienteId', '==', filtroClienteId), orderBy('criadoEm', 'desc'));
  } else {
    q = query(collection(db, 'pagamentos_cliente'), orderBy('criadoEm', 'desc'));
  }
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export async function atualizarPagamentoCliente(pagId, dados) {
  await updateDoc(doc(db, 'pagamentos_cliente', pagId), dados);
}

// ---------- SOLICITAÇÕES DE PAGAMENTO (admin cobra cliente) ----------
export async function criarSolicitacaoPagamento(dados) {
  const ref_ = await addDoc(collection(db, 'solicitacoes_pagamento'), {
    ...dados,
    status: 'pendente', // pendente | aceita | contestada | paga
    criadoEm: serverTimestamp()
  });
  return ref_.id;
}

export function escutarSolicitacoesPagamento(callback, filtroClienteId = null) {
  let q;
  if (filtroClienteId) {
    q = query(collection(db, 'solicitacoes_pagamento'), where('clienteId', '==', filtroClienteId), orderBy('criadoEm', 'desc'));
  } else {
    q = query(collection(db, 'solicitacoes_pagamento'), orderBy('criadoEm', 'desc'));
  }
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export async function atualizarSolicitacaoPagamento(solId, dados) {
  await updateDoc(doc(db, 'solicitacoes_pagamento', solId), dados);
}

// ---------- WHATSAPP (preparado para Z-API futura) ----------
export async function notificarWhatsApp({ telefone, mensagem, tipo }) {
  // 🔌 INTEGRAÇÃO WHATSAPP — plugar Z-API aqui quando disponível
  // Exemplo de implementação futura:
  // const ZAPI_URL = 'https://api.z-api.io/instances/SUA_INSTANCIA/token/SEU_TOKEN/send-text';
  // await fetch(ZAPI_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ phone: telefone, message: mensagem }) });
  console.log(`[WhatsApp ${tipo}] Para: ${telefone} | Msg: ${mensagem}`);
}

// ---------- EXCLUIR ETAPA ----------
export async function excluirEtapa(obraId, etapaId) {
  await deleteDoc(doc(db, 'obras', obraId, 'etapas', etapaId));
}

// ---------- NOTIFICAÇÕES (feed informativo enviado ao cliente) ----------
export async function criarNotificacao(dados) {
  const ref_ = await addDoc(collection(db, 'notificacoes'), {
    ...dados,
    lida: false,
    criadoEm: serverTimestamp()
  });
  return ref_.id;
}

export function escutarNotificacoes(callback, filtroClienteId = null) {
  let q;
  if (filtroClienteId) {
    q = query(collection(db, 'notificacoes'), where('clienteId', '==', filtroClienteId), orderBy('criadoEm', 'desc'));
  } else {
    q = query(collection(db, 'notificacoes'), orderBy('criadoEm', 'desc'));
  }
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export async function marcarNotificacaoLida(id) {
  await updateDoc(doc(db, 'notificacoes', id), { lida: true });
}

// ---------- ORÇAMENTOS (único fluxo com aprovação do cliente) ----------
export async function enviarOrcamento(dados) {
  const ref_ = await addDoc(collection(db, 'orcamentos'), {
    ...dados,
    status: 'pendente', // pendente | aprovado | rejeitado
    criadoEm: serverTimestamp()
  });
  await criarNotificacao({
    clienteId: dados.clienteId,
    obraId: dados.obraId,
    obraNome: dados.obraNome,
    tipo: 'orcamento_enviado',
    titulo: 'Novo orçamento recebido',
    mensagem: `Um orçamento de R$ ${dados.valor} foi enviado para sua aprovação.`
  });
  return ref_.id;
}

export function escutarOrcamentos(callback, filtroClienteId = null) {
  let q;
  if (filtroClienteId) {
    q = query(collection(db, 'orcamentos'), where('clienteId', '==', filtroClienteId), orderBy('criadoEm', 'desc'));
  } else {
    q = query(collection(db, 'orcamentos'), orderBy('criadoEm', 'desc'));
  }
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export async function decidirOrcamento(orcamentoId, decisao, motivo = '') {
  await updateDoc(doc(db, 'orcamentos', orcamentoId), { status: decisao, motivo, decididoEm: serverTimestamp() });
}

// ---------- AVALIAÇÃO DA OBRA (feita pelo cliente ao final) ----------
export async function enviarAvaliacao(obraId, nota, comentario) {
  await updateDoc(doc(db, 'obras', obraId), { avaliacaoNota: nota, avaliacaoComentario: comentario, avaliadoEm: serverTimestamp() });
}
