// ============================================
// APP ADMIN — versão completa com repasse, diárias, financeiro, exclusão de obra
// ============================================
import { auth } from '../js/firebase-config.js';
import { observarAuth, logout, cadastrarAdmin, mensagemErroFirebase } from '../js/auth.js';
import {
  criarObra, atualizarObra, escutarObras, excluirObra, restaurarObra, limparLixeiraObra,
  criarEtapa, atualizarEtapa, escutarEtapas, escutarTodasEtapas, excluirEtapa,
  criarEncargo, escutarEncargos, excluirEncargo,
  escutarPrecos, criarPreco, atualizarPreco, excluirPreco,
  escutarRepasses, criarRepasse, atualizarRepasse, excluirRepasse,
  escutarParceiros, criarParceiro, atualizarParceiro, excluirParceiro,
  registrarPagamentoParceiro, escutarPagamentosParceiro, excluirPagamentoParceiro,
  escutarDiarias, criarDiaria, atualizarDiaria, excluirDiaria,
  escutarClientes, aprovarCliente, rejeitarCliente, promoverParaAdmin,
  escutarAdmins,
  escutarSolicitacoes, atualizarSolicitacao,
  escutarPagamentosCliente, atualizarPagamentoCliente,
  criarSolicitacaoPagamento, escutarSolicitacoesPagamento, atualizarSolicitacaoPagamento,
  criarFechamentoCaixa, escutarFechamentosCaixa,
  criarNotificacaoParceiro, escutarNotificacoesParceiro, atualizarNotificacaoParceiro,
  notificarWhatsApp,
  criarNotificacao, escutarNotificacoes, marcarNotificacaoLida, enviarOrcamento, escutarOrcamentos,
  uploadFoto, fileParaBase64,
  hoje, diasDiff
} from '../js/data.js';
import { filtrarObras, calcularResumoFechamento } from '../js/fechamento.js';
import { permissaoNotificacao, ativarNotificacoes, removerTokenAtual, onForegroundMessage, handleNotificationOpen } from '../js/notifications.js';

// ---------- AUTH ----------
let usuarioAtual = null;
observarAuth(async (user, perfil) => {
  if (!user || !perfil || perfil.tipo !== 'admin') { window.location.href = '../index.html'; return; }
  usuarioAtual = { uid: user.uid, ...perfil };
  document.getElementById('loading').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  iniciarApp();
  iniciarNotificacoes();
});
window.sairConta = async () => {
  if (usuarioAtual) await removerTokenAtual(usuarioAtual.uid);
  await logout();
  window.location.href = '../index.html';
};

// ---------- NOTIFICAÇÕES PUSH ----------
const gotoFnsAdmin = {
  obras: (id) => { window.goPage('obras'); if (id) window.abrirObra(id); },
  solicitacoes: () => window.goPage('aprovacao'),
  aprovacao: () => window.goPage('aprovacao'),
  'pagamentos-cli': () => window.goPage('aprovacao')
};

function iniciarNotificacoes() {
  const estado = permissaoNotificacao();
  if (estado === 'granted') {
    ativarNotificacoes(usuarioAtual.uid);
  } else if (estado === 'default') {
    const banner = document.getElementById('banner-notificacoes');
    if (banner) banner.style.display = 'flex';
  }
  onForegroundMessage(data => handleNotificationOpen(data, gotoFnsAdmin));

  // Deep-link: se o usuário chegou aqui pelo clique numa notificação push (app estava fechado)
  const params = new URLSearchParams(location.search);
  if (params.has('linkPagina')) {
    handleNotificationOpen({ linkPagina: params.get('linkPagina'), linkId: params.get('linkId') }, gotoFnsAdmin);
    history.replaceState(null, '', location.pathname);
  }
}

window.ativarNotificacoesAdmin = async function() {
  const ok = await ativarNotificacoes(usuarioAtual.uid);
  const banner = document.getElementById('banner-notificacoes');
  if (banner) banner.style.display = 'none';
  toast(ok ? 'Notificações ativadas!' : 'Não foi possível ativar as notificações.');
};

window.abrirNotificacaoAdmin = function(id) {
  const n = db_notificacoesAdmin.find(x => x.id === id);
  if (!n) return;
  if (!n.lida) marcarNotificacaoLida(id);
  handleNotificationOpen({ linkPagina: n.linkPagina, linkId: n.linkId }, gotoFnsAdmin);
};

// ---------- ESTADO ----------
let db_obras = [], db_precos = [], db_repasses = [], db_parceiros = [], db_clientes = [], db_admins = [], db_solicitacoes = [], db_diarias = [], db_pagamentosAdmin = [], db_solicitacoesPagamento = [], db_orcamentos = [], db_notificacoesAdmin = [], db_encargos = [], db_fechamentos = [];
let obraAtiva = null, etapaConclId = null, etapaFotoExtraId = null;
let editPrecoId = null, editPrecoNome = null, editRepasseId = null, editParceiroId = null, editDiariaId = null;
let parceiroDetalheId = null, solicitacaoAceitarId = null;
let etFotos = {}, concFoto = null, encFoto = null, extraFoto = null, pagFoto = null;
let unsubEtapasAtivas = null, unsubTodasEtapas = null, unsubEncargos = null, unsubPagamentos = null, unsubNotificacoesParceiro = null, unsubEncargosGlobais = [];
let fechamentoClienteSelecionado = '';
let encargoSnapshot = {};
let fechamentoDespesasExtras = [];
let fechamentoDespesasConfirmadas = [];

function iniciarApp() {
  escutarObras(obras => {
    db_obras = obras; renderObras(); renderLixeira();
    if (document.getElementById('page-obra-detalhe').classList.contains('active') && obraAtiva) {
      const at = obras.find(o => o.id === obraAtiva.id);
      if (at) { obraAtiva = at; renderDetalheObra(); }
    }
    if (unsubTodasEtapas) unsubTodasEtapas();
    unsubTodasEtapas = escutarTodasEtapas(obras, todas => {
      window._todasEtapas = todas;
      renderExecucao(); renderAprovacao(); updateBadge(); renderFechamentoResumo(); renderFechamentoCaixa();
    });
    if (unsubEncargosGlobais.length) { unsubEncargosGlobais.forEach(u => u()); }
    unsubEncargosGlobais = [];
    encargoSnapshot = {};
    db_encargos = [];
    obras.forEach(o => {
      const unsub = escutarEncargos(o.id, enc => {
        encargoSnapshot[o.id] = enc;
        db_encargos = Object.entries(encargoSnapshot).flatMap(([obraId, lista]) => lista.map(e => ({ ...e, obraId, obraNome: (db_obras.find(x => x.id === obraId) || {}).nome || '' })));
        renderFechamentoCaixa();
      });
      unsubEncargosGlobais.push(unsub);
    });
  });
  escutarPrecos(p => { db_precos = p; renderPrecos(); });
  escutarRepasses(r => { db_repasses = r; renderRepasse(); });
  escutarParceiros(p => { db_parceiros = p; renderParceiros(); if (parceiroDetalheId) renderParceiroDetalhe(); });
  escutarClientes(c => { db_clientes = c; renderClientes(); popularSelectClientes(); popularFiltroFechamento(); });
  escutarAdmins(a => { db_admins = a; renderAdmins(); });
  escutarSolicitacoes(s => { db_solicitacoes = s; renderSolicitacoes(); updateBadgeSolicitacoes(); });
  escutarDiarias(d => { db_diarias = d; renderDiarias(); });
  escutarPagamentosCliente(p => { db_pagamentosAdmin = p; updateBadgePagamentos(); renderPagamentosAdmin(); });
  escutarSolicitacoesPagamento(s => { db_solicitacoesPagamento = s; renderContestacoes(); updateBadge(); });
  escutarFechamentosCaixa(f => { db_fechamentos = f; renderFechamentoCaixa(); });
  escutarOrcamentos(o => {
    db_orcamentos = o;
    renderAprovacao();
    updateBadge();
    if (document.getElementById('page-obra-detalhe').classList.contains('active') && obraAtiva) renderDetalheObra();
  });
  escutarNotificacoes(n => {
    db_notificacoesAdmin = n;
    renderNotificacoesAdmin();
    updateBadge();
  }, { destinatarioTipo: 'admin' });
}

// ---------- HELPERS ----------
function toast(m) { const t = document.getElementById('toast'); t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2400); }
window.fmtVal = function(el) { let v = el.value.replace(/\D/g, ''); if (!v) { el.value = ''; return; } v = (parseInt(v) / 100).toFixed(2); el.value = v.replace('.', ','); };
window.showModal = id => document.getElementById(id).classList.add('show');
window.closeModal = id => document.getElementById(id).classList.remove('show');
window.bgClose = (e, id) => { if (e.target === document.getElementById(id)) window.closeModal(id); };
function fmtBRL(v) { return 'R$ ' + parseFloat(v || 0).toFixed(2).replace('.', ','); }
function parseBRL(s) { return parseFloat((s || '0').replace(',', '.')) || 0; }
function dataParaTexto(v) {
  if (!v) return null;
  if (typeof v.toDate === 'function') return v.toDate().toISOString().split('T')[0];
  if (typeof v === 'string') return v.slice(0, 10);
  if (v instanceof Date) return v.toISOString().split('T')[0];
  return null;
}
function estaNoPeriodo(v, inicio, fim) {
  const d = dataParaTexto(v);
  if (!d) return false;
  if (inicio && d < inicio) return false;
  if (fim && d > fim) return false;
  return true;
}

function fotosHTML(antes, depois, extras) {
  let html = '';
  if (antes || depois) {
    const item = (src, lbl) => src
      ? `<div><div class="foto-wrap" onclick="openLightbox('${src}','${lbl}')"><img src="${src}"></div><div class="foto-lbl">${lbl}</div></div>`
      : `<div><div class="foto-sem">Sem foto</div><div class="foto-lbl">${lbl}</div></div>`;
    html += `<div class="fotos-grid">${item(antes,'Antes')}${item(depois,'Depois')}</div>`;
  }
  if (extras && extras.length) {
    html += `<div class="fotos-grid" style="margin-top:6px">` + extras.map((f,i) =>
      `<div><div class="foto-wrap" onclick="openLightbox('${f.url}','${f.legenda||'Extra'}')"><img src="${f.url}"></div><div class="foto-lbl">${f.legenda||'Execução'}</div></div>`
    ).join('') + `</div>`;
  }
  return html;
}
window.openLightbox = (src, label) => { document.getElementById('lightbox-img').src = src; document.getElementById('lightbox-label').textContent = label; document.getElementById('lightbox').classList.add('show'); document.body.style.overflow = 'hidden'; };
window.closeLightbox = () => { document.getElementById('lightbox').classList.remove('show'); document.body.style.overflow = ''; };

function prevFoto(input, key) {
  const file = input.files[0]; if (!file) return;
  fileParaBase64(file).then(d => {
    if (key === 'et-antes') { etFotos.antes = d; setPrev('et-prev-antes', 'et-icon-antes', d); }
    if (key === 'conc-depois') { concFoto = d; setPrev('conc-prev-depois', 'conc-icon-depois', d); }
    if (key === 'enc-comprovante') { encFoto = d; setPrev('enc-prev-comprovante', 'enc-icon-comprovante', d); }
    if (key === 'extra-foto') { extraFoto = d; setPrev('extra-prev-foto', 'extra-icon-foto', d); }
    if (key === 'pag-comprovante') { pagFoto = d; setPrev('pag-prev-comprovante', 'pag-icon-comprovante', d); }
  });
}
window.prevFoto = prevFoto;
function setPrev(imgId, iconId, src) { document.getElementById(imgId).src = src; document.getElementById(imgId).style.display = 'block'; document.getElementById(iconId).style.display = 'none'; }

function popularSelectTipos() {
  const sel = document.getElementById('et-tipo');
  sel.innerHTML = `<option value="">Selecione...</option>`;
  if (db_precos.length) {
    const grp = document.createElement('optgroup'); grp.label = 'Serviços (m²)';
    db_precos.forEach(p => { const o = document.createElement('option'); o.value = 'servico:' + p.nome; o.textContent = p.nome; grp.appendChild(o); });
    sel.appendChild(grp);
  }
  const grpD = document.createElement('optgroup'); grpD.label = 'Diárias';
  const optD = document.createElement('option'); optD.value = 'diaria'; optD.textContent = '📅 Lançar diárias'; grpD.appendChild(optD);
  sel.appendChild(grpD);
  const outros = document.createElement('option'); outros.value = 'outros'; outros.textContent = 'Outros'; sel.appendChild(outros);
}

function popularSelectParceiros() {
  ['et-parceiro-add', 'edit-et-parceiro-add'].forEach(id => {
    const sel = document.getElementById(id); if (!sel) return;
    sel.innerHTML = `<option value="">Selecione parceiro...</option>`;
    db_parceiros.forEach(p => { const o = document.createElement('option'); o.value = p.id; o.textContent = p.nome; sel.appendChild(o); });
  });
}

function popularSelectClientes() {
  const sel = document.getElementById('obra-cliente'); if (!sel) return;
  const atual = sel.value;
  sel.innerHTML = `<option value="">Sem cliente vinculado</option>`;
  db_clientes.filter(c => c.status === 'aprovado').forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = c.nome; sel.appendChild(o); });
  sel.value = atual;
}

// ---------- FECHAMENTO DE CAIXA (filtro por cliente na aba Obras) ----------
function usuariosClientesById() {
  const map = {};
  db_clientes.forEach(c => { map[c.id] = c; });
  return map;
}

function popularFiltroFechamento() {
  const sel = document.getElementById('fechamento-cliente-select'); if (!sel) return;
  const atual = sel.value;
  sel.innerHTML = `<option value="">(Todos)</option>`;
  db_clientes.filter(c => c.status === 'aprovado').forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = c.nome; sel.appendChild(o); });
  const outros = document.createElement('option'); outros.value = '__outros__'; outros.textContent = 'Sem cliente / Outros';
  sel.appendChild(outros);
  sel.value = atual;
}

window.filtrarObrasPorCliente = function(clienteId) {
  fechamentoClienteSelecionado = clienteId || '';
  renderObras();
};

function renderFechamentoResumo() {
  const wrap = document.getElementById('fechamento-resumo'); if (!wrap) return;
  if (!fechamentoClienteSelecionado) { wrap.style.display = 'none'; return; }
  const resumo = calcularResumoFechamento(db_obras, window._todasEtapas || [], usuariosClientesById(), fechamentoClienteSelecionado);
  wrap.style.display = 'grid';
  document.getElementById('fechamento-resumo-entrada').textContent = fmtBRL(resumo.totalEntrada);
  document.getElementById('fechamento-resumo-repasse').textContent = fmtBRL(resumo.totalRepasse);
  document.getElementById('fechamento-resumo-sobra').textContent = fmtBRL(resumo.totalSobra);
}

// Sobrescreve o onclick do botão nova obra para popular o select antes de abrir
document.addEventListener('DOMContentLoaded', () => {
  const btnNovaObra = document.querySelector('[onclick="showModal(\'modal-nova-obra\')"]');
  if (btnNovaObra) {
    btnNovaObra.onclick = () => {
      popularSelectClientes();
      window.showModal('modal-nova-obra');
    };
  }
});

window.abrirModalNovaObra = function() {
  popularSelectClientes();
  document.getElementById('obra-cliente').value = '';
  window.showModal('modal-nova-obra');
};
const TITULOS = { obras:'Painel Admin', execucao:'Em execução', aprovacao:'Notificações', parceiros:'Parceiros', mais:'Mais opções', precos:'Tabela de preços', repasse:'Tabela de repasse', diarias:'Tabela de diárias', lixeira:'Lixeira', fechamento:'Fechamento de caixa', clientes:'Clientes', admins:'Administradores', solicitacoes:'Solicitações', 'pagamentos-cli':'Pagamentos dos clientes' };

window.goPage = function(p) {
  document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + p).classList.add('active');
  const nav = document.getElementById('nav-' + p);
  if (nav) nav.classList.add('active');
  if (TITULOS[p]) document.getElementById('topbar-content').innerHTML = `<h1>${TITULOS[p]}</h1>`;
  updateBadge();
  if (p === 'fechamento') {
    const inicio = document.getElementById('fechamento-data-inicio');
    const fim = document.getElementById('fechamento-data-fim');
    if (inicio && !inicio.value) {
      const hoje = new Date();
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
      inicio.value = inicioMes;
    }
    if (fim && !fim.value) {
      fim.value = new Date().toISOString().split('T')[0];
    }
    renderFechamentoCaixa();
  }
};

window.abrirFechamentoCaixa = function() {
  const inicio = document.getElementById('fechamento-data-inicio');
  const fim = document.getElementById('fechamento-data-fim');
  if (inicio && !inicio.value) {
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
    inicio.value = inicioMes;
  }
  if (fim && !fim.value) {
    fim.value = new Date().toISOString().split('T')[0];
  }
  window.goPage('fechamento');
  renderFechamentoCaixa();
};

async function renderFechamentoCaixa() {
  const resumoEl = document.getElementById('fechamento-resumo');
  const itensEl = document.getElementById('fechamento-itens');
  const extrasEl = document.getElementById('fechamento-extras-lista');
  if (!resumoEl || !itensEl || !extrasEl) return;

  const inicio = document.getElementById('fechamento-data-inicio')?.value || '';
  const fim = document.getElementById('fechamento-data-fim')?.value || '';
  const etapasPeriodo = (window._todasEtapas || []).filter(e => e.status === 'concluido' && estaNoPeriodo(e.dataConc, inicio, fim));
  const etapasConcluidas = etapasPeriodo.filter(e => !e.isDiaria && !e.isDiariaAvulsa);
  const diariasPeriodo = etapasPeriodo.filter(e => e.isDiaria || e.isDiariaAvulsa);

  const valorEtapas = etapasConcluidas.reduce((s, e) => s + parseBRL(e.val), 0);
  const valorDiarias = diariasPeriodo.reduce((s, e) => s + parseBRL(e.val), 0);
  const valorGanhos = valorEtapas + valorDiarias;

  const parceirosResumo = {};
  etapasPeriodo.forEach(e => {
    const lista = Array.isArray(e.parceiros) && e.parceiros.length ? e.parceiros : [];
    if (lista.length) {
      lista.forEach(p => {
        const valor = parseBRL(p.repasse);
        if (!valor) return;
        const key = p.parceiroId || p.nome;
        if (!parceirosResumo[key]) parceirosResumo[key] = { id: key, nome: p.nome || 'Parceiro', valor: 0 };
        parceirosResumo[key].valor += valor;
      });
    } else if (e.valRepasse) {
      const key = e.parceiroNome || 'Parceiro não identificado';
      if (!parceirosResumo[key]) parceirosResumo[key] = { id: key, nome: key, valor: 0 };
      parceirosResumo[key].valor += parseBRL(e.valRepasse);
    }
  });
  const valorRepasse = Object.values(parceirosResumo).reduce((s, p) => s + p.valor, 0);

  const encargosPeriodo = db_encargos.filter(e => estaNoPeriodo(e.criadoEm, inicio, fim));
  const valorEncargos = encargosPeriodo.reduce((s, e) => s + parseBRL(e.valor), 0);
  const valorExtrasConfirmados = fechamentoDespesasConfirmadas.reduce((s, e) => s + parseBRL(e.valor), 0);
  const valorDespesas = valorRepasse + valorExtrasConfirmados;
  const lucro = valorGanhos - valorDespesas;
  const valorReceberCliente = valorGanhos + valorEncargos;
  const fechamentoExistente = db_fechamentos.find(f => f.periodoInicio === inicio && f.periodoFim === fim);

  const renderLinhaResumo = (label, valor, isSubtotal = false) => `
    <div class="fechamento-row${isSubtotal ? ' subtotal' : ''}">
      <span class="fechamento-row-label${isSubtotal ? ' strong' : ''}">${label}</span>
      <span class="fechamento-row-value${isSubtotal ? ' strong' : ''}">${fmtBRL(valor)}</span>
    </div>`;

  resumoEl.innerHTML = `
    <div class="card fechamento-card">
      <div class="fechamento-header">
        <div>
          <div class="fechamento-title">Resumo do período</div>
          <div class="fechamento-periodo">${inicio || '—'}${fim ? ` até ${fim}` : ''}</div>
        </div>
        <button class="btn-sm btn-success" onclick="salvarFechamentoCaixa('${inicio}','${fim}',${valorReceberCliente},${valorRepasse},${valorEncargos},${valorDiarias},${valorEtapas},${valorExtrasConfirmados},${lucro})"><i class="ti ti-device-floppy"></i> Salvar fechamento</button>
      </div>

      <div class="fechamento-summary-stack">
        <div class="fechamento-section success">
          <div class="fechamento-section-header success">Ganhos</div>
          <div class="fechamento-table">
            ${renderLinhaResumo('Etapas concluídas', valorEtapas)}
            ${renderLinhaResumo('Diárias', valorDiarias)}
            ${renderLinhaResumo('Subtotal de ganhos', valorGanhos, true)}
          </div>
        </div>

        <div class="fechamento-section danger">
          <div class="fechamento-section-header danger">Despesas</div>
          <div class="fechamento-table">
            ${renderLinhaResumo('Repasses', valorRepasse)}
            ${renderLinhaResumo('Despesas extras confirmadas', valorExtrasConfirmados)}
            ${renderLinhaResumo('Subtotal de despesas', valorDespesas, true)}
          </div>
        </div>

        <div class="fechamento-section neutral">
          <div class="fechamento-section-header neutral">Encargos</div>
          <div class="fechamento-amount-only">${fmtBRL(valorEncargos)}</div>
        </div>

        <div class="fechamento-kpi">
          <div class="fechamento-kpi-label">Valor total a receber do cliente</div>
          <div class="fechamento-kpi-value">${fmtBRL(valorReceberCliente)}</div>
        </div>

        <div class="fechamento-kpi profit ${lucro >= 0 ? 'positive' : 'negative'}">
          <div class="fechamento-kpi-label">Lucro geral</div>
          <div class="fechamento-kpi-value">${fmtBRL(lucro)}</div>
        </div>
      </div>

      <div class="divider"></div>
      <div style="font-size:13px;font-weight:600;margin-bottom:8px;padding:0 14px">Parceiros e saldo devedor</div>
      <div style="padding:0 14px 14px">
        ${Object.values(parceirosResumo).length ? Object.values(parceirosResumo).map(p => `<div class="row-item"><div class="row-info"><div class="row-title">${p.nome}</div></div><div style="font-size:13px;font-weight:600;color:var(--text-danger)">${fmtBRL(p.valor)}</div></div>`).join('') : `<div class="empty"><i class="ti ti-users-off"></i><p>Nenhum repasse para parceiros neste período.</p></div>`}
      </div>
    </div>`;

  itensEl.innerHTML = etapasPeriodo.length ? etapasPeriodo.map(e => `
    <div class="row-item">
      <div class="row-info">
        <div class="row-title">${e.tipo || 'Item'}</div>
        <div class="row-meta">${e.obraNome || 'Obra sem nome'} · ${e.isDiaria || e.isDiariaAvulsa ? 'Diária' : 'Etapa concluída'}</div>
      </div>
      <div style="font-size:13px;font-weight:600;color:var(--text-success)">${fmtBRL(parseBRL(e.val))}</div>
    </div>`).join('') : `<div class="empty"><i class="ti ti-clipboard-check"></i><p>Nenhum item concluído neste período.</p></div>`;

  if (fechamentoExistente) {
    resumoEl.innerHTML += `<div class="alert-box alert-success" style="margin-top:8px"><i class="ti ti-check"></i> Fechamento já salvo para este período.</div>`;
  }

  extrasEl.innerHTML = `
    ${fechamentoDespesasExtras.length ? fechamentoDespesasExtras.map((item, index) => `
      <div class="row-item">
        <div class="row-info">
          <div class="row-title">${item.descricao}</div>
          <div class="row-meta">${fmtBRL(item.valor)}</div>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn-sm btn-success" onclick="confirmarDespesaExtra(${index})"><i class="ti ti-check"></i></button>
          <button class="btn-sm btn-danger" onclick="removerDespesaExtra(${index}, 'pendente')"><i class="ti ti-trash"></i></button>
        </div>
      </div>`).join('') : ''}
    ${fechamentoDespesasConfirmadas.length ? fechamentoDespesasConfirmadas.map((item, index) => `
      <div class="row-item">
        <div class="row-info">
          <div class="row-title">${item.descricao}</div>
          <div class="row-meta">${fmtBRL(item.valor)}</div>
        </div>
        <div style="font-size:12px;color:var(--text-muted)">Confirmada</div>
      </div>`).join('') : ''}
    ${!fechamentoDespesasExtras.length && !fechamentoDespesasConfirmadas.length ? `<div class="empty"><i class="ti ti-receipt"></i><p>Nenhuma despesa extra adicionada.</p></div>` : ''}`;
}

window.adicionarDespesaExtra = function() {
  const desc = document.getElementById('fechamento-extra-desc').value.trim();
  const valor = document.getElementById('fechamento-extra-valor').value;
  if (!desc || !valor) { toast('Informe a descrição e o valor da despesa extra'); return; }
  fechamentoDespesasExtras.push({ descricao: desc, valor });
  document.getElementById('fechamento-extra-desc').value = '';
  document.getElementById('fechamento-extra-valor').value = '';
  renderFechamentoCaixa();
};

window.confirmarDespesaExtra = function(index) {
  const item = fechamentoDespesasExtras.splice(index, 1)[0];
  if (!item) return;
  fechamentoDespesasConfirmadas.push(item);
  renderFechamentoCaixa();
};

window.removerDespesaExtra = function(index, tipo = 'pendente') {
  if (tipo === 'pendente') fechamentoDespesasExtras.splice(index, 1);
  else fechamentoDespesasConfirmadas.splice(index, 1);
  renderFechamentoCaixa();
};

window.salvarFechamentoCaixa = async function(inicio, fim, totalReceber, totalRepasse, totalEncargos, totalDiarias, totalEtapas, totalExtras, lucro) {
  if (!inicio || !fim) { toast('Informe as datas do período'); return; }
  const existente = db_fechamentos.find(f => f.periodoInicio === inicio && f.periodoFim === fim);
  if (existente) { toast('Este fechamento já foi salvo'); return; }
  const payload = {
    periodoInicio: inicio,
    periodoFim: fim,
    totalReceber,
    totalRepasse,
    totalEncargos,
    totalDiarias,
    totalEtapas,
    totalExtras,
    lucro,
    itens: (window._todasEtapas || []).filter(e => e.status === 'concluido' && estaNoPeriodo(e.dataConc, inicio, fim)).map(e => ({ id: e.id, tipo: e.tipo, valor: e.val, obraId: e.obraId, obraNome: e.obraNome, isDiaria: !!(e.isDiaria || e.isDiariaAvulsa) })),
    parceiros: Object.values((() => {
      const grupos = {};
      (window._todasEtapas || []).filter(e => e.status === 'concluido' && estaNoPeriodo(e.dataConc, inicio, fim)).forEach(e => {
        const lista = Array.isArray(e.parceiros) && e.parceiros.length ? e.parceiros : [];
        if (lista.length) {
          lista.forEach(p => {
            const key = p.parceiroId || p.nome;
            if (!grupos[key]) grupos[key] = { parceiroId: p.parceiroId || null, nome: p.nome || 'Parceiro', valor: 0 };
            grupos[key].valor += parseBRL(p.repasse);
          });
        } else if (e.valRepasse) {
          const key = e.parceiroNome || 'Parceiro não identificado';
          if (!grupos[key]) grupos[key] = { parceiroId: e.parceiroId || null, nome: key, valor: 0 };
          grupos[key].valor += parseBRL(e.valRepasse);
        }
      });
      return grupos;
    })())
  };
  await criarFechamentoCaixa(payload);
  toast('Fechamento de caixa salvo');
  renderFechamentoCaixa();
}

function updateBadge() {
  const nOrcamentos = db_orcamentos.filter(o => o.status === 'pendente').length;
  const nPagamentos = db_pagamentosAdmin.filter(p => p.status === 'pendente').length;
  const nSolicitacoes = db_solicitacoes.filter(s => s.status === 'pendente').length;
  const nContestacoes = db_solicitacoesPagamento.filter(s => s.status === 'contestada').length;
  const nNotificacoes = db_notificacoesAdmin.filter(n => !n.lida).length;
  const total = nOrcamentos + nPagamentos + nSolicitacoes + nContestacoes + nNotificacoes;
  const dot = document.getElementById('dot-aprov');
  if (dot) dot.classList.toggle('show', total > 0);
}
function updateBadgeSolicitacoes() {
  const n = db_solicitacoes.filter(s => s.status === 'pendente').length;
  updateBadge();
  const secao = document.getElementById('secao-solicitacoes');
  if (secao) secao.style.display = db_solicitacoes.length ? 'block' : 'none';
  const badge = document.getElementById('badge-solicitacoes');
  if (badge) badge.textContent = n > 0 ? n : '';
  atualizarAprovacaoVazia();
}

// ============================================================
// OBRAS
// ============================================================
function renderObras() {
  const ativas = db_obras.filter(o => o.status !== 'lixeira');
  const and = ativas.filter(o => o.status === 'andamento').length;
  const conc = ativas.filter(o => o.status === 'concluida').length;
  document.getElementById('s-total').textContent = ativas.length;
  document.getElementById('s-and').textContent = and;
  document.getElementById('s-conc').textContent = conc;
  const obrasExibidas = filtrarObras(ativas, fechamentoClienteSelecionado, usuariosClientesById());
  const el = document.getElementById('lista-obras');
  if (!obrasExibidas.length) { el.innerHTML = `<div class="empty"><i class="ti ti-building-off"></i><p>Nenhuma obra ${fechamentoClienteSelecionado ? 'em execução para este filtro' : 'cadastrada'}.</p></div>`; renderFechamentoResumo(); return; }
  el.innerHTML = obrasExibidas.map(o => {
    const cliente = db_clientes.find(c => c.id === o.clienteId);
    const atrasada = o.status === 'andamento' && o.fim && o.fim < hoje();
    const pgBadge = o.pagObra ? `<span class="badge ${o.pagObra === 'pago' ? 'badge-aprov' : o.pagObra === 'parcial' ? 'badge-exec' : 'badge-pend'}" style="font-size:10px">${o.pagObra === 'pago' ? 'Pago' : o.pagObra === 'parcial' ? 'Parcial' : 'A pagar'}</span>` : '';
    return `<div class="list-card" onclick="abrirObra('${o.id}')">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
        <div style="flex:1;min-width:0">
          <div style="font-size:16px;font-weight:600">${o.nome}</div>
          ${o.local ? `<div style="font-size:12px;color:var(--text-muted)">${o.local}</div>` : ''}
          ${cliente ? `<div style="font-size:11px;color:var(--text-accent)"><i class="ti ti-user"></i> ${cliente.nome}</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
          <span class="badge ${o.status === 'andamento' ? 'badge-and' : 'badge-done'}">${o.status === 'andamento' ? 'Em andamento' : 'Concluída'}</span>
          ${pgBadge}
          <button class="btn-sm btn-danger" onclick="event.stopPropagation();excluirObraAcao('${o.id}')" style="font-size:10px;padding:4px 8px"><i class="ti ti-trash"></i></button>
        </div>
      </div>
      ${atrasada ? `<div class="alert-box alert-danger"><i class="ti ti-alert-triangle"></i>Prazo vencido</div>` : ''}
    </div>`;
  }).join('');
  renderFechamentoResumo();
}

window.salvarObra = async function() {
  const nome = document.getElementById('obra-nome').value.trim();
  if (!nome) { toast('Informe o nome da obra'); return; }
  const clienteId = document.getElementById('obra-cliente').value || null;
  // Verificação extra: se clienteId existir, confirma que é um UID válido
  if (clienteId && clienteId.length < 10) { toast('Selecione um cliente válido'); return; }
  const dados = {
    nome,
    clienteId,
    local: document.getElementById('obra-local').value.trim(),
    inicio: document.getElementById('obra-inicio').value,
    fim: document.getElementById('obra-fim').value,
    valorPrevisto: document.getElementById('obra-valor-previsto').value || '0,00',
    desc: document.getElementById('obra-desc').value.trim(),
    mostrarPedreiro: document.getElementById('obra-mostrar-pedreiro').checked
  };
  const novaObraId = await criarObra(dados);
  if (clienteId) {
    criarNotificacao({
      destinatarioTipo: 'cliente', clienteId, obraId: novaObraId, obraNome: nome,
      tipo: 'obra_criada', titulo: 'Obra iniciada',
      mensagem: `A obra "${nome}" foi criada e está em preparação.`,
      linkPagina: 'obras', linkId: novaObraId
    });
  }
  window.closeModal('modal-nova-obra');
  ['obra-nome','obra-local','obra-inicio','obra-fim','obra-valor-previsto','obra-desc'].forEach(i => document.getElementById(i).value = '');
  toast('Obra criada');
};

window.abrirObra = function(id) {
  obraAtiva = db_obras.find(o => o.id === id);
  document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById('page-obra-detalhe').classList.add('active');
  document.getElementById('topbar-content').innerHTML = `<h1 style="font-size:15px">${obraAtiva.nome}</h1>`;
  if (unsubEtapasAtivas) unsubEtapasAtivas();
  unsubEtapasAtivas = escutarEtapas(id, etapas => { obraAtiva._etapas = etapas; renderDetalheObra(); });
  if (unsubEncargos) unsubEncargos();
  unsubEncargos = escutarEncargos(id, enc => { obraAtiva._encargos = enc; renderEncargos(); });
};

function renderDetalheObra() {
  if (!obraAtiva) return;
  const o = obraAtiva;
  const etapas = o._etapas || [];
  const done = etapas.filter(e => e.status === 'concluido').length;
  const pct = etapas.length ? Math.round(done / etapas.length * 100) : 0;
  const gastoEtapas = etapas.reduce((s, e) => s + parseBRL(e.val), 0);
  const gastoEncargos = (o._encargos || []).reduce((s, e) => s + parseBRL(e.valor), 0);
  const totalCliente = gastoEtapas + gastoEncargos;
  const totalRepasse = etapas.reduce((s, e) => s + parseBRL(e.valRepasse), 0);
  const margem = totalCliente - totalRepasse;
  const cliente = db_clientes.find(c => c.id === o.clienteId);
  const atrasada = o.status === 'andamento' && o.fim && o.fim < hoje();

  const previsto = parseBRL(o.valorPrevisto);
  const alertaPrevisto = previsto > 0 && totalCliente > previsto
    ? `<div class="alert-box alert-danger" style="margin-top:8px"><i class="ti ti-alert-triangle"></i> Valor atual (${fmtBRL(totalCliente)}) ultrapassou o previsto (${fmtBRL(previsto)})</div>`
    : previsto > 0 && totalCliente >= previsto * 0.8
    ? `<div class="alert-box alert-warning" style="margin-top:8px"><i class="ti ti-alert-circle"></i> ${Math.round(totalCliente/previsto*100)}% do valor previsto atingido</div>`
    : '';

  const orcamentosObra = db_orcamentos.filter(x => x.obraId === o.id).sort((a,b) => (b.criadoEm?.toMillis?.()||0) - (a.criadoEm?.toMillis?.()||0));
  const orcamentoAtivo = orcamentosObra[0] || null;
  const bloqueada = !!orcamentoAtivo && orcamentoAtivo.status !== 'aprovado';
  const orcamentoBanner = !orcamentoAtivo ? '' : orcamentoAtivo.status === 'pendente'
    ? `<div class="alert-box alert-warning" style="margin-top:8px"><i class="ti ti-file-invoice"></i> Orçamento de ${fmtBRL(orcamentoAtivo.valor)} aguardando aprovação do cliente — obra bloqueada</div>`
    : orcamentoAtivo.status === 'rejeitado'
    ? `<div class="alert-box alert-danger" style="margin-top:8px"><i class="ti ti-x"></i> Orçamento rejeitado pelo cliente${orcamentoAtivo.motivo ? ': ' + orcamentoAtivo.motivo : ''}. Envie um novo orçamento para liberar a obra.</div>`
    : '';

  document.getElementById('obra-detalhe-header').innerHTML = `
    <div class="card">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:10px">
        <span class="badge ${o.status === 'andamento' ? 'badge-and' : 'badge-done'}">${o.status === 'andamento' ? 'Em andamento' : 'Concluída'}</span>
        <div style="display:flex;gap:6px">
          ${o.status === 'andamento' ? `<button class="btn-sm btn-success" onclick="concluirObra('${o.id}')" style="font-size:11px">Concluir</button>` : ''}
          <button class="btn-sm btn-danger" onclick="confirmarExcluirObra('${o.id}')" style="font-size:11px"><i class="ti ti-trash"></i></button>
        </div>
      </div>
      ${cliente ? `<div style="font-size:12px;color:var(--text-accent);margin-bottom:6px"><i class="ti ti-user"></i> ${cliente.nome}</div>` : ''}
      ${atrasada ? `<div class="alert-box alert-danger"><i class="ti ti-alert-triangle"></i>Prazo vencido</div>` : ''}
      ${alertaPrevisto}
      ${orcamentoBanner}
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:8px">
        <div class="stat"><span class="stat-val" style="font-size:14px">${fmtBRL(totalCliente)}</span><span class="stat-lbl">Valor cliente${previsto > 0 ? ` / ${fmtBRL(previsto)}` : ''}</span></div>
        <div class="stat"><span class="stat-val" style="font-size:14px">${fmtBRL(totalRepasse)}</span><span class="stat-lbl">Repasse</span></div>
        <div class="stat"><span class="stat-val" style="font-size:14px;color:var(--text-success)">${fmtBRL(margem)}</span><span class="stat-lbl">Margem</span></div>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${done}/${etapas.length} etapas — ${pct}%</div>
      <!-- FINANCEIRO DA OBRA -->
      <div class="divider"></div>
      <div style="font-size:13px;font-weight:600;margin-bottom:8px">Financeiro da obra</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
        <div>
          <label>Status de pagamento</label>
          <select id="obra-pag-status" onchange="salvarFinanceiroObra()">
            <option value="a_pagar" ${(o.pagObra||'a_pagar')==='a_pagar'?'selected':''}>A pagar</option>
            <option value="parcial" ${o.pagObra==='parcial'?'selected':''}>Pago parcialmente</option>
            <option value="pago" ${o.pagObra==='pago'?'selected':''}>Pago integralmente</option>
          </select>
        </div>
        <div>
          <label>Valor de entrada recebido</label>
          <input type="text" id="obra-entrada" value="${o.entrada||''}" placeholder="0,00" oninput="fmtVal(this)" onchange="salvarFinanceiroObra()">
        </div>
      </div>
      ${o.status === 'andamento' && cliente ? `<button class="btn-sm" onclick="abrirOrcamento()" style="justify-content:center;padding:10px;width:100%;margin-top:12px;border-color:#3b82f6;color:#1d4ed8;background:#dbeafe"><i class="ti ti-file-invoice"></i> ${orcamentoAtivo && orcamentoAtivo.status==='pendente' ? 'Orçamento em análise' : 'Enviar orçamento'}</button>` : ''}
      ${o.status === 'andamento' && !bloqueada ? `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:8px">
        <button class="btn-sm btn-success" onclick="abrirNovaEtapa()" style="justify-content:center;padding:10px"><i class="ti ti-plus"></i> Etapa</button>
        <button class="btn-sm" onclick="abrirNovaDiaria()" style="justify-content:center;padding:10px;border-color:#a78bfa;color:#6d28d9;background:#ede9fe"><i class="ti ti-calendar-plus"></i> Diária</button>
        <button class="btn-sm" onclick="abrirEncargo()" style="justify-content:center;padding:10px"><i class="ti ti-receipt"></i> Encargo</button>
      </div>` : ''}
    </div>`;
  renderEtapas();
}

window.abrirOrcamento = function() {
  if (!obraAtiva) return;
  const orcamentosObra = db_orcamentos.filter(x => x.obraId === obraAtiva.id);
  const pendente = orcamentosObra.find(x => x.status === 'pendente');
  if (pendente) { toast('Já existe um orçamento aguardando resposta do cliente'); return; }
  document.getElementById('orc-valor').value = '';
  document.getElementById('orc-desc').value = '';
  window.showModal('modal-orcamento');
};

window.salvarOrcamento = async function() {
  if (!obraAtiva) return;
  const valor = document.getElementById('orc-valor').value;
  const descricao = document.getElementById('orc-desc').value.trim();
  if (!valor) { toast('Informe o valor do orçamento'); return; }
  if (!obraAtiva.clienteId) { toast('Esta obra não tem cliente vinculado'); return; }
  await enviarOrcamento({ obraId: obraAtiva.id, obraNome: obraAtiva.nome, clienteId: obraAtiva.clienteId, valor, descricao });
  window.closeModal('modal-orcamento');
  toast('Orçamento enviado ao cliente');
};

window.salvarFinanceiroObra = async function() {
  const status = document.getElementById('obra-pag-status').value;
  const entrada = document.getElementById('obra-entrada').value;
  await atualizarObra(obraAtiva.id, { pagObra: status, entrada });
};

window.concluirObra = async function(id) {
  if (!confirm('Confirmar conclusão da obra?')) return;
  await atualizarObra(id, { status: 'concluida', dataConc: hoje() });
  const o = db_obras.find(x => x.id === id);
  if (o && o.clienteId) {
    criarNotificacao({
      destinatarioTipo: 'cliente', clienteId: o.clienteId, obraId: id, obraNome: o.nome,
      tipo: 'obra_concluida', titulo: 'Obra concluída',
      mensagem: `A obra "${o.nome}" foi concluída. Deixe sua avaliação sobre o serviço.`,
      linkPagina: 'obras', linkId: id
    });
  }
  toast('Obra concluída');
};

window.excluirObraAcao = async function(id) {
  if (!confirm('Enviar esta obra para a lixeira? Ela pode ser restaurada depois.')) return;
  await excluirObra(id);
  renderObras(); renderLixeira();
  toast('Obra enviada para a lixeira');
};

window.confirmarExcluirObra = async function(id) {
  window.excluirObraAcao(id);
};

window.restaurarObraAcao = async function(id) {
  if (!confirm('Restaurar esta obra?')) return;
  await restaurarObra(id);
  renderObras(); renderLixeira();
  toast('Obra restaurada');
};

window.limparLixeira = async function() {
  const excluidas = db_obras.filter(o => o.status === 'lixeira');
  if (!excluidas.length) { toast('A lixeira já está vazia'); return; }
  if (!confirm('Limpar permanentemente todas as obras da lixeira? Essa ação não pode ser desfeita.')) return;
  await Promise.all(excluidas.map(o => limparLixeiraObra(o.id)));
  renderObras(); renderLixeira();
  toast('Lixeira limpa');
};

function renderLixeira() {
  const el = document.getElementById('lista-lixeira');
  if (!el) return;
  const excluidas = db_obras.filter(o => o.status === 'lixeira');
  if (!excluidas.length) {
    el.innerHTML = `<div class="empty"><i class="ti ti-trash"></i><p>A lixeira está vazia.</p></div>`;
    return;
  }
  el.innerHTML = excluidas.map(o => `
    <div class="card" style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
        <div>
          <div style="font-size:15px;font-weight:600">${o.nome}</div>
          ${o.local ? `<div style="font-size:12px;color:var(--text-muted)">${o.local}</div>` : ''}
        </div>
        <span class="badge badge-pend">Na lixeira</span>
      </div>
      <div class="confirm-bar" style="margin-top:10px">
        <button class="btn-sm btn-success" onclick="restaurarObraAcao('${o.id}')"><i class="ti ti-arrow-back-up"></i> Restaurar</button>
        <button class="btn-sm btn-danger" onclick="limparLixeiraObraAcao('${o.id}')"><i class="ti ti-trash"></i> Excluir permanentemente</button>
      </div>
    </div>`).join('');
}

window.limparLixeiraObraAcao = async function(id) {
  if (!confirm('Excluir permanentemente esta obra?')) return;
  await limparLixeiraObra(id);
  renderObras(); renderLixeira();
  toast('Obra removida da lixeira');
};

// ============================================================
// ENCARGOS
// ============================================================
function renderEncargos() {
  const encargos = obraAtiva._encargos || [];
  const el = document.getElementById('obra-encargos-area');
  if (!encargos.length) { el.innerHTML = ''; return; }
  const total = encargos.reduce((s, e) => s + parseBRL(e.valor), 0);
  el.innerHTML = `<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><span style="font-size:14px;font-weight:600">Encargos extras</span><span style="font-size:13px;color:var(--text-success);font-weight:600">${fmtBRL(total)}</span></div>` +
    encargos.map(e => `<div class="row-item">
      <div class="row-info"><div class="row-title">${e.descricao}</div><div class="row-meta">${fmtBRL(e.valor)}</div></div>
      <div class="row-actions">
        ${e.comprovante ? `<button class="btn-sm" onclick="openLightbox('${e.comprovante}','Comprovante')"><i class="ti ti-receipt"></i></button>` : ''}
        <button class="btn-sm btn-danger" onclick="removerEncargo('${e.id}')"><i class="ti ti-trash"></i></button>
      </div>
    </div>`).join('') + `</div>`;
}

window.abrirEncargo = function() {
  encFoto = null;
  document.getElementById('enc-desc').value = '';
  document.getElementById('enc-valor').value = '';
  document.getElementById('enc-prev-comprovante').style.display = 'none';
  document.getElementById('enc-icon-comprovante').style.display = 'flex';
  window.showModal('modal-encargo');
};
window.salvarEncargo = async function() {
  const descricao = document.getElementById('enc-desc').value.trim();
  const valor = document.getElementById('enc-valor').value;
  if (!descricao || !valor) { toast('Preencha descrição e valor'); return; }
  const btn = document.getElementById('btn-salvar-encargo'); btn.disabled = true; btn.textContent = 'Salvando...';
  try {
    let url = null;
    if (encFoto) url = await uploadFoto(encFoto, `obras/${obraAtiva.id}/encargos/${Date.now()}.jpg`);
    await criarEncargo(obraAtiva.id, { descricao, valor, comprovante: url });
    window.closeModal('modal-encargo'); toast('Encargo adicionado');
  } catch(e) { toast('Erro ao salvar'); }
  btn.disabled = false; btn.textContent = 'Adicionar encargo';
};
window.removerEncargo = async function(id) {
  if (!confirm('Remover encargo?')) return;
  await excluirEncargo(obraAtiva.id, id); toast('Encargo removido');
};

// ============================================================
// ETAPAS — com repasse e diárias
// ============================================================
window.onTipoChange = function() {
  const val = document.getElementById('et-tipo').value;
  const boxM2 = document.getElementById('box-metros');
  const boxToggle = document.getElementById('box-toggle-custom');
  const boxSugerido = document.getElementById('preco-sugerido-box');
  const boxDiaria = document.getElementById('box-diarias');
  const boxRepasse = document.getElementById('box-repasse');

  // reset
  document.getElementById('toggle-custom').checked = false;
  document.getElementById('valor-custom-box').classList.remove('show');
  boxM2.style.display = 'none';
  boxToggle.style.display = 'none';
  boxSugerido.classList.remove('show');
  boxDiaria.style.display = 'none';
  boxRepasse.style.display = 'none';
  document.getElementById('box-outros').style.display = 'none';
  document.getElementById('et-metros').value = '';
  document.getElementById('et-valor-calc').value = '';
  document.getElementById('et-repasse-calc').value = '';
  document.getElementById('et-outros-desc').value = '';
  document.getElementById('et-outros-val').value = '';
  document.getElementById('et-outros-repasse').value = '';

  if (val.startsWith('servico:')) {
    const nomeServico = val.replace('servico:', '');
    const preco = db_precos.find(p => p.nome === nomeServico);
    const repasse = db_repasses.find(r => r.nome === nomeServico);
    if (preco) {
      document.getElementById('preco-sugerido-info').textContent = `Preço cliente: R$ ${preco.val}/m²${repasse ? ` | Repasse: R$ ${repasse.val}/m²` : ' | Sem repasse cadastrado'}`;
      boxSugerido.classList.add('show');
      boxM2.style.display = 'grid';
      boxToggle.style.display = 'flex';
      boxRepasse.style.display = 'block';
      const metrosEl = document.getElementById('et-metros');
      metrosEl.oninput = () => calcularValor();
      metrosEl.readOnly = false;
    }
  } else if (val === 'diaria') {
    boxDiaria.style.display = 'block';
    boxRepasse.style.display = 'block';
    renderLinhasDiarias();
  } else if (val === 'outros') {
    document.getElementById('box-outros').style.display = 'block';
  }
};

function calcularValor() {
  if (document.getElementById('toggle-custom').checked) return;
  const val = document.getElementById('et-tipo').value;
  if (!val.startsWith('servico:')) return;
  const nomeServico = val.replace('servico:', '');
  const preco = db_precos.find(p => p.nome === nomeServico);
  const repasse = db_repasses.find(r => r.nome === nomeServico);
  const metros = parseFloat(document.getElementById('et-metros').value) || 0;
  if (preco) {
    const totalCliente = metros * parseBRL(preco.val);
    document.getElementById('et-valor-calc').value = totalCliente > 0 ? totalCliente.toFixed(2).replace('.', ',') : '';
    document.getElementById('preco-sugerido-calc').textContent = metros > 0 ? `${metros} m² × R$ ${preco.val} = ${fmtBRL(totalCliente)}` : 'Informe m² para calcular.';
  }
  if (repasse) {
    const totalRepasse = metros * parseBRL(repasse.val);
    document.getElementById('et-repasse-calc').value = totalRepasse > 0 ? totalRepasse.toFixed(2).replace('.', ',') : '';
  }
}
window.calcularValor = calcularValor;

window.recalcularComCustom = function() {
  const novoPreco = parseBRL(document.getElementById('et-valor-custom').value);
  const metros = parseFloat(document.getElementById('et-metros').value) || 0;
  const total = novoPreco * metros;
  document.getElementById('et-valor-calc').value = total > 0 ? total.toFixed(2).replace('.', ',') : '';
  if (metros > 0 && novoPreco > 0)
    document.getElementById('preco-sugerido-calc').textContent = `${metros} m² × R$ ${document.getElementById('et-valor-custom').value} = ${fmtBRL(total)} (personalizado)`;
};

window.toggleCustomVal = function() {
  const on = document.getElementById('toggle-custom').checked;
  document.getElementById('valor-custom-box').classList.toggle('show', on);
  const metrosEl = document.getElementById('et-metros');
  if (on) {
    metrosEl.oninput = null; metrosEl.readOnly = true;
    metrosEl.style.background = 'var(--surface-1)'; metrosEl.style.color = 'var(--text-muted)';
    document.getElementById('et-valor-custom').value = ''; document.getElementById('et-valor-calc').value = '';
  } else {
    metrosEl.readOnly = false; metrosEl.style.background = ''; metrosEl.style.color = '';
    metrosEl.oninput = () => calcularValor();
    document.getElementById('et-valor-custom').value = ''; calcularValor();
  }
};

// Diárias
let linhasDiarias = [];
// Parceiros múltiplos da etapa
let parceirosDaEtapa = []; // [{parceiroId, nome, repasse}]
let parceirosDaEtapaEdit = [];

function renderParceirosDaEtapa(listId, parceiros, repasseTotal, onRemove, onRepasseChange) {
  const el = document.getElementById(listId); if (!el) return;
  if (!parceiros.length) { el.innerHTML = `<div style="font-size:12px;color:var(--text-muted);padding:6px 0">Nenhum parceiro adicionado</div>`; return; }
  el.innerHTML = parceiros.map((p, i) => `<div class="row-item" style="align-items:center">
    <div class="row-info"><div class="row-title" style="font-size:13px">${p.nome}</div></div>
    <div style="display:flex;align-items:center;gap:6px">
      <input type="text" value="${p.repasse}" placeholder="R$ repasse" style="width:100px;padding:6px 8px;font-size:12px;border:0.5px solid var(--border-strong);border-radius:var(--radius);background:var(--surface-2);color:var(--text-primary)"
        oninput="this.value=this.value.replace(/[^0-9,]/g,'');${onRepasseChange}(${i},this.value)">
      <button class="btn-sm btn-danger" onclick="${onRemove}(${i})" style="padding:5px 8px"><i class="ti ti-trash"></i></button>
    </div>
  </div>`).join('');
}

window.adicionarParceiroEtapa = function() {
  const sel = document.getElementById('et-parceiro-add');
  const id = sel.value;
  if (!id) { toast('Selecione um parceiro'); return; }
  if (parceirosDaEtapa.find(p => p.parceiroId === id)) { toast('Parceiro já adicionado'); return; }
  const p = db_parceiros.find(x => x.id === id);
  if (!p) { toast('Parceiro não encontrado'); return; }
  const repasseEl = document.getElementById('et-repasse-calc');
  const totalRepasse = repasseEl ? parseBRL(repasseEl.value) : 0;
  parceirosDaEtapa.push({ parceiroId: id, nome: p.nome, repasse: '' });
  if (totalRepasse > 0) distribuirRepasseIgual(parceirosDaEtapa, totalRepasse);
  sel.value = '';
  renderParceirosDaEtapa('lista-parceiros-etapa', parceirosDaEtapa, totalRepasse, 'removerParceiroEtapa', 'editarRepasseParceiro');
};
window.removerParceiroEtapa = function(i) {
  parceirosDaEtapa.splice(i, 1);
  const repasseEl = document.getElementById('et-repasse-calc');
  const total = repasseEl ? parseBRL(repasseEl.value) : 0;
  if (total > 0) distribuirRepasseIgual(parceirosDaEtapa, total);
  renderParceirosDaEtapa('lista-parceiros-etapa', parceirosDaEtapa, total, 'removerParceiroEtapa', 'editarRepasseParceiro');
};
window.editarRepasseParceiro = function(i, val) { parceirosDaEtapa[i].repasse = val; };

window.adicionarParceiroEtapaEdit = function() {
  const sel = document.getElementById('edit-et-parceiro-add');
  const id = sel.value;
  if (!id) { toast('Selecione um parceiro'); return; }
  if (parceirosDaEtapaEdit.find(p => p.parceiroId === id)) { toast('Parceiro já adicionado'); return; }
  const p = db_parceiros.find(x => x.id === id);
  const totalRepasse = parseBRL(document.getElementById('edit-et-repasse').value);
  parceirosDaEtapaEdit.push({ parceiroId: id, nome: p.nome, repasse: '' });
  distribuirRepasseIgual(parceirosDaEtapaEdit, totalRepasse);
  sel.value = '';
  renderParceirosDaEtapa('edit-lista-parceiros-etapa', parceirosDaEtapaEdit, totalRepasse, 'removerParceiroEtapaEdit', 'editarRepasseParceiroEdit');
};
window.removerParceiroEtapaEdit = function(i) {
  parceirosDaEtapaEdit.splice(i, 1);
  const total = parseBRL(document.getElementById('edit-et-repasse').value);
  distribuirRepasseIgual(parceirosDaEtapaEdit, total);
  renderParceirosDaEtapa('edit-lista-parceiros-etapa', parceirosDaEtapaEdit, total, 'removerParceiroEtapaEdit', 'editarRepasseParceiroEdit');
};
window.editarRepasseParceiroEdit = function(i, val) { parceirosDaEtapaEdit[i].repasse = val; };

window.atualizarRepasseIndividual = function() {
  const total = parseBRL(document.getElementById('et-repasse-calc').value);
  distribuirRepasseIgual(parceirosDaEtapa, total);
  renderParceirosDaEtapa('lista-parceiros-etapa', parceirosDaEtapa, total, 'removerParceiroEtapa', 'editarRepasseParceiro');
};
window.atualizarRepasseIndividualEdit = function() {
  const total = parseBRL(document.getElementById('edit-et-repasse').value);
  distribuirRepasseIgual(parceirosDaEtapaEdit, total);
  renderParceirosDaEtapa('edit-lista-parceiros-etapa', parceirosDaEtapaEdit, total, 'removerParceiroEtapaEdit', 'editarRepasseParceiroEdit');
};

function distribuirRepasseIgual(parceiros, total) {
  if (!parceiros.length || !total) return;
  const parte = (total / parceiros.length).toFixed(2).replace('.', ',');
  parceiros.forEach(p => p.repasse = parte);
}
function renderLinhasDiarias() {
  const el = document.getElementById('lista-linhas-diarias');
  if (!linhasDiarias.length) { el.innerHTML = `<div style="font-size:12px;color:var(--text-muted);text-align:center;padding:8px">Nenhuma diária adicionada</div>`; return; }
  el.innerHTML = linhasDiarias.map((l, i) => `<div class="row-item">
    <div class="row-info"><div class="row-title">${l.nome}</div><div class="row-meta">${l.qtd} diária(s) × R$ ${l.val} = ${fmtBRL(l.qtd * parseBRL(l.val))}</div></div>
    <button class="btn-sm btn-danger" onclick="removerLinhaDiaria(${i})"><i class="ti ti-trash"></i></button>
  </div>`).join('');
  const total = linhasDiarias.reduce((s, l) => s + l.qtd * parseBRL(l.val), 0);
  document.getElementById('et-valor-calc').value = total > 0 ? total.toFixed(2).replace('.', ',') : '';
  document.getElementById('et-repasse-calc').value = total > 0 ? total.toFixed(2).replace('.', ',') : '';
}

window.adicionarLinhaDiaria = function() {
  const sel = document.getElementById('diaria-tipo');
  const qtd = parseInt(document.getElementById('diaria-qtd').value) || 0;
  const diaria = db_diarias.find(d => d.id === sel.value);
  if (!diaria) { toast('Selecione o tipo de diária'); return; }
  if (!qtd || qtd < 1) { toast('Informe a quantidade'); return; }
  linhasDiarias.push({ diariaId: diaria.id, nome: diaria.nome, val: diaria.val, qtd });
  sel.value = ''; document.getElementById('diaria-qtd').value = '';
  renderLinhasDiarias();
};

window.removerLinhaDiaria = function(i) { linhasDiarias.splice(i, 1); renderLinhasDiarias(); };

function popularSelectDiarias() {
  const sel = document.getElementById('diaria-tipo');
  sel.innerHTML = `<option value="">Tipo de diária...</option>`;
  db_diarias.forEach(d => { const o = document.createElement('option'); o.value = d.id; o.textContent = `${d.nome} — R$ ${d.val}/dia`; sel.appendChild(o); });
}

window.abrirNovaEtapa = function() {
  etFotos = {}; linhasDiarias = []; parceirosDaEtapa = [];
  document.getElementById('et-inicio').value = hoje();
  document.getElementById('et-prev-antes').style.display = 'none';
  document.getElementById('et-icon-antes').style.display = 'flex';
  ['et-prazo','et-obs','et-valor-custom','et-motivo','et-metros','et-valor-calc','et-repasse-calc','et-detalhe-interno'].forEach(i => { const el = document.getElementById(i); if (el) el.value = ''; });
  document.getElementById('toggle-custom').checked = false;
  document.getElementById('valor-custom-box').classList.remove('show');
  document.getElementById('preco-sugerido-box').classList.remove('show');
  document.getElementById('box-metros').style.display = 'none';
  document.getElementById('box-toggle-custom').style.display = 'none';
  document.getElementById('box-diarias').style.display = 'none';
  document.getElementById('box-repasse').style.display = 'none';
  document.getElementById('box-outros').style.display = 'none';
  document.getElementById('lista-parceiros-etapa').innerHTML = `<div style="font-size:12px;color:var(--text-muted);padding:6px 0">Nenhum parceiro adicionado</div>`;
  popularSelectTipos();
  popularSelectParceiros();
  popularSelectDiarias();
  window.showModal('modal-nova-etapa');
};

window.salvarEtapa = async function() {
  const tipoVal = document.getElementById('et-tipo').value;
  const inicio = document.getElementById('et-inicio').value;
  const prazo = document.getElementById('et-prazo').value;
  const obs = document.getElementById('et-obs').value.trim();
  const detalheInterno = document.getElementById('et-detalhe-interno').value.trim();
  if (!tipoVal) { toast('Selecione o tipo de serviço'); return; }
  if (!parceirosDaEtapa.length) { toast('Adicione pelo menos um parceiro responsável'); return; }
  const parceiroNomes = parceirosDaEtapa.map(p => p.nome).join(', ');

  let tipo, val, valRepasse = '', motivo = '', metros = null, isDiaria = false, linhas = [];

  if (tipoVal === 'diaria') {
    if (!linhasDiarias.length) { toast('Adicione pelo menos uma diária'); return; }
    tipo = 'Diárias';
    isDiaria = true;
    linhas = linhasDiarias;
    val = linhasDiarias.reduce((s, l) => s + l.qtd * parseBRL(l.val), 0).toFixed(2).replace('.', ',');
    valRepasse = document.getElementById('et-repasse-calc').value;
  } else if (tipoVal.startsWith('servico:')) {
    tipo = tipoVal.replace('servico:', '');
    const isCustom = document.getElementById('toggle-custom').checked;
    metros = document.getElementById('et-metros').value;
    if (isCustom) {
      val = document.getElementById('et-valor-calc').value;
      motivo = document.getElementById('et-motivo').value.trim();
      if (!val) { toast('Informe o novo preço/m²'); return; }
    } else {
      val = document.getElementById('et-valor-calc').value;
      if (!val) { toast('Informe a quantidade em m²'); return; }
    }
    valRepasse = document.getElementById('et-repasse-calc').value;
  } else {
    // Outros — valor manual
    const outrosDesc = document.getElementById('et-outros-desc').value.trim();
    tipo = outrosDesc || 'Outros';
    val = document.getElementById('et-outros-val').value;
    valRepasse = document.getElementById('et-outros-repasse').value;
    metros = null;
  }

  const btn = document.getElementById('btn-salvar-etapa'); btn.disabled = true; btn.textContent = 'Salvando...';
  try {
    let fotoAntesUrl = null;
    if (etFotos.antes) fotoAntesUrl = await uploadFoto(etFotos.antes, `obras/${obraAtiva.id}/etapas/${Date.now()}_antes.jpg`);
    await criarEtapa(obraAtiva.id, {
      tipo, parceiros: parceirosDaEtapa, parceiroNome: parceiroNomes,
      val, valRepasse, metros: metros || null,
      motivo, inicio, prazo, obs, detalheInterno, fotoAntes: fotoAntesUrl, fotosExtras: [],
      isDiaria, linhasDiarias: isDiaria ? linhas : []
    });
    if (obraAtiva.clienteId) {
      criarNotificacao({
        destinatarioTipo: 'cliente', clienteId: obraAtiva.clienteId, obraId: obraAtiva.id, obraNome: obraAtiva.nome,
        tipo: 'etapa_iniciada', titulo: 'Etapa em execução',
        mensagem: `A etapa "${tipo}" começou a ser executada.`,
        linkPagina: 'obras', linkId: obraAtiva.id
      });
    }
    window.closeModal('modal-nova-etapa'); toast('Etapa adicionada');
  } catch(e) { toast('Erro ao salvar etapa'); console.error(e); }
  btn.disabled = false; btn.textContent = 'Adicionar etapa';
};

function renderEtapas() {
  const etapas = obraAtiva._etapas || [];
  const el = document.getElementById('obra-etapas');
  if (!etapas.length) { el.innerHTML = `<div class="empty"><i class="ti ti-clipboard"></i><p>Nenhuma etapa ainda.</p></div>`; return; }
  const hoje_ = hoje();
  el.innerHTML = `<div class="card"><div style="font-size:14px;font-weight:600;margin-bottom:4px">Etapas (${etapas.length})</div>` +
  etapas.map(e => {
    const atrasada = e.status === 'execucao' && e.prazo && e.prazo < hoje_;
    const dr = e.prazo ? diasDiff(hoje_, e.prazo) : null;
    let tempoReal = '';
    if (e.status === 'concluido' && e.inicio && e.dataConc) { const d = diasDiff(e.inicio, e.dataConc); tempoReal = ` · ${d}d real`; }
    const margem = e.val && e.valRepasse ? parseBRL(e.val) - parseBRL(e.valRepasse) : null;
    const repasseInfo = e.valRepasse ? ` | Repasse: R$ ${e.valRepasse}` : '';
    const margemInfo = margem !== null ? ` | Margem: ${fmtBRL(margem)}` : '';
    const pgBadge = e.status === 'concluido' ? `<span class="badge ${e.pagamento==='pago'?'badge-aprov':'badge-apagar'}" style="margin-left:4px">${e.pagamento==='pago'?'Pago':'A pagar'}</span>` : '';
    return `<div class="row-item">
      <div class="row-info">
        <div class="row-title">${e.tipo}${e.isDiariaAvulsa ? ` 📅 ${e.dataDiaria || ''}` : e.isDiaria ? ' 📅' : ''}</div>
        <div class="row-meta">${e.isDiariaAvulsa ? (e.linhasDiarias||[]).map(l=>`${l.qtd}x ${l.nome}`).join(', ') : `${e.parceiroNome}${e.val ? ' · R$ ' + e.val : ''}${e.metros ? ' · ' + e.metros + 'm²' : ''}`}${tempoReal}</div>
        ${repasseInfo || margemInfo ? `<div style="font-size:10px;color:var(--text-accent)">${repasseInfo}${margemInfo}</div>` : ''}
        ${e.detalheInterno ? `<div style="font-size:10px;color:var(--text-warning)">📋 ${e.detalheInterno}</div>` : ''}
        ${e.motivo ? `<div style="font-size:10px;color:var(--text-warning)">Valor personalizado: ${e.motivo}</div>` : ''}
        ${atrasada ? `<div style="font-size:10px;color:var(--text-danger)">Atrasada</div>` : ''}
        ${!atrasada && dr !== null && e.status === 'execucao' ? `<div style="font-size:10px;color:var(--text-muted)">${dr >= 0 ? dr + 'd restante(s)' : 'no prazo'}</div>` : ''}
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end">
        <span class="badge ${e.status==='execucao'?'badge-exec':'badge-aprov'}">${e.status==='execucao'?'Execução':'Concluído'}</span>
        ${pgBadge}
        ${e.status==='execucao' ? `<button class="btn-sm" onclick="${e.isDiariaAvulsa ? `abrirEditarDiaria('${e.id}')` : `abrirEditarEtapa('${e.id}')`}" style="font-size:11px;padding:5px 8px"><i class="ti ti-edit"></i></button>` : ''}
        ${e.isDiariaAvulsa && e.status==='concluido' ? `<button class="btn-sm" onclick="abrirEditarDiaria('${e.id}')" style="font-size:11px;padding:5px 8px"><i class="ti ti-edit"></i></button>` : ''}
        ${e.status==='execucao' ? `<button class="btn-sm" onclick="abrirFotoExtra('${e.id}')" style="font-size:11px;padding:5px 8px"><i class="ti ti-camera-plus"></i></button>` : ''}
        ${e.isDiariaAvulsa && e.status==='execucao' ? `<button class="btn-sm btn-success" onclick="concluirDiariaAntiga('${e.id}')" style="font-size:11px;padding:5px 8px">Concluir</button>` : ''}
        ${!e.isDiariaAvulsa && e.status==='execucao' ? `<button class="btn-sm btn-success" onclick="abrirConcluir('${e.id}')" style="font-size:11px;padding:5px 8px">Concluir</button>` : ''}
        <button class="btn-sm btn-danger" onclick="excluirEtapaAcao('${e.id}')" style="font-size:11px;padding:5px 8px"><i class="ti ti-trash"></i></button>
      </div>
    </div>`;
  }).join('') + '</div>';
}

window.excluirEtapaAcao = async function(etId) {
  if (!confirm('Excluir esta etapa/diária permanentemente?')) return;
  try {
    await excluirEtapa(obraAtiva.id, etId);
    toast('Excluído com sucesso');
  } catch(e) { toast('Erro ao excluir'); console.error(e); }
};

window.concluirDiariaAntiga = async function(etId) {
  // Migra diária antiga (status execucao) para concluída
  const etapa = (obraAtiva._etapas || []).find(e => e.id === etId);
  await atualizarEtapa(obraAtiva.id, etId, { status: 'concluido', pagamento: (etapa && etapa.pagamento) || 'a_pagar', dataConc: hoje() });
  if (obraAtiva.clienteId && etapa) {
    criarNotificacao({
      destinatarioTipo: 'cliente', clienteId: obraAtiva.clienteId, obraId: obraAtiva.id, obraNome: obraAtiva.nome,
      tipo: 'etapa_concluida', titulo: 'Diária concluída',
      mensagem: `A diária "${etapa.tipo}" foi concluída.`,
      linkPagina: 'obras', linkId: obraAtiva.id
    });
  }
  toast('Diária concluída');
};

window.abrirFotoExtra = function(etId) {
  etapaFotoExtraId = etId; extraFoto = null;
  document.getElementById('extra-legenda').value = '';
  document.getElementById('extra-prev-foto').style.display = 'none';
  document.getElementById('extra-icon-foto').style.display = 'flex';
  window.showModal('modal-foto-extra');
};
window.salvarFotoExtra = async function() {
  if (!extraFoto) { toast('Selecione uma foto'); return; }
  const btn = document.getElementById('btn-salvar-foto-extra'); btn.disabled = true; btn.textContent = 'Enviando...';
  try {
    const url = await uploadFoto(extraFoto, `obras/${obraAtiva.id}/etapas/extras/${Date.now()}.jpg`);
    const legenda = document.getElementById('extra-legenda').value.trim();
    const etapa = (obraAtiva._etapas || []).find(e => e.id === etapaFotoExtraId);
    await atualizarEtapa(obraAtiva.id, etapaFotoExtraId, { fotosExtras: [...(etapa.fotosExtras || []), { url, legenda }] });
    window.closeModal('modal-foto-extra'); toast('Foto adicionada');
  } catch(e) { toast('Erro ao enviar foto'); }
  btn.disabled = false; btn.textContent = 'Adicionar foto';
};

window.abrirConcluir = function(etId) {
  etapaConclId = etId; concFoto = null;
  document.getElementById('conc-data').value = hoje();
  document.getElementById('conc-obs').value = '';
  document.getElementById('conc-prev-depois').style.display = 'none';
  document.getElementById('conc-icon-depois').style.display = 'flex';
  window.showModal('modal-concluir');
};
window.confirmarConclusao = async function() {
  const dataConc = document.getElementById('conc-data').value;
  if (!dataConc) { toast('Informe a data de conclusão'); return; }
  const btn = document.getElementById('btn-concluir-etapa'); btn.disabled = true; btn.textContent = 'Salvando...';
  try {
    let fotoDepoisUrl = null;
    if (concFoto) fotoDepoisUrl = await uploadFoto(concFoto, `obras/${obraAtiva.id}/etapas/${Date.now()}_depois.jpg`);
    const etapa = (obraAtiva._etapas || []).find(e => e.id === etapaConclId);
    const tempoReal = etapa.inicio ? diasDiff(etapa.inicio, dataConc) : null;
    await atualizarEtapa(obraAtiva.id, etapaConclId, { status: 'concluido', dataConc, obsConc: document.getElementById('conc-obs').value.trim(), fotoDepois: fotoDepoisUrl, pagamento: etapa.pagamento || 'a_pagar', tempoReal });
    if (obraAtiva.clienteId) {
      criarNotificacao({
        destinatarioTipo: 'cliente', clienteId: obraAtiva.clienteId, obraId: obraAtiva.id, obraNome: obraAtiva.nome,
        tipo: 'etapa_concluida', titulo: 'Etapa concluída',
        mensagem: `A etapa "${etapa.tipo}" foi concluída.`,
        linkPagina: 'obras', linkId: obraAtiva.id
      });
    }
    window.closeModal('modal-concluir'); toast('Etapa concluída');
  } catch(e) { toast('Erro ao concluir'); }
  btn.disabled = false; btn.textContent = 'Concluir etapa';
};

// ============================================================
// EM EXECUÇÃO / APROVAÇÃO
// ============================================================
function renderExecucao() {
  const el = document.getElementById('lista-execucao');
  const rows = (window._todasEtapas || []).filter(e => e.status === 'execucao');
  if (!rows.length) { el.innerHTML = `<div class="empty"><i class="ti ti-tools"></i><p>Nenhum serviço em execução.</p></div>`; return; }
  const hoje_ = hoje();
  el.innerHTML = rows.map(e => {
    const atrasada = e.prazo && e.prazo < hoje_;
    const dr = e.prazo ? diasDiff(hoje_, e.prazo) : null;
    return `<div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div><div style="font-size:15px;font-weight:600">${e.tipo}</div><div style="font-size:12px;color:var(--text-muted)">${e.obraNome}</div></div>
        ${atrasada ? '<span class="badge badge-rej"><i class="ti ti-alert-triangle"></i> Atrasado</span>' : '<span class="badge badge-exec">Em execução</span>'}
      </div>
      <div class="divider"></div>
      <div class="g2">
        <div><div style="font-size:11px;color:var(--text-muted)">Parceiro</div><div style="font-size:13px;font-weight:500">${e.parceiroNome}</div></div>
        <div><div style="font-size:11px;color:var(--text-muted)">Valor cliente</div><div style="font-size:13px;font-weight:600;color:var(--text-success)">${e.val ? 'R$ '+e.val : '—'}</div></div>
        ${e.valRepasse ? `<div><div style="font-size:11px;color:var(--text-muted)">Repasse</div><div style="font-size:13px">R$ ${e.valRepasse}</div></div>` : ''}
        <div><div style="font-size:11px;color:var(--text-muted)">Prazo</div><div style="font-size:13px${atrasada?';color:var(--text-danger)':''}">${e.prazo||'—'}${dr!==null&&!atrasada?` (${dr}d)`:''}${atrasada?' (vencido)':''}</div></div>
      </div>
    </div>`;
  }).join('');
}

function atualizarAprovacaoVazia() {
  const temPagamentos = db_pagamentosAdmin.length > 0;
  const temSolicitacoes = db_solicitacoes.length > 0;
  const temOrcamentos = db_orcamentos.some(o => o.status === 'pendente');
  const temNotificacoes = db_notificacoesAdmin.length > 0;
  const vazia = document.getElementById('aprovacao-vazia');
  if (vazia) vazia.style.display = (!temPagamentos && !temSolicitacoes && !temOrcamentos && !temNotificacoes) ? 'block' : 'none';
}

function renderNotificacoesAdmin() {
  const el = document.getElementById('lista-notificacoes-admin');
  const secao = document.getElementById('secao-notificacoes-admin');
  if (!el || !secao) return;
  secao.style.display = db_notificacoesAdmin.length ? 'block' : 'none';
  const badge = document.getElementById('badge-notificacoes-admin');
  const naoLidas = db_notificacoesAdmin.filter(n => !n.lida).length;
  if (badge) badge.textContent = naoLidas > 0 ? naoLidas : '';
  atualizarAprovacaoVazia();
  el.innerHTML = db_notificacoesAdmin.map(n => `<div class="list-card" onclick="abrirNotificacaoAdmin('${n.id}')" style="${n.lida ? '' : 'border-color:#8b5cf6'}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:600">${n.titulo}</div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:2px">${n.mensagem}</div>
      </div>
      ${!n.lida ? `<span class="badge badge-exec" style="font-size:10px">Nova</span>` : ''}
    </div>
  </div>`).join('');
}

function renderAprovacao() {
  const el = document.getElementById('lista-aprovacao');
  const rows = db_orcamentos.filter(o => o.status === 'pendente');
  const secao = document.getElementById('secao-servicos-aprov');
  if (secao) secao.style.display = rows.length ? 'block' : 'none';
  atualizarAprovacaoVazia();
  if (!rows.length) { el.innerHTML = ''; return; }
  el.innerHTML = rows.map(o => `<div class="card">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div><div style="font-size:15px;font-weight:600">${o.obraNome}</div><div style="font-size:12px;color:var(--text-muted)">${o.criadoEm?.toDate?.()?.toLocaleDateString('pt-BR')||''}</div></div>
      <span class="badge badge-pend">Aguardando cliente</span>
    </div>
    <div class="divider"></div>
    <div style="font-size:18px;font-weight:700;color:var(--text-success);margin-bottom:8px">R$ ${o.valor}</div>
    ${o.descricao ? `<p style="font-size:13px;color:var(--text-secondary)">${o.descricao}</p>` : ''}
  </div>`).join('');
}

// ============================================================
// PARCEIROS + PAGAMENTOS
// ============================================================
function renderParceiros() {
  const el = document.getElementById('lista-parceiros');
  if (!db_parceiros.length) { el.innerHTML = `<div class="empty"><i class="ti ti-users-group"></i><p>Nenhum parceiro cadastrado.</p></div>`; return; }
  el.innerHTML = db_parceiros.map(p => {
    const ini = (p.nome||'?').split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase();
    return `<div class="list-card" onclick="abrirParceiroDetalhe('${p.id}')">
      <div style="display:flex;align-items:center;gap:10px">
        <div class="avatar">${ini}</div>
        <div style="flex:1"><div style="font-size:14px;font-weight:600">${p.nome}</div><div style="font-size:12px;color:var(--text-muted)">${p.doc||'Sem documento'}</div></div>
        <i class="ti ti-chevron-right" style="color:var(--text-muted)"></i>
      </div>
    </div>`;
  }).join('');
}

window.abrirNovoParceiro = function() {
  editParceiroId = null;
  document.getElementById('parceiro-modal-title').textContent = 'Novo parceiro';
  ['parc-nome','parc-doc','parc-tel'].forEach(i => document.getElementById(i).value = '');
  window.showModal('modal-novo-parceiro');
};
window.editarParceiro = function(id) {
  const p = db_parceiros.find(x => x.id === id); if (!p) return;
  editParceiroId = id;
  document.getElementById('parceiro-modal-title').textContent = 'Editar parceiro';
  document.getElementById('parc-nome').value = p.nome;
  document.getElementById('parc-doc').value = p.doc || '';
  document.getElementById('parc-tel').value = p.telefone || '';
  window.showModal('modal-novo-parceiro');
};
window.salvarParceiro = async function() {
  const nome = document.getElementById('parc-nome').value.trim();
  if (!nome) { toast('Informe o nome'); return; }
  const btn = document.getElementById('btn-salvar-parceiro'); btn.disabled = true;
  try {
    const dados = { nome, doc: document.getElementById('parc-doc').value.trim(), telefone: document.getElementById('parc-tel').value.trim() };
    if (editParceiroId) await atualizarParceiro(editParceiroId, dados);
    else await criarParceiro(dados);
    window.closeModal('modal-novo-parceiro'); toast('Parceiro salvo');
  } catch(e) { toast('Erro ao salvar'); }
  btn.disabled = false;
};
window.removerParceiro = async function(id) {
  if (!confirm('Excluir este parceiro?')) return;
  await excluirParceiro(id);
  window.goPage('parceiros');
  toast('Parceiro excluído');
};

window.abrirParceiroDetalhe = function(id) {
  parceiroDetalheId = id;
  document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById('page-parceiro-detalhe').classList.add('active');
  renderParceiroDetalhe();
  if (unsubPagamentos) unsubPagamentos();
  unsubPagamentos = escutarPagamentosParceiro(id, pags => {
    const p = db_parceiros.find(x => x.id === id); if (!p) return;
    p._pagamentos = pags;
    renderPagamentosParceiro(pags);
  });
  if (unsubNotificacoesParceiro) unsubNotificacoesParceiro();
  unsubNotificacoesParceiro = escutarNotificacoesParceiro(id, notifs => {
    const p = db_parceiros.find(x => x.id === id); if (!p) return;
    p._notificacoes = notifs;
    renderParceiroDetalhe();
  });
};

function renderParceiroDetalhe() {
  const p = db_parceiros.find(x => x.id === parceiroDetalheId); if (!p) return;
  document.getElementById('topbar-content').innerHTML = `<h1 style="font-size:15px">${p.nome}</h1>`;
  const todas = window._todasEtapas || [];
  const historico = todas.filter(e =>
    e.parceiroId === p.id ||
    (e.parceiros && e.parceiros.some(pp => pp.parceiroId === p.id))
  );
  const totalDevido = historico.filter(e => e.status === 'concluido').reduce((s, e) => {
    if (e.parceiros) {
      const pp = e.parceiros.find(pp => pp.parceiroId === p.id);
      return s + parseBRL(pp ? pp.repasse : 0);
    }
    return s + parseBRL(e.valRepasse || e.val);
  }, 0);
  const el = document.getElementById('parceiro-detalhe-content');
  const notificacoes = (p._notificacoes || []).filter(n => n.status === 'pendente');
  el.innerHTML = `
    <div class="card">
      <div class="g2 mb">
        <div><label>CPF/CNPJ</label><div>${p.doc||'—'}</div></div>
        <div><label>Telefone</label><div>${p.telefone||'—'}</div></div>
      </div>
      <div class="g2">
        <button class="btn-sm" onclick="editarParceiro('${p.id}')"><i class="ti ti-edit"></i> Editar</button>
        <button class="btn-sm btn-danger" onclick="removerParceiro('${p.id}')"><i class="ti ti-trash"></i> Excluir</button>
      </div>
    </div>
    <div id="resumo-financeiro-parceiro"></div>
    ${totalDevido > 0 ? `<div class="card" style="margin-bottom:12px">
      <div style="font-size:13px;font-weight:700;margin-bottom:6px">Aviso ao parceiro</div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">Há um saldo em aberto de ${fmtBRL(totalDevido)}. Envie um aviso para o parceiro confirmar o pagamento.</div>
      <button class="btn-sm btn-success" onclick="criarAvisoParceiro('${p.id}', ${totalDevido})"><i class="ti ti-bell"></i> Enviar aviso</button>
      ${notificacoes.length ? `<div style="margin-top:8px;font-size:12px;color:var(--text-danger)">${notificacoes.length} aviso${notificacoes.length>1?'s':''} pendente${notificacoes.length>1?'s':''}</div>` : ''}
    </div>` : ''}
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <div class="sec-title" style="margin-bottom:0">Pagamentos registrados</div>
      <button class="btn-sm btn-success" onclick="abrirRegistrarPagamento('${p.id}')"><i class="ti ti-plus"></i> Registrar</button>
    </div>
    <div id="lista-pagamentos-parceiro"></div>
    <div class="sec-title" style="margin-top:12px">Notificações do parceiro</div>
    ${!(p._notificacoes || []).length ? `<div class="empty"><i class="ti ti-bell-off"></i><p>Nenhuma notificação enviada.</p></div>` : (p._notificacoes || []).map(n => `
      <div class="card" style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
          <div>
            <div style="font-size:13px;font-weight:600">${n.mensagem || 'Saldo em aberto'}</div>
            <div style="font-size:12px;color:var(--text-muted)">${n.valor ? fmtBRL(n.valor) : ''}${n.motivo ? ` · ${n.motivo}` : ''}</div>
          </div>
          <span class="badge ${n.status === 'pago' ? 'badge-done' : n.status === 'nao_pago' ? 'badge-pend' : 'badge-exec'}">${n.status === 'pago' ? 'Pago' : n.status === 'nao_pago' ? 'Não pago' : 'Pendente'}</span>
        </div>
        ${n.status === 'pendente' ? `<div style="display:flex;gap:8px;margin-top:8px">
          <button class="btn-sm btn-success" onclick="marcarNotificacaoParceiro('${p.id}','${n.id}','pago')"><i class="ti ti-check"></i> Pago</button>
          <button class="btn-sm btn-danger" onclick="marcarNotificacaoParceiro('${p.id}','${n.id}','nao_pago')"><i class="ti ti-x"></i> Não pago</button>
        </div>` : ''}
      </div>`).join('')}
    }
    <div class="sec-title" style="margin-top:12px">Histórico de serviços</div>
    ${!historico.length ? `<div class="empty"><i class="ti ti-clipboard-off"></i><p>Nenhum serviço registrado.</p></div>` :
      `<div class="card">` + historico.map(e => `<div class="row-item">
        <div class="row-info">
          <div class="row-title">${e.tipo} <span style="color:var(--text-muted);font-weight:400">— ${e.obraNome}</span></div>
          <div class="row-meta">${e.valRepasse ? 'Repasse: R$ '+e.valRepasse : e.val ? 'R$ '+e.val : '—'}${e.metros?' · '+e.metros+'m²':''}</div>
        </div>
        <span class="badge ${e.status==='execucao'?'badge-exec':'badge-done'}">${e.status==='execucao'?'Em execução':'Concluído'}</span>
      </div>`).join('') + `</div>`}
  `;
}

function renderPagamentosParceiro(pags) {
  const p = db_parceiros.find(x => x.id === parceiroDetalheId); if (!p) return;
  const todas = window._todasEtapas || [];
  const historico = todas.filter(e =>
    (e.parceiroId === p.id || (e.parceiros && e.parceiros.some(pp => pp.parceiroId === p.id))) && e.status === 'concluido'
  );
  const totalDevido = historico.reduce((s, e) => {
    if (e.parceiros) {
      const pp = e.parceiros.find(pp => pp.parceiroId === p.id);
      return s + parseBRL(pp ? pp.repasse : 0);
    }
    return s + parseBRL(e.valRepasse || e.val);
  }, 0);
  const totalPago = pags.reduce((s, pg) => s + parseBRL(pg.valor), 0);
  const saldo = totalDevido - totalPago;

  const resumo = document.getElementById('resumo-financeiro-parceiro');
  if (resumo) resumo.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">
      <div class="stat"><span class="stat-val" style="font-size:14px">${fmtBRL(totalDevido)}</span><span class="stat-lbl">Total devido</span></div>
      <div class="stat"><span class="stat-val" style="font-size:14px;color:var(--text-success)">${fmtBRL(totalPago)}</span><span class="stat-lbl">Total pago</span></div>
      <div class="stat"><span class="stat-val" style="font-size:14px;color:${saldo>0?'var(--text-danger)':'var(--text-success)'}">${fmtBRL(saldo)}</span><span class="stat-lbl">Saldo a pagar</span></div>
    </div>`;

  const el = document.getElementById('lista-pagamentos-parceiro');
  if (!el) return;
  if (!pags.length) { el.innerHTML = `<div class="empty"><i class="ti ti-coin-off"></i><p>Nenhum pagamento registrado.</p></div>`; return; }
  el.innerHTML = `<div class="card">` + pags.map(pg => {
    const data = pg.criadoEm && pg.criadoEm.toDate ? pg.criadoEm.toDate().toLocaleDateString('pt-BR') : '';
    return `<div class="row-item">
      <div class="row-info">
        <div class="row-title">${fmtBRL(pg.valor)}</div>
        <div class="row-meta">${data}${pg.obs?' · '+pg.obs:''}</div>
      </div>
      <div class="row-actions">
        ${pg.comprovante ? `<button class="btn-sm" onclick="openLightbox('${pg.comprovante}','Comprovante')"><i class="ti ti-receipt"></i></button>` : ''}
        <button class="btn-sm btn-danger" onclick="excluirPagamentoAcao('${parceiroDetalheId}','${pg.id}')"><i class="ti ti-trash"></i></button>
      </div>
    </div>`;
  }).join('') + `</div>`;
}

window.abrirRegistrarPagamento = function(parceiroId) {
  pagFoto = null;
  document.getElementById('pag-valor').value = '';
  document.getElementById('pag-obs').value = '';
  document.getElementById('pag-prev-comprovante').style.display = 'none';
  document.getElementById('pag-icon-comprovante').style.display = 'flex';
  window.showModal('modal-pagamento-parceiro');
};
window.salvarPagamentoParceiro = async function() {
  const valor = document.getElementById('pag-valor').value;
  const obs = document.getElementById('pag-obs').value.trim();
  if (!valor) { toast('Informe o valor pago'); return; }
  const btn = document.getElementById('btn-salvar-pagamento'); btn.disabled = true; btn.textContent = 'Salvando...';
  try {
    let url = null;
    if (pagFoto) url = await uploadFoto(pagFoto, `parceiros/${parceiroDetalheId}/pagamentos/${Date.now()}.jpg`);
    await registrarPagamentoParceiro(parceiroDetalheId, { valor, obs, comprovante: url });
    window.closeModal('modal-pagamento-parceiro'); toast('Pagamento registrado');
  } catch(e) { toast('Erro ao salvar'); }
  btn.disabled = false; btn.textContent = 'Registrar pagamento';
};
window.excluirPagamentoAcao = async function(parceiroId, pagId) {
  if (!confirm('Excluir este pagamento?')) return;
  await excluirPagamentoParceiro(parceiroId, pagId); toast('Pagamento excluído');
};

window.criarAvisoParceiro = async function(parceiroId, valor) {
  await criarNotificacaoParceiro(parceiroId, {
    mensagem: `Saldo em aberto de ${fmtBRL(valor)}.`,
    valor,
    status: 'pendente',
    motivo: ''
  });
  toast('Aviso enviado ao parceiro');
};

window.marcarNotificacaoParceiro = async function(parceiroId, notifId, status, motivo = '') {
  await atualizarNotificacaoParceiro(parceiroId, notifId, { status, motivo, respondidoEm: hoje() });
  toast('Resposta registrada');
};

// ============================================================
// TABELAS (preços, repasse, diárias)
// ============================================================
function renderPrecos() {
  const el = document.getElementById('lista-precos'); if (!el) return;
  if (!db_precos.length) { el.innerHTML = `<div class="empty"><i class="ti ti-receipt-off"></i><p>Nenhum preço.</p></div>`; return; }
  el.innerHTML = db_precos.map(p => `<div class="price-row"><span class="price-name">${p.nome}</span><span class="price-val">R$ ${p.val}/m²</span><div class="row-actions"><button class="btn-sm" onclick="editarPreco('${p.id}')"><i class="ti ti-edit"></i></button><button class="btn-sm btn-danger" onclick="removerPreco('${p.id}')"><i class="ti ti-trash"></i></button></div></div>`).join('');
}
window.showModalPreco = () => { editPrecoId = null; editPrecoNome = null; document.getElementById('preco-modal-title').textContent = 'Novo serviço'; document.getElementById('preco-nome').value = ''; document.getElementById('preco-val').value = ''; window.showModal('modal-preco'); };
window.editarPreco = id => { const p = db_precos.find(x=>x.id===id); if(!p) return; editPrecoId=id; editPrecoNome=p.nome; document.getElementById('preco-modal-title').textContent='Editar'; document.getElementById('preco-nome').value=p.nome; document.getElementById('preco-val').value=p.val; window.showModal('modal-preco'); };
window.salvarPreco = async function() {
  const nome = document.getElementById('preco-nome').value.trim();
  const val = document.getElementById('preco-val').value;
  if (!nome || !val) { toast('Preencha o nome e o preço do serviço'); return; }
  const btn = document.getElementById('btn-salvar-preco'); btn.disabled=true;
  try {
    if (editPrecoId) {
      await atualizarPreco(editPrecoId, nome, val);
      const repassePorNovoNome = db_repasses.find(r => r.nome === nome);
      const repassePorNomeAntigo = editPrecoNome && editPrecoNome !== nome ? db_repasses.find(r => r.nome === editPrecoNome) : null;
      const repasseAlvo = repassePorNovoNome || repassePorNomeAntigo;
      if (repasseAlvo) {
        await atualizarRepasse(repasseAlvo.id, nome, repasseAlvo.val || '');
      } else {
        await criarRepasse(nome, '');
      }
    } else {
      await criarPreco(nome, val);
      const repasseExistente = db_repasses.find(r => r.nome === nome);
      if (!repasseExistente) {
        await criarRepasse(nome, '');
      }
    }
    window.closeModal('modal-preco'); toast('Salvo — a tabela de repasse foi atualizada com o mesmo nome.');
  } catch(e){ toast('Erro'); }
  btn.disabled=false;
};
window.removerPreco = async id => { if(!confirm('Excluir?')) return; await excluirPreco(id); toast('Excluído'); };

function renderRepasse() {
  const el = document.getElementById('lista-repasse'); if (!el) return;
  if (!db_repasses.length) { el.innerHTML = `<div class="empty"><i class="ti ti-coin-off"></i><p>Nenhum repasse.</p></div>`; return; }
  el.innerHTML = db_repasses.map(p => {
    const valorTexto = p.val ? `R$ ${p.val}/m²` : '<span style="color:var(--text-muted)">Adicionar valor de repasse</span>';
    return `<div class="price-row"><span class="price-name">${p.nome}</span><span class="price-val">${valorTexto}</span><div class="row-actions"><button class="btn-sm" onclick="editarRepasse('${p.id}')"><i class="ti ti-edit"></i></button><button class="btn-sm btn-danger" onclick="removerRepasse('${p.id}')"><i class="ti ti-trash"></i></button></div></div>`;
  }).join('');
}
window.showModalRepasse = () => { editRepasseId=null; document.getElementById('repasse-modal-title').textContent='Novo repasse'; document.getElementById('repasse-nome').value=''; document.getElementById('repasse-val').value=''; window.showModal('modal-repasse'); };
window.editarRepasse = id => { const p=db_repasses.find(x=>x.id===id); if(!p) return; editRepasseId=id; document.getElementById('repasse-modal-title').textContent='Editar'; document.getElementById('repasse-nome').value=p.nome; document.getElementById('repasse-val').value=p.val || ''; window.showModal('modal-repasse'); };
window.salvarRepasse = async function() {
  const nome=document.getElementById('repasse-nome').value.trim();
  const val=document.getElementById('repasse-val').value;
  if(!nome) { toast('Informe o nome do repasse'); return; }
  const btn=document.getElementById('btn-salvar-repasse'); btn.disabled=true;
  try { if(editRepasseId) await atualizarRepasse(editRepasseId,nome,val || ''); else await criarRepasse(nome,val || ''); window.closeModal('modal-repasse'); toast('Salvo'); } catch(e){ toast('Erro'); }
  btn.disabled=false;
};
window.removerRepasse = async id => { if(!confirm('Excluir?')) return; await excluirRepasse(id); toast('Excluído'); };

function renderDiarias() {
  const el = document.getElementById('lista-diarias'); if (!el) return;
  if (!db_diarias.length) { el.innerHTML = `<div class="empty"><i class="ti ti-calendar-off"></i><p>Nenhuma diária cadastrada.</p></div>`; return; }
  el.innerHTML = db_diarias.map(d => `<div class="price-row"><span class="price-name">${d.nome}</span><span class="price-val">R$ ${d.val}/dia</span><div class="row-actions"><button class="btn-sm" onclick="editarDiaria('${d.id}')"><i class="ti ti-edit"></i></button><button class="btn-sm btn-danger" onclick="removerDiaria('${d.id}')"><i class="ti ti-trash"></i></button></div></div>`).join('');
}
window.showModalDiaria = () => { editDiariaId=null; document.getElementById('diaria-modal-title').textContent='Nova diária'; document.getElementById('diaria-nome-cad').value=''; document.getElementById('diaria-val-cad').value=''; window.showModal('modal-diaria-cad'); };
window.editarDiaria = id => { const d=db_diarias.find(x=>x.id===id); if(!d) return; editDiariaId=id; document.getElementById('diaria-modal-title').textContent='Editar'; document.getElementById('diaria-nome-cad').value=d.nome; document.getElementById('diaria-val-cad').value=d.val; window.showModal('modal-diaria-cad'); };
window.salvarDiaria = async function() {
  const nome=document.getElementById('diaria-nome-cad').value.trim(), val=document.getElementById('diaria-val-cad').value;
  if(!nome||!val) { toast('Preencha todos os campos'); return; }
  const btn=document.getElementById('btn-salvar-diaria'); btn.disabled=true;
  try { if(editDiariaId) await atualizarDiaria(editDiariaId,nome,val); else await criarDiaria(nome,val); window.closeModal('modal-diaria-cad'); toast('Salvo'); } catch(e){ toast('Erro'); }
  btn.disabled=false;
};
window.removerDiaria = async id => { if(!confirm('Excluir?')) return; await excluirDiaria(id); toast('Excluído'); };

// ============================================================
// CLIENTES / ADMINS / SOLICITAÇÕES
// ============================================================
function renderClientes() {
  const el = document.getElementById('lista-clientes'); if (!el) return;
  if (!db_clientes.length) { el.innerHTML = `<div class="empty"><i class="ti ti-users"></i><p>Nenhum cliente.</p></div>`; return; }
  el.innerHTML = db_clientes.map(c => {
    const ini = (c.nome||'?').split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase();
    const sb = c.status==='aprovado'?'badge-aprov':c.status==='rejeitado'?'badge-rej':'badge-pend';
    const st = c.status==='aprovado'?'Aprovado':c.status==='rejeitado'?'Rejeitado':'Pendente';
    return `<div class="client-card" style="flex-wrap:wrap;gap:8px">
      <div class="avatar">${ini}</div>
      <div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:600">${c.nome}</div><div style="font-size:12px;color:var(--text-muted)">${c.email}</div></div>
      <span class="badge ${sb}">${st}</span>
      <div class="row-actions" style="width:100%;justify-content:flex-end">
        ${c.status==='pendente'?`<button class="btn-sm btn-success" onclick="aprovarClienteAcao('${c.id}')"><i class="ti ti-check"></i> Aprovar</button><button class="btn-sm btn-danger" onclick="rejeitarClienteAcao('${c.id}')"><i class="ti ti-x"></i> Rejeitar</button>`:''}
        ${c.status==='aprovado'?`<button class="btn-sm" onclick="promoverAdmin('${c.id}','${c.nome}')"><i class="ti ti-shield-up"></i> Tornar admin</button>`:''}
      </div>
    </div>`;
  }).join('');
}
window.aprovarClienteAcao = async uid => { await aprovarCliente(uid); toast('Cliente aprovado'); };
window.rejeitarClienteAcao = async uid => { if(!confirm('Rejeitar?')) return; await rejeitarCliente(uid); toast('Rejeitado'); };
window.promoverAdmin = async function(uid, nome) {
  if (!confirm(`Promover "${nome}" a administrador? Ele terá acesso total ao painel admin.`)) return;
  await promoverParaAdmin(uid);
  toast(`${nome} agora é administrador`);
};

function renderAdmins() {
  const el = document.getElementById('lista-admins'); if (!el) return;
  el.innerHTML = !db_admins.length ? `<div class="empty"><i class="ti ti-shield-off"></i><p>Nenhum admin.</p></div>` :
    db_admins.map(a => { const ini=(a.nome||'?').split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase(); return `<div class="client-card"><div class="avatar">${ini}</div><div style="flex:1"><div style="font-size:14px;font-weight:600">${a.nome}</div><div style="font-size:12px;color:var(--text-muted)">${a.email}</div></div></div>`; }).join('');
}
window.salvarNovoAdmin = async function() {
  const nome=document.getElementById('adm-nome').value.trim(), email=document.getElementById('adm-email').value.trim(), senha=document.getElementById('adm-senha').value;
  if(!nome||!email||!senha) { toast('Preencha todos os campos'); return; }
  const btn=document.getElementById('btn-salvar-admin'); btn.disabled=true; btn.textContent='Criando...';
  try {
    await cadastrarAdmin(nome,email,senha);
    window.closeModal('modal-novo-admin'); toast('Admin criado! Entrando novamente...');
    setTimeout(async()=>{ await logout(); window.location.href='../index.html'; }, 1800);
  } catch(e) { toast(mensagemErroFirebase(e)); }
  btn.disabled=false; btn.textContent='Criar administrador';
};

function renderSolicitacoes() {
  const el = document.getElementById('lista-solicitacoes'); if (!el) return;
  if (!db_solicitacoes.length) { el.innerHTML = `<div class="empty"><i class="ti ti-mail-off"></i><p>Nenhuma solicitação.</p></div>`; return; }
  el.innerHTML = db_solicitacoes.map(s => {
    const data = s.criadoEm&&s.criadoEm.toDate ? s.criadoEm.toDate().toLocaleDateString('pt-BR') : '';
    const sb = s.status==='pendente'?'badge-pend':s.status==='aceita'?'badge-aprov':'badge-rej';
    const st = s.status==='pendente'?'Pendente':s.status==='aceita'?'Aceita':'Recusada';
    return `<div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div><div style="font-size:15px;font-weight:600">${s.tipo||'Serviço'}</div><div style="font-size:12px;color:var(--text-muted)">${s.clienteNome||''} ${data?'· '+data:''}</div></div>
        <span class="badge ${sb}">${st}</span>
      </div>
      <div class="divider"></div>
      ${s.local?`<div style="font-size:13px;margin-bottom:6px"><i class="ti ti-map-pin"></i> ${s.local}</div>`:''}
      ${s.desc?`<div style="font-size:13px;color:var(--text-secondary)">${s.desc}</div>`:''}
      ${s.fotos&&s.fotos.length?`<div class="fotos-grid" style="margin-top:10px">${s.fotos.map((f,i)=>`<div><div class="foto-wrap" onclick="openLightbox('${f}','Foto ${i+1}')"><img src="${f}"></div></div>`).join('')}</div>`:''}
      ${s.status==='pendente'?`<div class="confirm-bar"><button class="btn-sm btn-success" onclick="abrirAceitarSolicitacao('${s.id}')"><i class="ti ti-check"></i> Aceitar e criar obra</button><button class="btn-sm btn-danger" onclick="recusarSolicitacaoAcao('${s.id}')"><i class="ti ti-x"></i> Recusar</button></div>`:''}
    </div>`;
  }).join('');
}
window.abrirAceitarSolicitacao = function(id) {
  const s = db_solicitacoes.find(x=>x.id===id); if(!s) return;
  solicitacaoAceitarId = id;
  document.getElementById('aceitar-nome').value = s.tipo?`${s.tipo} — ${s.clienteNome||''}`:s.clienteNome||'';
  document.getElementById('aceitar-local').value = s.local||'';
  document.getElementById('aceitar-inicio').value = hoje();
  document.getElementById('aceitar-fim').value = '';
  document.getElementById('aceitar-mostrar-pedreiro').checked = true;
  window.showModal('modal-aceitar-solicitacao');
};
window.confirmarAceiteSolicitacao = async function() {
  const s = db_solicitacoes.find(x=>x.id===solicitacaoAceitarId); if(!s) return;
  const nome = document.getElementById('aceitar-nome').value.trim();
  if(!nome) { toast('Informe o nome da obra'); return; }
  const btn = document.getElementById('btn-aceitar-solicitacao'); btn.disabled=true; btn.textContent='Criando...';
  try {
    await criarObra({ nome, clienteId: s.clienteId||null, local: document.getElementById('aceitar-local').value.trim(), inicio: document.getElementById('aceitar-inicio').value, fim: document.getElementById('aceitar-fim').value, desc: s.desc||'', mostrarPedreiro: document.getElementById('aceitar-mostrar-pedreiro').checked });
    await atualizarSolicitacao(s.id, { status: 'aceita' });
    window.closeModal('modal-aceitar-solicitacao'); toast('Obra criada!'); window.goPage('obras');
  } catch(e) { toast('Erro ao criar obra'); }
  btn.disabled=false; btn.textContent='Criar obra e vincular ao cliente';
};
window.recusarSolicitacaoAcao = async function(id) {
  if(!confirm('Recusar esta solicitação?')) return;
  await atualizarSolicitacao(id, { status: 'recusada' }); toast('Solicitação recusada');
};

// ============================================================
// EDITAR ETAPA
// ============================================================
let etapaEditId = null;
let etapaEditFotoAntes = null; // url existente ou novo base64

window.abrirEditarEtapa = function(etId) {
  const etapa = (obraAtiva._etapas || []).find(e => e.id === etId);
  if (!etapa) return;
  etapaEditId = etId;
  etapaEditFotoAntes = etapa.fotoAntes || null;

  // Popula selects
  popularSelectTipos();
  popularSelectParceiros();

  // Tipo
  const tipoSel = document.getElementById('edit-et-tipo');
  tipoSel.innerHTML = `<option value="">Selecione...</option>`;
  db_precos.forEach(p => { const o = document.createElement('option'); o.value = 'servico:' + p.nome; o.textContent = p.nome; tipoSel.appendChild(o); });
  const outros = document.createElement('option'); outros.value = 'outros'; outros.textContent = 'Outros'; tipoSel.appendChild(outros);
  if (etapa.isDiaria) tipoSel.value = 'outros';
  else if (etapa.tipo !== 'Outros') tipoSel.value = 'servico:' + etapa.tipo;
  else tipoSel.value = 'outros';

  // Carregar parceiros existentes
  parceirosDaEtapaEdit = etapa.parceiros ? [...etapa.parceiros] : [];
  // Compatibilidade com etapas antigas (parceiro único)
  if (!parceirosDaEtapaEdit.length && etapa.parceiroId) {
    parceirosDaEtapaEdit = [{ parceiroId: etapa.parceiroId, nome: etapa.parceiroNome || '', repasse: etapa.valRepasse || '' }];
  }

  // Campos
  document.getElementById('edit-et-val').value = etapa.val || '';
  document.getElementById('edit-et-repasse').value = etapa.valRepasse || '';
  document.getElementById('edit-et-metros').value = etapa.metros || '';
  document.getElementById('edit-et-inicio').value = etapa.inicio || '';
  document.getElementById('edit-et-prazo').value = etapa.prazo || '';
  document.getElementById('edit-et-obs').value = etapa.obs || '';
  document.getElementById('edit-et-detalhe').value = etapa.detalheInterno || '';
  document.getElementById('edit-et-motivo').value = etapa.motivo || '';

  // Renderizar parceiros
  renderParceirosDaEtapa('edit-lista-parceiros-etapa', parceirosDaEtapaEdit, parseBRL(etapa.valRepasse), 'removerParceiroEtapaEdit', 'editarRepasseParceiroEdit');

  // Foto antes
  const prev = document.getElementById('edit-et-prev-antes');
  const icon = document.getElementById('edit-et-icon-antes');
  const remBtn = document.getElementById('edit-et-remover-foto');
  if (etapa.fotoAntes) {
    prev.src = etapa.fotoAntes; prev.style.display = 'block';
    icon.style.display = 'none'; remBtn.style.display = 'inline-flex';
  } else {
    prev.style.display = 'none'; icon.style.display = 'flex'; remBtn.style.display = 'none';
  }

  window.showModal('modal-editar-etapa');
};

window.editFotoAntesChanged = function(input) {
  const file = input.files[0]; if (!file) return;
  fileParaBase64(file).then(d => {
    etapaEditFotoAntes = d;
    document.getElementById('edit-et-prev-antes').src = d;
    document.getElementById('edit-et-prev-antes').style.display = 'block';
    document.getElementById('edit-et-icon-antes').style.display = 'none';
    document.getElementById('edit-et-remover-foto').style.display = 'inline-flex';
  });
};

window.removerFotoAntesEdit = function() {
  etapaEditFotoAntes = null;
  document.getElementById('edit-et-prev-antes').style.display = 'none';
  document.getElementById('edit-et-icon-antes').style.display = 'flex';
  document.getElementById('edit-et-remover-foto').style.display = 'none';
};

window.salvarEdicaoEtapa = async function() {
  if (!etapaEditId) return;
  const btn = document.getElementById('btn-salvar-edicao-etapa'); btn.disabled = true; btn.textContent = 'Salvando...';
  try {
    let fotoAntesUrl = null;
    // Se nova foto (base64), faz upload; se url existente, mantém; se null, remove
    if (etapaEditFotoAntes && etapaEditFotoAntes.startsWith('data:')) {
      fotoAntesUrl = await uploadFoto(etapaEditFotoAntes, `obras/${obraAtiva.id}/etapas/${Date.now()}_antes_edit.jpg`);
    } else {
      fotoAntesUrl = etapaEditFotoAntes; // url existente ou null
    }

    const parceiroNomes = parceirosDaEtapaEdit.map(p => p.nome).join(', ');
    await atualizarEtapa(obraAtiva.id, etapaEditId, {
      parceiros: parceirosDaEtapaEdit,
      parceiroNome: parceiroNomes,
      val: document.getElementById('edit-et-val').value,
      valRepasse: document.getElementById('edit-et-repasse').value,
      metros: document.getElementById('edit-et-metros').value || null,
      inicio: document.getElementById('edit-et-inicio').value,
      prazo: document.getElementById('edit-et-prazo').value,
      obs: document.getElementById('edit-et-obs').value.trim(),
      detalheInterno: document.getElementById('edit-et-detalhe').value.trim(),
      motivo: document.getElementById('edit-et-motivo').value.trim(),
      fotoAntes: fotoAntesUrl
    });
    window.closeModal('modal-editar-etapa'); toast('Etapa atualizada');
  } catch(e) { toast('Erro ao salvar'); console.error(e); }
  btn.disabled = false; btn.textContent = 'Salvar alterações';
};

// ============================================================
// DIÁRIA AVULSA (lançamento diário na obra)
// ============================================================
let linhasDiariaAvulsa = [];
let diariaAvulsaFotoAntes = null;
let diariaAvulsaFotoDepois = null;
let diariaEditId = null; // id da diária sendo editada

function popularSelectParceirosDiaria() {
  ['da-parceiro'].forEach(id => {
    const sel = document.getElementById(id); if (!sel) return;
    sel.innerHTML = `<option value="">Parceiro (opcional)...</option>`;
    db_parceiros.forEach(p => { const o = document.createElement('option'); o.value = p.id; o.textContent = p.nome; sel.appendChild(o); });
  });
}

window.abrirNovaDiaria = function() {
  linhasDiariaAvulsa = [];
  diariaAvulsaFotoAntes = null;
  diariaAvulsaFotoDepois = null;
  diariaEditId = null;
  document.getElementById('da-data').value = hoje();
  document.getElementById('da-obs').value = '';
  document.getElementById('da-qtd').value = '';
  document.getElementById('da-prev-antes').style.display = 'none';
  document.getElementById('da-icon-antes').style.display = 'flex';
  document.getElementById('da-prev-depois').style.display = 'none';
  document.getElementById('da-icon-depois').style.display = 'flex';
  document.getElementById('modal-diaria-avulsa-title').textContent = '📅 Registrar diária';
  document.getElementById('btn-salvar-diaria-avulsa').textContent = 'Registrar diária';
  const sel = document.getElementById('da-tipo');
  sel.innerHTML = `<option value="">Tipo de diária...</option>`;
  db_diarias.forEach(d => { const o = document.createElement('option'); o.value = d.id; o.textContent = `${d.nome} — R$ ${d.val}/dia`; sel.appendChild(o); });
  popularSelectParceirosDiaria();
  renderLinhasDiariaAvulsa();
  window.showModal('modal-diaria-avulsa');
};

window.abrirEditarDiaria = function(etId) {
  const etapa = (obraAtiva._etapas || []).find(e => e.id === etId);
  if (!etapa) return;
  diariaEditId = etId;
  linhasDiariaAvulsa = etapa.linhasDiarias ? [...etapa.linhasDiarias] : [];
  diariaAvulsaFotoAntes = etapa.fotoAntes || null;
  diariaAvulsaFotoDepois = etapa.fotoDepois || null;
  document.getElementById('da-data').value = etapa.dataDiaria || etapa.inicio || hoje();
  document.getElementById('da-obs').value = etapa.obs || '';
  document.getElementById('da-qtd').value = '';
  document.getElementById('modal-diaria-avulsa-title').textContent = '📅 Editar diária';
  document.getElementById('btn-salvar-diaria-avulsa').textContent = 'Salvar alterações';

  // Foto antes
  if (etapa.fotoAntes) {
    document.getElementById('da-prev-antes').src = etapa.fotoAntes;
    document.getElementById('da-prev-antes').style.display = 'block';
    document.getElementById('da-icon-antes').style.display = 'none';
  } else {
    document.getElementById('da-prev-antes').style.display = 'none';
    document.getElementById('da-icon-antes').style.display = 'flex';
  }
  // Foto depois
  if (etapa.fotoDepois) {
    document.getElementById('da-prev-depois').src = etapa.fotoDepois;
    document.getElementById('da-prev-depois').style.display = 'block';
    document.getElementById('da-icon-depois').style.display = 'none';
  } else {
    document.getElementById('da-prev-depois').style.display = 'none';
    document.getElementById('da-icon-depois').style.display = 'flex';
  }

  const sel = document.getElementById('da-tipo');
  sel.innerHTML = `<option value="">Tipo de diária...</option>`;
  db_diarias.forEach(d => { const o = document.createElement('option'); o.value = d.id; o.textContent = `${d.nome} — R$ ${d.val}/dia`; sel.appendChild(o); });
  popularSelectParceirosDiaria();
  renderLinhasDiariaAvulsa();
  window.showModal('modal-diaria-avulsa');
};

function renderLinhasDiariaAvulsa() {
  const el = document.getElementById('da-lista-linhas');
  if (!linhasDiariaAvulsa.length) {
    el.innerHTML = `<div style="font-size:12px;color:var(--text-muted);text-align:center;padding:8px">Nenhuma linha adicionada</div>`;
    return;
  }
  const totalVal = linhasDiariaAvulsa.reduce((s, l) => s + l.qtd * parseBRL(l.val), 0);
  const totalRep = linhasDiariaAvulsa.reduce((s, l) => s + parseBRL(l.repasse || '0'), 0);
  const margem = totalVal - totalRep;

  // Render das linhas — repasse usa onchange (não oninput) para não re-renderizar ao digitar
  el.innerHTML = linhasDiariaAvulsa.map((l, i) => `
    <div style="background:var(--surface-1);border-radius:8px;padding:8px 10px;margin-bottom:6px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <div>
          <div style="font-size:13px;font-weight:500">${l.nome} — ${l.qtd}x</div>
          <div style="font-size:11px;color:var(--text-muted)">Valor: ${fmtBRL(l.qtd * parseBRL(l.val))}</div>
          ${l.parceiroNome ? `<div style="font-size:11px;color:var(--text-accent)">${l.parceiroNome}${l.parceiroAvulso ? ' (avulso)' : ''}</div>` : ''}
        </div>
        <button class="btn-sm btn-danger" onclick="removerLinhaDiariaAvulsa(${i})" style="padding:5px 8px"><i class="ti ti-trash"></i></button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div>
          <label style="font-size:11px">Parceiro</label>
          <select id="sel-parc-${i}" onchange="setParceiroLinhaDiaria(${i},this.value)" style="font-size:12px;padding:6px 8px">
            <option value="">Nenhum</option>
            ${db_parceiros.map(p => `<option value="${p.id}" ${l.parceiroId===p.id?'selected':''}>${p.nome}</option>`).join('')}
            <option value="outro" ${l.parceiroAvulso?'selected':''}>Outro...</option>
          </select>
          ${l.parceiroAvulso ? `<input type="text" id="inp-parc-avulso-${i}" value="${l.parceiroNome||''}" placeholder="Nome do parceiro"
            style="font-size:12px;padding:6px 8px;width:100%;margin-top:4px;border:0.5px solid var(--border-strong);border-radius:var(--radius);background:var(--surface-2);color:var(--text-primary)"
            onblur="setNomeParceiroAvulso(${i},this.value)">` : ''}
        </div>
        <div>
          <label style="font-size:11px">Repasse (R$)</label>
          <input type="text" id="rep-${i}" value="${l.repasse||''}" placeholder="0,00"
            style="font-size:12px;padding:6px 8px;width:100%;border:0.5px solid var(--border-strong);border-radius:var(--radius);background:var(--surface-2);color:var(--text-primary)"
            onblur="setRepasseLinhaDiaria(${i},this.value)">
        </div>
      </div>
    </div>`).join('') +
    `<div id="da-summary" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:8px">
      <div class="stat"><span class="stat-val" style="font-size:13px">${fmtBRL(totalVal)}</span><span class="stat-lbl">Total cobrado</span></div>
      <div class="stat"><span class="stat-val" style="font-size:13px">${fmtBRL(totalRep)}</span><span class="stat-lbl">Repasse</span></div>
      <div class="stat"><span class="stat-val" style="font-size:13px;color:${margem>=0?'var(--text-success)':'var(--text-danger)'}">${fmtBRL(margem)}</span><span class="stat-lbl">Margem</span></div>
    </div>`;
}

window.setParceiroLinhaDiaria = function(i, val) {
  if (val === 'outro') {
    linhasDiariaAvulsa[i].parceiroId = null;
    linhasDiariaAvulsa[i].parceiroAvulso = true;
    linhasDiariaAvulsa[i].parceiroNome = '';
  } else {
    linhasDiariaAvulsa[i].parceiroId = val || null;
    linhasDiariaAvulsa[i].parceiroAvulso = false;
    linhasDiariaAvulsa[i].parceiroNome = val ? db_parceiros.find(p => p.id === val)?.nome || '' : '';
  }
  renderLinhasDiariaAvulsa();
};

window.setNomeParceiroAvulso = function(i, nome) {
  linhasDiariaAvulsa[i].parceiroNome = nome.trim();
  // Atualiza só o texto exibido sem re-renderizar tudo
  const el = document.querySelector(`#sel-parc-${i}`)?.closest('div')?.querySelector('div');
};

// onblur salva o valor sem re-renderizar — evita perda de foco
window.setRepasseLinhaDiaria = function(i, val) {
  linhasDiariaAvulsa[i].repasse = val;
  // Atualiza só o summary sem re-renderizar as linhas
  atualizarSummaryDiaria();
};

function atualizarSummaryDiaria() {
  const totalVal = linhasDiariaAvulsa.reduce((s, l) => s + l.qtd * parseBRL(l.val), 0);
  const totalRep = linhasDiariaAvulsa.reduce((s, l) => s + parseBRL(l.repasse || '0'), 0);
  const margem = totalVal - totalRep;
  const el = document.getElementById('da-summary');
  if (el) el.innerHTML = `
    <div class="stat"><span class="stat-val" style="font-size:13px">${fmtBRL(totalVal)}</span><span class="stat-lbl">Total cobrado</span></div>
    <div class="stat"><span class="stat-val" style="font-size:13px">${fmtBRL(totalRep)}</span><span class="stat-lbl">Repasse</span></div>
    <div class="stat"><span class="stat-val" style="font-size:13px;color:${margem>=0?'var(--text-success)':'var(--text-danger)'}">${fmtBRL(margem)}</span><span class="stat-lbl">Margem</span></div>`;
}

function renderSummaryDiaria() { atualizarSummaryDiaria(); }

window.adicionarLinhaDiariaAvulsa = function() {
  const sel = document.getElementById('da-tipo');
  const qtdStr = document.getElementById('da-qtd').value;
  const qtd = parseFloat(qtdStr);
  const diaria = db_diarias.find(d => d.id === sel.value);
  if (!diaria) { toast('Selecione o tipo de diária'); return; }
  if (!qtd || qtd <= 0) { toast('Informe a quantidade (ex: 2, 0.5, 2.5)'); return; }
  linhasDiariaAvulsa.push({ diariaId: diaria.id, nome: diaria.nome, val: diaria.val, qtd, parceiroId: null, parceiroNome: '', repasse: '' });
  sel.value = ''; document.getElementById('da-qtd').value = '';
  renderLinhasDiariaAvulsa();
};
window.removerLinhaDiariaAvulsa = function(i) { linhasDiariaAvulsa.splice(i, 1); renderLinhasDiariaAvulsa(); };

window.diariaFotoChanged = function(input, key) {
  const file = input.files[0]; if (!file) return;
  fileParaBase64(file).then(d => {
    if (key === 'antes') {
      diariaAvulsaFotoAntes = d;
      document.getElementById('da-prev-antes').src = d;
      document.getElementById('da-prev-antes').style.display = 'block';
      document.getElementById('da-icon-antes').style.display = 'none';
    } else {
      diariaAvulsaFotoDepois = d;
      document.getElementById('da-prev-depois').src = d;
      document.getElementById('da-prev-depois').style.display = 'block';
      document.getElementById('da-icon-depois').style.display = 'none';
    }
  });
};

window.salvarDiariaAvulsa = async function() {
  if (!linhasDiariaAvulsa.length) { toast('Adicione pelo menos uma linha de diária'); return; }
  const data = document.getElementById('da-data').value;
  if (!data) { toast('Informe a data'); return; }
  const btn = document.getElementById('btn-salvar-diaria-avulsa'); btn.disabled = true; btn.textContent = 'Salvando...';
  try {
    let fotoAntesUrl = diariaAvulsaFotoAntes;
    let fotoDepoisUrl = diariaAvulsaFotoDepois;
    if (diariaAvulsaFotoAntes && diariaAvulsaFotoAntes.startsWith('data:'))
      fotoAntesUrl = await uploadFoto(diariaAvulsaFotoAntes, `obras/${obraAtiva.id}/diarias/${Date.now()}_antes.jpg`);
    if (diariaAvulsaFotoDepois && diariaAvulsaFotoDepois.startsWith('data:'))
      fotoDepoisUrl = await uploadFoto(diariaAvulsaFotoDepois, `obras/${obraAtiva.id}/diarias/${Date.now()}_depois.jpg`);

    const totalVal = linhasDiariaAvulsa.reduce((s, l) => s + l.qtd * parseBRL(l.val), 0);
    const totalRep = linhasDiariaAvulsa.reduce((s, l) => s + parseBRL(l.repasse || '0'), 0);
    const obs = document.getElementById('da-obs').value.trim();

    // Nome dos parceiros únicos envolvidos
    const parceirosEnvolvidos = [...new Set(linhasDiariaAvulsa.filter(l=>l.parceiroNome).map(l=>l.parceiroNome))].join(', ');

    const dadosDiaria = {
      tipo: 'Diária',
      isDiariaAvulsa: true,
      dataDiaria: data,
      linhasDiarias: linhasDiariaAvulsa,
      val: totalVal.toFixed(2).replace('.', ','),
      valRepasse: totalRep.toFixed(2).replace('.', ','),
      parceiroNome: parceirosEnvolvidos || (usuarioAtual.nome || 'Encarregado'),
      fotoAntes: fotoAntesUrl || null,
      fotoDepois: fotoDepoisUrl || null,
      obs,
      metros: null, inicio: data, prazo: null,
      detalheInterno: '', motivo: '', fotosExtras: [],
      parceiros: linhasDiariaAvulsa.filter(l => l.parceiroId).map(l => ({ parceiroId: l.parceiroId, nome: l.parceiroNome, repasse: l.repasse })),
      // Diária já nasce concluída — é um registro do que aconteceu no dia
      status: 'concluido',
      pagamento: 'a_pagar',
      dataConc: data
    };

    if (diariaEditId) {
      const existente = (obraAtiva._etapas || []).find(e => e.id === diariaEditId);
      if (existente) dadosDiaria.pagamento = existente.pagamento || 'a_pagar';
      await atualizarEtapa(obraAtiva.id, diariaEditId, dadosDiaria);
      toast('Diária atualizada');
    } else {
      await criarEtapa(obraAtiva.id, dadosDiaria);
      if (obraAtiva.clienteId) {
        criarNotificacao({
          destinatarioTipo: 'cliente', clienteId: obraAtiva.clienteId, obraId: obraAtiva.id, obraNome: obraAtiva.nome,
          tipo: 'diaria_registrada', titulo: 'Diária registrada',
          mensagem: `Uma diária realizada em ${data} foi registrada.`,
          linkPagina: 'obras', linkId: obraAtiva.id
        });
      }
      toast('Diária registrada');
    }
    window.closeModal('modal-diaria-avulsa');
  } catch(e) { toast('Erro ao salvar diária'); console.error(e); }
  btn.disabled = false; btn.textContent = diariaEditId ? 'Salvar alterações' : 'Registrar diária';
};

// ============================================================
// PAGAMENTOS DO CLIENTE — painel admin
// ============================================================
function updateBadgePagamentos() {
  const n = db_pagamentosAdmin.filter(p => p.status === 'pendente').length;
  updateBadge();
  // Mostra/esconde seção na página de aprovação
  const secao = document.getElementById('secao-pagamentos-admin');
  if (secao) secao.style.display = db_pagamentosAdmin.length ? 'block' : 'none';
  const badge = document.getElementById('badge-pagamentos');
  if (badge) badge.textContent = n > 0 ? n : '';
  atualizarAprovacaoVazia();
}

function renderPagamentosAdmin() {
  const el = document.getElementById('lista-pagamentos-admin'); if (!el) return;
  if (!db_pagamentosAdmin.length) {
    el.innerHTML = `<div class="empty"><i class="ti ti-cash-off"></i><p>Nenhum pagamento registrado pelos clientes ainda.</p></div>`;
    return;
  }
  el.innerHTML = db_pagamentosAdmin.map(p => {
    const obra = db_obras.find(o => o.id === p.obraId);
    const statusBadge = p.status === 'confirmado' ? `<span class="badge badge-aprov">Confirmado</span>` : p.status === 'contestado' ? `<span class="badge badge-rej">Contestado</span>` : `<span class="badge badge-pend">Pendente</span>`;
    return `<div class="card" id="pag-admin-${p.id}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <div>
          <div style="font-size:15px;font-weight:600">${fmtBRL(p.valor)}</div>
          <div style="font-size:12px;color:var(--text-muted)">${p.clienteNome} · ${obra ? obra.nome : p.obraId}</div>
          <div style="font-size:11px;color:var(--text-muted)">${p.formaPagamento||''} · ${p.data||''}</div>
          ${p.obs ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:4px">${p.obs}</div>` : ''}
        </div>
        ${statusBadge}
      </div>
      ${p.comprovante ? `<div style="margin-bottom:10px"><img src="${p.comprovante}" style="width:100%;max-height:140px;object-fit:cover;border-radius:8px;cursor:pointer" onclick="openLightbox('${p.comprovante}','Comprovante')"></div>` : ''}
      ${p.status === 'pendente' ? `<div class="confirm-bar">
        <button class="btn-sm btn-success" onclick="confirmarPagamentoCliente('${p.id}')"><i class="ti ti-check"></i> Confirmar recebimento</button>
        <button class="btn-sm btn-danger" onclick="contestarPagamentoCliente('${p.id}')"><i class="ti ti-x"></i> Contestar</button>
      </div>` : ''}
      ${p.status === 'contestado' && p.motivoContestacao ? `<div style="font-size:12px;color:var(--text-danger);margin-top:6px"><i class="ti ti-alert-circle"></i> ${p.motivoContestacao}</div>` : ''}
    </div>`;
  }).join('');
}

window.confirmarPagamentoCliente = async function(pagId) {
  if (!confirm('Confirmar recebimento deste pagamento?')) return;
  await atualizarPagamentoCliente(pagId, { status: 'confirmado' });
  toast('Pagamento confirmado!');
};

window.contestarPagamentoCliente = async function(pagId) {
  const motivo = prompt('Descreva o motivo da contestação:');
  if (!motivo) return;
  await atualizarPagamentoCliente(pagId, { status: 'contestado', motivoContestacao: motivo });
  toast('Pagamento contestado. O cliente será notificado.');
};

// ============================================================
// SOLICITAÇÃO DE PAGAMENTO (admin cobra cliente)
// ============================================================
let etapasCobrancaSelecionadas = [];

window.abrirNovaCobranca = function() {
  etapasCobrancaSelecionadas = [];
  document.getElementById('cob-mensagem').value = '';
  document.getElementById('cob-pix-chave').value = '';
  document.getElementById('cob-pix-nome').value = '';
  document.getElementById('cob-pix-banco').value = '';
  document.getElementById('cob-pix-tipo').value = 'cpf';
  document.getElementById('cob-etapas-area').style.display = 'none';

  // Popular clientes
  const sel = document.getElementById('cob-cliente');
  sel.innerHTML = `<option value="">Selecione o cliente...</option>`;
  db_clientes.filter(c => c.status === 'aprovado').forEach(c => {
    const o = document.createElement('option'); o.value = c.id; o.textContent = c.nome; sel.appendChild(o);
  });
  document.getElementById('cob-obra').innerHTML = `<option value="">Selecione a obra...</option>`;
  window.showModal('modal-nova-cobranca');
};

window.carregarEtapasCobranca = function() {
  const clienteId = document.getElementById('cob-cliente').value;
  const obraId = document.getElementById('cob-obra').value;

  // Popular obras quando cliente for selecionado
  if (clienteId && !obraId) {
    const selObra = document.getElementById('cob-obra');
    selObra.innerHTML = `<option value="">Selecione a obra...</option>`;
    db_obras.filter(o => o.clienteId === clienteId).forEach(o => {
      const opt = document.createElement('option'); opt.value = o.id; opt.textContent = o.nome; selObra.appendChild(opt);
    });
    document.getElementById('cob-etapas-area').style.display = 'none';
    return;
  }
  if (!obraId) return;

  // Carregar etapas aprovadas e não ainda em cobrança/pagas
  const todasEtapas = window._todasEtapas || [];
  const etapasDisponiveis = todasEtapas.filter(e =>
    e.obraId === obraId &&
    e.status === 'concluido' &&
    e.pagamento !== 'pago' &&
    e.statusCobranca !== 'solicitacao_pagamento'
  );

  const area = document.getElementById('cob-etapas-area');
  const lista = document.getElementById('cob-lista-etapas');
  etapasCobrancaSelecionadas = [];

  if (!etapasDisponiveis.length) {
    area.style.display = 'block';
    lista.innerHTML = `<div style="font-size:13px;color:var(--text-muted);padding:8px">Nenhuma etapa disponível para cobrança nesta obra.</div>`;
    document.getElementById('cob-total').textContent = 'R$ 0,00';
    return;
  }

  area.style.display = 'block';
  lista.innerHTML = etapasDisponiveis.map(e => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--surface-1);border-radius:8px;margin-bottom:6px">
      <input type="checkbox" id="chk-${e.id}" value="${e.id}" data-val="${e.val||'0'}" onchange="recalcularTotalCobranca()" style="width:18px;height:18px;accent-color:#1D9E75;cursor:pointer">
      <label for="chk-${e.id}" style="flex:1;cursor:pointer">
        <div style="font-size:13px;font-weight:500">${e.tipo}</div>
        <div style="font-size:11px;color:var(--text-muted)">${e.dataConc ? 'Concluído em ' + e.dataConc : ''}</div>
      </label>
      <span style="font-size:13px;font-weight:600;color:var(--text-success)">${e.val ? fmtBRL(e.val) : '—'}</span>
    </div>`).join('');
  document.getElementById('cob-total').textContent = 'R$ 0,00';
};

window.recalcularTotalCobranca = function() {
  const checkboxes = document.querySelectorAll('#cob-lista-etapas input[type=checkbox]:checked');
  etapasCobrancaSelecionadas = Array.from(checkboxes).map(c => c.value);
  const total = Array.from(checkboxes).reduce((s, c) => s + parseBRL(c.dataset.val), 0);
  document.getElementById('cob-total').textContent = fmtBRL(total);
};

window.enviarCobranca = async function() {
  const clienteId = document.getElementById('cob-cliente').value;
  const obraId = document.getElementById('cob-obra').value;
  const pixChave = document.getElementById('cob-pix-chave').value.trim();
  const pixNome = document.getElementById('cob-pix-nome').value.trim();
  const pixBanco = document.getElementById('cob-pix-banco').value.trim();
  const pixTipo = document.getElementById('cob-pix-tipo').value;
  const mensagem = document.getElementById('cob-mensagem').value.trim();

  if (!clienteId) { toast('Selecione o cliente'); return; }
  if (!obraId) { toast('Selecione a obra'); return; }
  if (!etapasCobrancaSelecionadas.length) { toast('Selecione pelo menos uma etapa'); return; }
  if (!pixChave || !pixNome) { toast('Informe os dados do PIX'); return; }

  const btn = document.getElementById('btn-enviar-cobranca');
  btn.disabled = true; btn.textContent = 'Enviando...';

  try {
    const todasEtapas = window._todasEtapas || [];
    const etapasSelecionadas = etapasCobrancaSelecionadas.map(id => {
      const e = todasEtapas.find(x => x.id === id);
      return { id: e.id, tipo: e.tipo, val: e.val, dataConc: e.dataConc || '' };
    });
    const total = etapasSelecionadas.reduce((s, e) => s + parseBRL(e.val), 0);
    const cliente = db_clientes.find(c => c.id === clienteId);
    const obra = db_obras.find(o => o.id === obraId);

    // Cria a solicitação de pagamento
    const solPagamentoId = await criarSolicitacaoPagamento({
      clienteId, clienteNome: cliente?.nome || '',
      obraId, obraNome: obra?.nome || '',
      etapas: etapasSelecionadas,
      total: total.toFixed(2).replace('.', ','),
      mensagem,
      pix: { tipo: pixTipo, chave: pixChave, nome: pixNome, banco: pixBanco }
    });
    criarNotificacao({
      destinatarioTipo: 'cliente', clienteId, obraId, obraNome: obra?.nome || '',
      tipo: 'cobranca_enviada', titulo: 'Nova cobrança recebida',
      mensagem: `Uma cobrança de R$ ${total.toFixed(2).replace('.', ',')} foi enviada para pagamento.`,
      linkPagina: 'financeiro', linkId: solPagamentoId
    });

    // Marca etapas como "solicitacao_pagamento"
    for (const id of etapasCobrancaSelecionadas) {
      await atualizarEtapa(obraId, id, { statusCobranca: 'solicitacao_pagamento' });
    }

    // 🔌 WhatsApp — será ativado quando Z-API estiver configurada
    await notificarWhatsApp({
      telefone: cliente?.telefone || '',
      mensagem: `Olá ${cliente?.nome}! Você tem uma nova solicitação de pagamento de ${fmtBRL(total)} referente à obra "${obra?.nome}". Acesse o sistema para ver os detalhes.`,
      tipo: 'cobranca'
    });

    window.closeModal('modal-nova-cobranca');
    toast('Cobrança enviada ao cliente!');
  } catch(e) { toast('Erro ao enviar cobrança'); console.error(e); }
  btn.disabled = false; btn.textContent = 'Enviar cobrança ao cliente';
};

// Contestações recebidas pelo admin
function renderContestacoes() {
  const contestadas = db_solicitacoesPagamento.filter(s => s.status === 'contestada');
  const secao = document.getElementById('secao-contestacoes');
  const badge = document.getElementById('badge-contestacoes');
  if (secao) secao.style.display = contestadas.length ? 'block' : 'none';
  if (badge) badge.textContent = contestadas.length > 0 ? contestadas.length : '';
  atualizarAprovacaoVazia();
  const el = document.getElementById('lista-contestacoes'); if (!el) return;
  if (!contestadas.length) { el.innerHTML = ''; return; }
  el.innerHTML = contestadas.map(s => `<div class="card" style="border-color:var(--border-danger)">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
      <div>
        <div style="font-size:15px;font-weight:600">${fmtBRL(s.total)}</div>
        <div style="font-size:12px;color:var(--text-muted)">${s.clienteNome} · ${s.obraNome}</div>
      </div>
      <span class="badge badge-rej">Contestada</span>
    </div>
    <div style="background:var(--bg-danger);border-radius:8px;padding:10px;margin-bottom:10px;font-size:13px;color:var(--text-danger)">
      <i class="ti ti-message-circle"></i> <strong>Motivo:</strong> ${s.contestacao || '—'}
    </div>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">Etapas: ${(s.etapas||[]).map(e=>e.tipo).join(', ')}</div>
    <div class="confirm-bar">
      <button class="btn-sm btn-success" onclick="reenviarCobranca('${s.id}')"><i class="ti ti-send"></i> Reenviar corrigida</button>
      <button class="btn-sm btn-danger" onclick="cancelarCobranca('${s.id}')"><i class="ti ti-x"></i> Cancelar</button>
    </div>
  </div>`).join('');
}

window.reenviarCobranca = async function(solId) {
  await atualizarSolicitacaoPagamento(solId, { status: 'pendente', contestacao: null });
  toast('Cobrança reenviada ao cliente');
};

window.cancelarCobranca = async function(solId) {
  if (!confirm('Cancelar esta cobrança? As etapas voltarão a ficar disponíveis.')) return;
  const sol = db_solicitacoesPagamento.find(s => s.id === solId);
  if (sol) {
    for (const e of sol.etapas || []) {
      await atualizarEtapa(sol.obraId, e.id, { statusCobranca: null });
    }
  }
  await atualizarSolicitacaoPagamento(solId, { status: 'cancelada' });
  toast('Cobrança cancelada');
};
