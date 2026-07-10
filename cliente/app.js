// ============================================
// APP CLIENTE — versão revisada e completa
// ============================================
import { observarAuth, logout, mensagemErroFirebase, trocarSenha, trocarEmailConta } from '../js/auth.js';
import {
  escutarObras, escutarEtapas, escutarTodasEtapas,
  escutarPrecos,
  criarSolicitacao, atualizarSolicitacao, escutarSolicitacoes,
  registrarPagamentoCliente, escutarPagamentosCliente,
  escutarSolicitacoesPagamento, atualizarSolicitacaoPagamento,
  escutarNotificacoes, marcarNotificacaoLida,
  escutarOrcamentos, decidirOrcamento,
  escutarFechamentosCaixa, atualizarFechamentoCaixa,
  enviarAvaliacao,
  atualizarPerfilUsuario,
  uploadFoto, fileParaBase64,
  hoje, diasDiff
} from '../js/data.js';

let usuarioAtual = null;

observarAuth(async (user, perfil) => {
  if (!user) { window.location.href = '../index.html'; return; }
  if (!perfil || perfil.tipo !== 'cliente') { window.location.href = '../index.html'; return; }
  if (perfil.status !== 'aprovado') { window.location.href = '../pendente.html'; return; }
  usuarioAtual = { uid: user.uid, ...perfil };
  document.getElementById('loading').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  document.getElementById('topbar-sub').textContent = `Olá, ${perfil.nome || 'Cliente'}`;
  iniciarApp();
});

window.sairConta = async () => { await logout(); window.location.href = '../index.html'; };

// ---------- ESTADO ----------
let db_obras = [], db_precos = [], db_solicitacoes = [], db_pagamentosCliente = [], db_cobrancas = [], db_notificacoes = [], db_orcamentos = [], db_fechamentos = [];
let obraAtiva = null;
let unsubEtapasAtivas = null, unsubTodasEtapas = null;
let solFotos = [];
let editandoSolId = null;
let pagFotoCliente = null;
let pagObraId = null;
let cobAtiva = null; // id da solicitação sendo editada
let orcamentoAtivo = null; // orçamento sendo decidido no modal
let avaliacaoObraId = null, avaliacaoNotaAtual = 0;
let fechamentoSelecionadoIdx = 0;
let obraDetalheOrigem = 'obras';

function iniciarApp() {
  escutarObras(obras => {
    db_obras = obras;
    renderObras();
    if (document.getElementById('page-obra-detalhe').classList.contains('active') && obraAtiva) {
      const at = obras.find(o => o.id === obraAtiva.id);
      if (at) { obraAtiva = at; renderDetalheObra(); }
    }
    if (unsubTodasEtapas) unsubTodasEtapas();
    unsubTodasEtapas = escutarTodasEtapas(obras, todas => {
      window._todasEtapas = todas;
      renderObras(); // re-renderiza com etapas carregadas
      renderHistorico();
      renderAprovacao();
      if (document.getElementById('page-financeiro').classList.contains('active')) renderFinanceiro();
      if (document.getElementById('page-obra-detalhe').classList.contains('active') && obraAtiva) {
        obraAtiva._etapas = todas.filter(e => e.obraId === obraAtiva.id);
        renderDetalheObra();
      }
      updateBadge();
    });
  }, usuarioAtual.uid);
  escutarPrecos(p => { db_precos = p; renderPrecos(); popularSelectTiposSol(); });
  escutarSolicitacoes(s => { db_solicitacoes = s; renderObras(); }, usuarioAtual.uid);
  escutarPagamentosCliente(p => {
    db_pagamentosCliente = p;
    if (document.getElementById('page-financeiro').classList.contains('active')) renderFinanceiro();
  }, usuarioAtual.uid);
  escutarSolicitacoesPagamento(c => {
    db_cobrancas = c;
    renderCobrancasPendentes();
    updateBadge();
  }, usuarioAtual.uid);
  escutarNotificacoes(n => {
    db_notificacoes = n;
    renderAprovacao();
    updateBadge();
  }, usuarioAtual.uid);
  escutarOrcamentos(o => {
    db_orcamentos = o;
    renderAprovacao();
    renderObras();
    updateBadge();
  }, usuarioAtual.uid);
  escutarFechamentosCaixa(f => {
    db_fechamentos = f;
    if (document.getElementById('page-financeiro').classList.contains('active')) renderFinanceiro();
  });
}

// ---------- HELPERS ----------
function parseBRL(s) { return parseFloat((s || '0').replace(',', '.')) || 0; }
function fmtBRL(v) { return 'R$ ' + parseFloat(v || 0).toFixed(2).replace('.', ','); }
window.fmtValCliente = function(el) { let v = el.value.replace(/\D/g,''); if(!v){el.value='';return;} v=(parseInt(v)/100).toFixed(2); el.value=v.replace('.',','); };
function toast(m) { const t = document.getElementById('toast'); t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2800); }
window.bgClose = (e, id) => { if (e.target === document.getElementById(id)) document.getElementById(id).classList.remove('show'); };

window.openLightbox = (src, label) => {
  const lb = document.getElementById('lightbox');
  document.getElementById('lightbox-img').src = src;
  document.getElementById('lightbox-label').textContent = label;
  lb.style.display = 'flex'; document.body.style.overflow = 'hidden';
};
window.closeLightbox = () => { document.getElementById('lightbox').style.display = 'none'; document.body.style.overflow = ''; };

function fotosHTML(antes, depois, extras) {
  let html = '';
  const item = (src, lbl) => src
    ? `<div><img class="foto-thumb" src="${src}" alt="${lbl}" onclick="openLightbox('${src}','${lbl}')"><div style="font-size:10px;color:var(--text-muted);text-align:center;margin-top:4px">${lbl}</div></div>`
    : '';
  if (antes || depois) html += `<div class="fotos-row">${item(antes,'Antes')}${item(depois,'Depois')}</div>`;
  if (extras && extras.length) html += `<div class="fotos-row">${extras.map((f,i) => item(f.url, f.legenda||`Foto ${i+1}`)).join('')}</div>`;
  return html;
}

function chip(texto, tipo) {
  const classes = { green:'chip-green', yellow:'chip-yellow', red:'chip-red', blue:'chip-blue', gray:'chip-gray' };
  return `<span class="chip ${classes[tipo]||'chip-gray'}">${texto}</span>`;
}

// ---------- NAVEGAÇÃO ----------
const TITULOS = { obras:'Minhas obras', aprovacao:'Notificações', financeiro:'Financeiro', historico:'Histórico', precos:'Preços', simulacao:'Simulação de orçamento', perfil:'Meu perfil' };
window.goPage = function(p) {
  document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + p).classList.add('active');
  const nav = document.getElementById('nav-' + p);
  if (nav) nav.classList.add('active');
  const title = TITULOS[p] || '';
  document.getElementById('topbar-content').innerHTML = `<h1>${title === 'Minhas obras' ? 'EcoSistema' : title}</h1><div class="sub" id="topbar-sub">${usuarioAtual?.nome || ''}</div>`;
  if (p === 'financeiro') renderFinanceiro();
  if (p === 'simulacao') popularSelectSimulacao();
  if (p === 'perfil') preencherPerfil();
  updateBadge();
};

window.abrirPerfil = function() { window.goPage('perfil'); };

function updateBadge() {
  const nOrcamentos = db_orcamentos.filter(o => o.status === 'pendente').length;
  const nCob = db_cobrancas.filter(c => c.status === 'pendente').length;
  const nNaoLidas = db_notificacoes.filter(n => !n.lida).length;
  document.getElementById('dot-aprov').classList.toggle('show', nOrcamentos + nCob + nNaoLidas > 0);
}

// ============================================================
// OBRAS
// ============================================================
function renderObras() {
  // Solicitações pendentes/recusadas
  const elSol = document.getElementById('lista-solicitacoes-pendentes');
  const solAtivas = db_solicitacoes.filter(s => s.status !== 'aceita');
  if (solAtivas.length) {
    elSol.innerHTML = `<div class="section-label">Suas solicitações</div>` + solAtivas.map(s => {
      const aceita = s.status === 'aceita';
      const recusada = s.status === 'recusada';
      const badge = recusada ? chip('Recusada','red') : chip('Aguardando análise','yellow');
      const podeEditar = !aceita && !recusada;
      return `<div class="sol-card${recusada?' recusada':''}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
          <div style="font-size:14px;font-weight:600">${s.tipo||'Serviço'}</div>
          ${badge}
        </div>
        ${s.local ? `<div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px"><i class="ti ti-map-pin"></i> ${s.local}</div>` : ''}
        ${s.desc ? `<p style="font-size:13px;color:var(--text-secondary)">${s.desc}</p>` : ''}
        ${s.fotos && s.fotos.length ? `<div class="fotos-row" style="margin-top:8px">${s.fotos.map((f,i)=>`<img class="foto-thumb" src="${f}" alt="Foto ${i+1}" onclick="openLightbox('${f}','Foto ${i+1}')">`).join('')}</div>` : ''}
        ${podeEditar ? `<button class="btn-sm" style="margin-top:10px;width:100%;justify-content:center" onclick="editarSolicitacao('${s.id}')"><i class="ti ti-edit"></i> Editar solicitação</button>` : ''}
        ${recusada ? `<div style="font-size:12px;color:var(--text-danger);margin-top:8px"><i class="ti ti-info-circle"></i> Solicite um novo orçamento se desejar</div>` : ''}
      </div>`;
    }).join('');
  } else {
    elSol.innerHTML = '';
  }

  // Obras vinculadas
  const el = document.getElementById('lista-obras');
  if (!db_obras.length) {
    el.innerHTML = `<div class="empty"><i class="ti ti-building-off"></i><p>Nenhuma obra vinculada ainda.<br>Solicite um serviço abaixo.</p></div>`;
    return;
  }
  el.innerHTML = db_obras.map(o => {
    const todas = window._todasEtapas || [];
    const etapas = todas.filter(e => e.obraId === o.id);
    const emExec = etapas.filter(e => e.status === 'execucao').length;
    const done = etapas.filter(e => e.status === 'concluido').length;
    const pct = etapas.length ? Math.round(done / etapas.length * 100) : 0;
    const totalAtual = etapas.reduce((s, e) => s + parseBRL(e.val), 0);
    const previsto = parseBRL(o.valorPrevisto);
    const orcamentosObra = db_orcamentos.filter(x => x.obraId === o.id).sort((a,b) => (b.criadoEm?.toMillis?.()||0) - (a.criadoEm?.toMillis?.()||0));
    const orcamentoTopo = orcamentosObra[0] || null;
    const bloqueada = !!orcamentoTopo && orcamentoTopo.status !== 'aprovado';
    const atrasada = o.status === 'andamento' && o.fim && o.fim < hoje();

    // Alerta de valor previsto
    let alertaPrevisto = '';
    if (previsto > 0) {
      const pctValor = Math.round(totalAtual / previsto * 100);
      if (totalAtual > previsto) {
        alertaPrevisto = `<div style="font-size:11px;color:var(--text-danger);margin-bottom:4px">⚠️ Valor atual (${fmtBRL(totalAtual)}) ultrapassou o previsto (${fmtBRL(previsto)})</div>`;
      } else if (pctValor >= 80) {
        alertaPrevisto = `<div style="font-size:11px;color:var(--text-warning);margin-bottom:4px">⚠️ ${pctValor}% do valor previsto atingido (${fmtBRL(totalAtual)} de ${fmtBRL(previsto)})</div>`;
      }
    }

    return `<div class="obra-card" onclick="abrirObra('${o.id}')">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:10px">
        <div style="flex:1;min-width:0">
          <div style="font-size:16px;font-weight:600">${o.nome}</div>
          ${o.local ? `<div style="font-size:12px;color:var(--text-muted)">${o.local}</div>` : ''}
        </div>
        ${o.status === 'andamento' ? chip('Em andamento','yellow') : chip('Concluída','green')}
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
        ${emExec > 0 ? chip(`${emExec} em execução`,'blue') : ''}
        ${bloqueada ? chip(orcamentoTopo.status==='pendente' ? 'Orçamento aguardando aprovação' : 'Orçamento rejeitado','yellow') : ''}
        ${atrasada ? chip('Prazo vencido','red') : ''}
      </div>
      ${alertaPrevisto}
      <div style="display:flex;justify-content:space-between;margin-bottom:4px">
        <span style="font-size:11px;color:var(--text-muted)">${done}/${etapas.length} etapas concluídas</span>
        <span style="font-size:12px;font-weight:600;color:var(--brand)">${fmtBRL(totalAtual)}${previsto > 0 ? ` / ${fmtBRL(previsto)}` : ''}</span>
      </div>
      <div class="financial-bar"><div class="financial-fill" style="width:${pct}%"></div></div>
      ${previsto > 0 ? `<div class="financial-bar" style="margin-top:4px;background:#fee2e2"><div style="height:8px;background:#f87171;border-radius:4px;width:${Math.min(100, Math.round(totalAtual/previsto*100))}%;transition:width .4s"></div></div>
      <div style="display:flex;justify-content:space-between;margin-top:2px"><span style="font-size:10px;color:var(--text-muted)">Progresso dos serviços</span><span style="font-size:10px;color:var(--text-muted)">Valor previsto</span></div>` : ''}
      <div style="display:flex;justify-content:flex-end;margin-top:6px"><i class="ti ti-chevron-right" style="color:var(--text-muted);font-size:16px"></i></div>
    </div>`;
  }).join('');
}

window.voltarObraDetalhe = function() {
  window.goPage(obraDetalheOrigem);
};

window.abrirObra = function(id, origem) {
  obraDetalheOrigem = origem || 'obras';
  obraAtiva = db_obras.find(o => o.id === id);
  document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById('page-obra-detalhe').classList.add('active');
  document.getElementById('topbar-content').innerHTML = `<h1 style="font-size:15px">${obraAtiva.nome}</h1><div class="sub">${obraAtiva.local||''}</div>`;
  if (unsubEtapasAtivas) unsubEtapasAtivas();
  unsubEtapasAtivas = escutarEtapas(id, etapas => { obraAtiva._etapas = etapas; renderDetalheObra(); });
};

function renderDetalheObra() {
  if (!obraAtiva) return;
  const o = obraAtiva;
  const etapas = o._etapas || [];
  const done = etapas.filter(e => e.status === 'concluido').length;
  const pct = etapas.length ? Math.round(done / etapas.length * 100) : 0;
  const total = etapas.reduce((s, e) => s + parseBRL(e.val), 0);
  const pago = etapas.filter(e => e.pagamento === 'pago').reduce((s, e) => s + parseBRL(e.val), 0) + parseBRL(o.entrada);
  const saldo = total - pago;

  const orcamentosObra = db_orcamentos.filter(x => x.obraId === o.id).sort((a,b) => (b.criadoEm?.toMillis?.()||0) - (a.criadoEm?.toMillis?.()||0));
  const orcamentoTopo = orcamentosObra[0] || null;
  const orcamentoBanner = !orcamentoTopo ? '' : orcamentoTopo.status === 'pendente'
    ? `<div class="sol-card" style="border-color:#3b82f6;margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
          <div style="font-size:14px;font-weight:600">Orçamento aguardando sua aprovação</div>
          ${chip('Ação necessária','blue')}
        </div>
        <div class="etapa-valor" style="margin-bottom:6px">${fmtBRL(orcamentoTopo.valor)}</div>
        <button class="btn-brand" onclick="abrirDecidirOrcamento('${orcamentoTopo.id}')"><i class="ti ti-file-invoice"></i> Revisar orçamento</button>
      </div>`
    : orcamentoTopo.status === 'rejeitado'
    ? `<div class="sol-card recusada" style="margin-bottom:12px"><div style="font-size:13px;color:var(--text-danger)"><i class="ti ti-info-circle"></i> Você rejeitou o último orçamento. Aguarde um novo envio do administrador.</div></div>`
    : '';

  document.getElementById('obra-detalhe-header').innerHTML = `
    ${orcamentoBanner}
    <div class="card" style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        ${o.status === 'andamento' ? chip('Em andamento','yellow') : chip('Concluída','green')}
        ${o.desc ? `<span style="font-size:12px;color:var(--text-muted)">${o.desc}</span>` : ''}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px">
        <div class="stat"><span class="stat-val" style="font-size:14px">${fmtBRL(total)}</span><span class="stat-lbl">Total</span></div>
        <div class="stat"><span class="stat-val" style="font-size:14px;color:var(--brand)">${fmtBRL(pago)}</span><span class="stat-lbl">Pago</span></div>
        <div class="stat"><span class="stat-val" style="font-size:14px;color:${saldo>0?'var(--text-danger)':'var(--brand)'}">${fmtBRL(saldo)}</span><span class="stat-lbl">Saldo</span></div>
      </div>
      <div class="financial-bar"><div class="financial-fill" style="width:${pct}%"></div></div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:4px">${done}/${etapas.length} etapas concluídas — ${pct}%</div>
    </div>`;
  renderEtapasDetalhe(etapas);
}

function renderEtapasDetalhe(etapas) {
  const el = document.getElementById('obra-etapas');
  if (!etapas.length) { el.innerHTML = `<div class="empty"><i class="ti ti-clipboard"></i><p>Nenhuma etapa registrada ainda.</p></div>`; return; }
  const hoje_ = hoje();
  el.innerHTML = `<div class="section-label">Etapas</div>` + etapas.map(e => {
    const exec = e.status === 'execucao';
    const pago = e.pagamento === 'pago';
    const atrasada = exec && e.prazo && e.prazo < hoje_;

    let statusChip = exec ? chip('Em execução','blue') : chip('Concluído','green');
    let pagChip = !exec ? (pago ? chip('Pago','green') : chip('A pagar','red')) : '';

    return `<div class="etapa-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
        <div style="flex:1;min-width:0">
          <div style="font-size:15px;font-weight:600">${e.tipo}${e.isDiariaAvulsa ? ` — ${e.dataDiaria||''}` : ''}</div>
          ${obraAtiva.mostrarPedreiro !== false && e.parceiroNome ? `<div style="font-size:12px;color:var(--text-muted)">${e.parceiroNome}</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">${statusChip}${pagChip}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
        <div><div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px">Valor</div><div class="etapa-valor">${e.val ? fmtBRL(e.val) : '—'}</div></div>
        ${e.metros ? `<div><div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px">Quantidade</div><div style="font-size:15px;font-weight:600">${e.metros} m²</div></div>` : ''}
        ${exec ? `<div><div style="font-size:10px;color:var(--text-muted)">Início</div><div style="font-size:13px">${e.inicio||'—'}</div></div>` : ''}
        ${exec && e.prazo ? `<div><div style="font-size:10px;color:var(--text-muted)">Prazo</div><div style="font-size:13px${atrasada?';color:var(--text-danger)':''}">${e.prazo}${atrasada?' ⚠️':''}</div></div>` : ''}
        ${e.status==='concluido' && e.dataConc ? `<div><div style="font-size:10px;color:var(--text-muted)">Concluído em</div><div style="font-size:13px">${e.dataConc}</div></div>` : ''}
      </div>
      ${e.obs ? `<div style="font-size:13px;color:var(--text-secondary);margin-bottom:10px;padding:8px;background:var(--surface-1);border-radius:8px">${e.obs}</div>` : ''}
      ${e.nota ? `<div style="font-size:12px;color:var(--text-warning);margin-bottom:10px;padding:8px;background:var(--bg-warning);border-radius:8px"><i class="ti ti-note"></i> ${e.nota}</div>` : ''}
      ${fotosHTML(e.fotoAntes, e.fotoDepois, e.fotosExtras)}
    </div>`;
  }).join('');
}

// ============================================================
// SOLICITAÇÃO DE SERVIÇO
// ============================================================
function popularSelectTiposSol() {
  const sel = document.getElementById('sol-tipo'); if (!sel) return;
  sel.innerHTML = `<option value="">Selecione...</option>`;
  db_precos.forEach(p => { const o = document.createElement('option'); o.value = p.nome; o.textContent = p.nome; sel.appendChild(o); });
  const outros = document.createElement('option'); outros.value = 'Outros'; outros.textContent = 'Outros'; sel.appendChild(outros);
}

window.abrirNovaSolicitacao = function() {
  editandoSolId = null;
  solFotos = [];
  document.getElementById('sol-modal-title').textContent = 'Solicitar serviço';
  document.getElementById('sol-tipo').value = '';
  document.getElementById('sol-local').value = '';
  document.getElementById('sol-desc').value = '';
  document.getElementById('sol-fotos-preview').innerHTML = '';
  document.getElementById('btn-salvar-solicitacao').textContent = 'Enviar solicitação';
  popularSelectTiposSol();
  document.getElementById('modal-nova-solicitacao').classList.add('show');
};

window.editarSolicitacao = function(id) {
  const s = db_solicitacoes.find(x => x.id === id);
  if (!s) return;
  // Não permite editar se já foi aceita
  if (s.status === 'aceita') { toast('Esta solicitação já foi aceita e não pode ser editada'); return; }
  editandoSolId = id;
  solFotos = []; // fotos novas; existentes mantidas se não substituídas
  document.getElementById('sol-modal-title').textContent = 'Editar solicitação';
  popularSelectTiposSol();
  document.getElementById('sol-tipo').value = s.tipo || '';
  document.getElementById('sol-local').value = s.local || '';
  document.getElementById('sol-desc').value = s.desc || '';
  document.getElementById('sol-fotos-preview').innerHTML = '';
  document.getElementById('btn-salvar-solicitacao').textContent = 'Salvar alterações';
  document.getElementById('modal-nova-solicitacao').classList.add('show');
};

window.prevFotosSolicitacao = function(input) {
  const files = Array.from(input.files);
  if (!files.length) return;
  const preview = document.getElementById('sol-fotos-preview');
  files.forEach(file => {
    fileParaBase64(file).then(d => {
      solFotos.push(d);
      const img = document.createElement('img');
      img.src = d; img.className = 'foto-thumb'; img.style.cursor = 'default';
      preview.appendChild(img);
    });
  });
};

window.salvarSolicitacao = async function() {
  const tipo = document.getElementById('sol-tipo').value;
  const local = document.getElementById('sol-local').value.trim();
  const desc = document.getElementById('sol-desc').value.trim();
  if (!tipo) { toast('Selecione o tipo de serviço'); return; }
  if (!desc) { toast('Descreva o serviço'); return; }
  const btn = document.getElementById('btn-salvar-solicitacao');
  btn.disabled = true; btn.textContent = 'Enviando...';
  try {
    let fotosUrls = [];
    for (let i = 0; i < solFotos.length; i++) {
      const url = await uploadFoto(solFotos[i], `solicitacoes/${usuarioAtual.uid}/${Date.now()}_${i}.jpg`);
      fotosUrls.push(url);
    }
    if (editandoSolId) {
      const s = db_solicitacoes.find(x => x.id === editandoSolId);
      // Mantém fotos antigas se não enviou novas
      const fotosFinais = fotosUrls.length > 0 ? fotosUrls : (s ? s.fotos || [] : []);
      await atualizarSolicitacao(editandoSolId, { tipo, local, desc, fotos: fotosFinais });
      toast('Solicitação atualizada');
    } else {
      await criarSolicitacao({ tipo, local, desc, fotos: fotosUrls, clienteId: usuarioAtual.uid, clienteNome: usuarioAtual.nome || '' });
      toast('Solicitação enviada! Aguarde o contato.');
    }
    document.getElementById('modal-nova-solicitacao').classList.remove('show');
    editandoSolId = null;
  } catch(e) { toast('Erro ao enviar. Tente novamente.'); console.error(e); }
  btn.disabled = false; btn.textContent = editandoSolId ? 'Salvar alterações' : 'Enviar solicitação';
};

// ============================================================
// NOTIFICAÇÕES / ORÇAMENTOS
// ============================================================
window.abrirDecidirOrcamento = function(orcId) {
  orcamentoAtivo = db_orcamentos.find(o => o.id === orcId);
  if (!orcamentoAtivo) return;
  document.getElementById('orcamento-conteudo').innerHTML = `
    <div style="background:var(--surface-1);border-radius:10px;padding:12px;margin-bottom:12px">
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px">${orcamentoAtivo.obraNome||''}</div>
      <div class="etapa-valor" style="font-size:22px">${fmtBRL(orcamentoAtivo.valor)}</div>
      ${orcamentoAtivo.descricao ? `<div style="font-size:13px;color:var(--text-secondary);margin-top:8px">${orcamentoAtivo.descricao}</div>` : ''}
    </div>`;
  document.getElementById('orcamento-motivo').value = '';
  document.getElementById('orcamento-motivo-wrap').style.display = 'none';
  document.getElementById('orcamento-acoes').style.display = 'flex';
  document.getElementById('btn-confirmar-rejeicao').style.display = 'none';
  document.getElementById('modal-orcamento').classList.add('show');
};

window.mostrarMotivoRejeicao = function() {
  document.getElementById('orcamento-acoes').style.display = 'none';
  document.getElementById('orcamento-motivo-wrap').style.display = 'block';
  document.getElementById('btn-confirmar-rejeicao').style.display = 'block';
};

window.aprovarOrcamentoAtivo = async function() {
  if (!orcamentoAtivo) return;
  await decidirOrcamento(orcamentoAtivo.id, 'aprovado');
  document.getElementById('modal-orcamento').classList.remove('show');
  toast('Orçamento aprovado! A obra foi liberada.');
};

window.rejeitarOrcamentoAtivo = async function() {
  if (!orcamentoAtivo) return;
  const motivo = document.getElementById('orcamento-motivo').value.trim();
  if (!motivo) { toast('Descreva o motivo da rejeição'); return; }
  await decidirOrcamento(orcamentoAtivo.id, 'rejeitado', motivo);
  document.getElementById('modal-orcamento').classList.remove('show');
  toast('Orçamento rejeitado. O administrador foi avisado.');
};

// ---------- AVALIAÇÃO ----------
window.abrirAvaliacao = function(obraId) {
  avaliacaoObraId = obraId; avaliacaoNotaAtual = 0;
  document.getElementById('avaliacao-comentario').value = '';
  renderEstrelasAvaliacao();
  document.getElementById('modal-avaliacao').classList.add('show');
};
function renderEstrelasAvaliacao() {
  const el = document.getElementById('avaliacao-estrelas');
  el.innerHTML = [1,2,3,4,5].map(n => `<i class="ti ${n<=avaliacaoNotaAtual?'ti-star-filled':'ti-star'}" style="font-size:32px;color:#f59e0b;cursor:pointer" onclick="selecionarEstrela(${n})"></i>`).join('');
}
window.selecionarEstrela = function(n) { avaliacaoNotaAtual = n; renderEstrelasAvaliacao(); };
window.enviarAvaliacaoObra = async function() {
  if (!avaliacaoNotaAtual) { toast('Selecione uma nota de 1 a 5 estrelas'); return; }
  const comentario = document.getElementById('avaliacao-comentario').value.trim();
  await enviarAvaliacao(avaliacaoObraId, avaliacaoNotaAtual, comentario);
  document.getElementById('modal-avaliacao').classList.remove('show');
  toast('Avaliação enviada! Obrigado.');
};

// ============================================================
// HISTÓRICO
// ============================================================
function renderHistorico() {
  const el = document.getElementById('lista-historico');
  const rows = (window._todasEtapas || []).filter(e => e.status === 'concluido');
  if (!rows.length) { el.innerHTML = `<div class="empty"><i class="ti ti-history"></i><p>Nenhum serviço concluído ainda.</p></div>`; return; }
  el.innerHTML = `<div class="section-label">${rows.length} serviço${rows.length>1?'s':''} concluído${rows.length>1?'s':''}</div>` + rows.map(e => {
    const pago = e.pagamento === 'pago';
    const pagChip = pago ? chip('Pago','green') : chip('A pagar','red');
    return `<div class="etapa-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
        <div><div style="font-size:15px;font-weight:600">${e.tipo}</div><div style="font-size:12px;color:var(--text-muted)">${e.obraNome}</div></div>
        <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">${pagChip}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
        <div><div style="font-size:10px;color:var(--text-muted)">Valor</div><div class="etapa-valor">${e.val ? fmtBRL(e.val) : '—'}</div></div>
        <div><div style="font-size:10px;color:var(--text-muted)">Concluído</div><div style="font-size:13px">${e.dataConc||'—'}</div></div>
      </div>
      ${e.nota ? `<div style="font-size:12px;color:var(--text-warning);padding:8px;background:var(--bg-warning);border-radius:8px;margin-bottom:8px"><i class="ti ti-note"></i> ${e.nota}</div>` : ''}
      ${fotosHTML(e.fotoAntes, e.fotoDepois, e.fotosExtras)}
    </div>`;
  }).join('');
}

// ============================================================
// FINANCEIRO
// ============================================================
function meusFechamentosOrdenados() {
  return db_fechamentos.filter(f => f.clienteId === usuarioAtual.uid)
    .sort((a, b) => (b.criadoEm?.toMillis?.() || 0) - (a.criadoEm?.toMillis?.() || 0));
}

function renderResumoFechamentos(fechamentos) {
  if (!fechamentos.length) return '';
  if (fechamentoSelecionadoIdx >= fechamentos.length) fechamentoSelecionadoIdx = 0;
  const atual = fechamentos[fechamentoSelecionadoIdx];
  const porObra = {};
  (atual.itens || []).forEach(i => {
    if (!porObra[i.obraId]) porObra[i.obraId] = { obraId: i.obraId, obraNome: i.obraNome || 'Obra sem nome', itens: [] };
    porObra[i.obraId].itens.push(i);
  });
  const obrasHTML = Object.values(porObra).map(g => `
    <div style="margin-bottom:8px">
      <div style="font-weight:600;font-size:13px;cursor:pointer;color:var(--brand)" onclick="abrirObra('${g.obraId}', 'financeiro')">${g.obraNome}</div>
      ${g.itens.map(i => `<div style="font-size:12px;color:var(--text-muted);padding:2px 0">${i.tipo}${i.isDiaria?' (diária)':''}${i.manual?' 🕒 incluída manualmente':''} — ${i.dataConc||'em execução'}${i.detalheDiaria||''} · ${fmtBRL(i.valor)}</div>`).join('')}
    </div>`).join('') || `<div style="font-size:12px;color:var(--text-muted)">Nenhum item neste fechamento.</div>`;

  const statusCliente = atual.statusCliente || 'pendente';
  const statusChip = statusCliente === 'aceito' ? chip('Aceito','green') : statusCliente === 'contestado' ? chip('Contestado','red') : chip('Aguardando sua resposta','yellow');

  const acoesHTML = statusCliente === 'pendente' ? `
    <div class="confirm-bar" style="margin-top:10px">
      <button class="btn-sm btn-success" onclick="aceitarFechamento('${atual.id}')"><i class="ti ti-check"></i> Aceitar</button>
      <button class="btn-sm btn-danger" onclick="abrirContestarFechamento('${atual.id}')"><i class="ti ti-x"></i> Contestar</button>
    </div>
    <div id="fech-contestar-${atual.id}" style="display:none;margin-top:10px">
      <textarea id="fech-motivo-${atual.id}" rows="2" placeholder="Descreva o motivo da contestação"></textarea>
      <button class="btn-sm btn-danger" style="width:100%;justify-content:center;margin-top:6px" onclick="contestarFechamento('${atual.id}')">Enviar contestação</button>
    </div>` : statusCliente === 'contestado' ? `
    <div style="font-size:12px;color:var(--text-danger);margin-top:8px"><i class="ti ti-alert-circle"></i> Você contestou este fechamento: "${atual.contestacaoMotivo||''}". Aguardando revisão do administrador.</div>` : '';

  return `<div class="card" style="margin-bottom:12px;border-left:4px solid var(--brand)">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <div style="font-size:15px;font-weight:600">Fechamento de caixa</div>
      <span class="chip chip-green">${atual.periodoInicio || '—'} · ${atual.periodoFim || '—'}</span>
    </div>
    <div style="margin-bottom:8px">${statusChip}</div>
    <div class="stat" style="margin-bottom:10px"><span class="stat-val" style="font-size:16px">${fmtBRL(atual.totalReceber || 0)}</span><span class="stat-lbl">Total a pagar no período</span></div>
    ${atual.observacaoCliente ? `<div style="font-size:12px;background:var(--surface-1);border-radius:8px;padding:8px;margin-bottom:8px"><i class="ti ti-message-circle"></i> ${atual.observacaoCliente}</div>` : ''}
    ${obrasHTML}
    ${acoesHTML}
    <div style="margin-top:10px"><button class="btn-sm" style="width:100%;justify-content:center" onclick="abrirHistoricoFechamentos()"><i class="ti ti-history"></i> Ver histórico de fechamentos</button></div>
  </div>`;
}

window.aceitarFechamento = async function(id) {
  await atualizarFechamentoCaixa(id, { statusCliente: 'aceito' });
  toast('Fechamento aceito!');
};

window.abrirContestarFechamento = function(id) {
  const div = document.getElementById(`fech-contestar-${id}`);
  if (div) div.style.display = div.style.display === 'none' ? 'block' : 'none';
};

window.contestarFechamento = async function(id) {
  const motivo = document.getElementById(`fech-motivo-${id}`)?.value.trim();
  if (!motivo) { toast('Descreva o motivo da contestação'); return; }
  await atualizarFechamentoCaixa(id, { statusCliente: 'contestado', contestacaoMotivo: motivo, contestadoEm: hoje() });
  const pendentes = db_cobrancas.filter(c => c.fechamentoId === id && c.status === 'pendente');
  for (const c of pendentes) {
    await atualizarSolicitacaoPagamento(c.id, { status: 'cancelada' });
  }
  toast('Contestação enviada ao administrador.');
};

window.abrirHistoricoFechamentos = function() {
  const meus = meusFechamentosOrdenados();
  const el = document.getElementById('lista-historico-fechamentos');
  el.innerHTML = meus.length ? meus.map((f, idx) => {
    const statusCliente = f.statusCliente || 'pendente';
    const sc = statusCliente === 'aceito' ? chip('Aceito','green') : statusCliente === 'contestado' ? chip('Contestado','red') : chip('Pendente','yellow');
    return `<div class="row-item" style="cursor:pointer" onclick="selecionarFechamentoHistorico(${idx})">
      <div class="row-info"><div class="row-title">${f.periodoInicio} a ${f.periodoFim}</div><div class="row-meta">${fmtBRL(f.totalReceber||0)}</div></div>
      ${sc}
    </div>`;
  }).join('') : `<div class="empty"><i class="ti ti-history-off"></i><p>Nenhum fechamento no histórico.</p></div>`;
  window.showModal('modal-historico-fechamentos');
};

window.selecionarFechamentoHistorico = function(idx) {
  fechamentoSelecionadoIdx = idx;
  window.closeModal('modal-historico-fechamentos');
  renderFinanceiro();
};

function renderFinanceiro() {
  const el = document.getElementById('lista-financeiro');
  const todas = window._todasEtapas || [];
  if (!db_obras.length) { el.innerHTML = `<div class="empty"><i class="ti ti-cash-off"></i><p>Nenhuma obra encontrada.</p></div>`; return; }

  let totalGeralObra = 0, totalGeralPago = 0;
  const meusFechamentos = meusFechamentosOrdenados();
  const resumoFechamentoHTML = renderResumoFechamentos(meusFechamentos);
  const html = db_obras.map(o => {
    const etapas = todas.filter(e => e.obraId === o.id);
    const totalObra = etapas.reduce((s, e) => s + parseBRL(e.val), 0);
    const totalPago = etapas.filter(e => e.pagamento === 'pago').reduce((s, e) => s + parseBRL(e.val), 0);
    const entrada = parseBRL(o.entrada);
    const totalPagoFinal = totalPago + entrada;
    const saldo = totalObra - totalPagoFinal;
    const pct = totalObra > 0 ? Math.min(100, Math.round(totalPagoFinal / totalObra * 100)) : 0;
    totalGeralObra += totalObra; totalGeralPago += totalPagoFinal;

    const pgStatus = o.pagObra || 'a_pagar';
    const pgChip = pgStatus === 'pago' ? chip('Pago','green') : pgStatus === 'parcial' ? chip('Parcial','yellow') : chip('A pagar','red');

    const etapasHTML = etapas.length ? etapas.map(e => {
      const exec = e.status === 'execucao';
      const pago = e.pagamento === 'pago';
      let st, sc;
      if (exec) { st='Em execução'; sc='blue'; }
      else if (pago) { st='Pago'; sc='green'; }
      else { st='A pagar'; sc='red'; }
      return `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:0.5px solid var(--border)">
        <div>
          <div style="font-size:13px;font-weight:500">${e.tipo}</div>
          <div style="font-size:11px;color:var(--text-muted)">${e.val ? fmtBRL(e.val) : '—'}</div>
          ${e.nota ? `<div style="font-size:10px;color:var(--text-warning)"><i class="ti ti-note"></i> ${e.nota}</div>` : ''}
        </div>
        ${chip(st, sc)}
      </div>`;
    }).join('') : `<div style="font-size:13px;color:var(--text-muted);padding:8px 0">Nenhuma etapa.</div>`;

    return `<div class="card" style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
        <div><div style="font-size:16px;font-weight:600">${o.nome}</div>${o.local?`<div style="font-size:12px;color:var(--text-muted)">${o.local}</div>`:''}</div>
        ${pgChip}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px">
        <div class="stat"><span class="stat-val" style="font-size:13px">${fmtBRL(totalObra)}</span><span class="stat-lbl">Total da obra</span></div>
        <div class="stat"><span class="stat-val" style="font-size:13px;color:var(--brand)">${fmtBRL(totalPagoFinal)}</span><span class="stat-lbl">Pago</span></div>
        <div class="stat"><span class="stat-val" style="font-size:13px;color:${saldo>0?'var(--text-danger)':'var(--brand)'}">${fmtBRL(saldo)}</span><span class="stat-lbl">${saldo>0?'A pagar':'Quitado'}</span></div>
      </div>
      <div class="financial-bar"><div class="financial-fill" style="width:${pct}%"></div></div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:10px">${pct}% pago${entrada>0?` · Entrada: ${fmtBRL(entrada)}`:''}</div>
      ${saldo > 0 ? `<button class="btn-brand" style="margin-bottom:12px" onclick="abrirRegistrarPagamento('${o.id}','${o.nome}')"><i class="ti ti-cash"></i> Registrar pagamento</button>` : ''}
      ${pagamentosObraHTML(o.id)}
      ${etapasHTML}
    </div>`;
  }).join('');

  const saldoGeral = totalGeralObra - totalGeralPago;
  el.innerHTML = resumoFechamentoHTML + `
    <div class="card" style="background:#0f172a;color:#fff;margin-bottom:16px;border:none">
      <div style="font-size:13px;color:#94a3b8;margin-bottom:8px">Resumo geral</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
        <div><div style="font-size:18px;font-weight:700">${fmtBRL(totalGeralObra)}</div><div style="font-size:10px;color:#94a3b8">Total obras</div></div>
        <div><div style="font-size:18px;font-weight:700;color:#1D9E75">${fmtBRL(totalGeralPago)}</div><div style="font-size:10px;color:#94a3b8">Pago</div></div>
        <div><div style="font-size:18px;font-weight:700;color:${saldoGeral>0?'#f87171':'#1D9E75'}">${fmtBRL(saldoGeral)}</div><div style="font-size:10px;color:#94a3b8">${saldoGeral>0?'A pagar':'Quitado'}</div></div>
      </div>
    </div>` + html;
}

// ---------- PREÇOS ----------
function renderPrecos() {
  const el = document.getElementById('lista-precos');
  if (!db_precos.length) { el.innerHTML = `<div class="empty"><i class="ti ti-receipt-off"></i><p>Nenhum preço cadastrado.</p></div>`; return; }
  el.innerHTML = db_precos.map(p => `<div class="price-row"><span class="price-name">${p.nome}</span><span class="price-val">R$ ${p.val}/m²</span></div>`).join('');
}

// ============================================================
// SIMULAÇÃO DE ORÇAMENTO
// ============================================================
let simulacaoItens = [];

function popularSelectSimulacao() {
  const sel = document.getElementById('sim-tipo-servico'); if (!sel) return;
  sel.innerHTML = `<option value="">Selecione...</option>`;
  db_precos.forEach(p => { const o = document.createElement('option'); o.value = p.id; o.textContent = `${p.nome} — R$ ${p.val}/m²`; sel.appendChild(o); });
  renderSimItens();
}

window.adicionarItemSimulacao = function() {
  const precoId = document.getElementById('sim-tipo-servico').value;
  const m2 = parseFloat((document.getElementById('sim-m2').value || '0').replace(',', '.'));
  if (!precoId) { toast('Selecione o serviço'); return; }
  if (!m2 || m2 <= 0) { toast('Informe a metragem'); return; }
  const preco = db_precos.find(p => p.id === precoId);
  if (!preco) return;
  const valorM2 = parseBRL(preco.val);
  simulacaoItens.push({ tipo: preco.nome, valorM2, m2, subtotal: valorM2 * m2 });
  document.getElementById('sim-m2').value = '';
  renderSimItens();
};

window.removerItemSimulacao = function(index) {
  simulacaoItens.splice(index, 1);
  renderSimItens();
};

function renderSimItens() {
  const el = document.getElementById('lista-sim-itens');
  const totalEl = document.getElementById('sim-total');
  if (!el) return;
  el.innerHTML = simulacaoItens.length ? simulacaoItens.map((it, i) => `
    <div class="row-item">
      <div class="row-info"><div class="row-title">${it.tipo}</div><div class="row-meta">${it.m2}m² × ${fmtBRL(it.valorM2)}</div></div>
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:13px;font-weight:600;color:var(--text-success)">${fmtBRL(it.subtotal)}</span>
        <button class="btn-sm btn-danger" onclick="removerItemSimulacao(${i})"><i class="ti ti-trash"></i></button>
      </div>
    </div>`).join('') : `<div class="empty"><i class="ti ti-list-numbers"></i><p>Nenhum item adicionado ainda.</p></div>`;
  const total = simulacaoItens.reduce((s, it) => s + it.subtotal, 0);
  if (totalEl) totalEl.textContent = fmtBRL(total);
}

window.solicitarObraSimulada = async function() {
  const nomeObraDesejada = document.getElementById('sim-nome-obra').value.trim();
  if (!nomeObraDesejada) { toast('Informe o nome da obra desejada'); return; }
  if (!simulacaoItens.length) { toast('Adicione ao menos um item na simulação'); return; }
  const total = simulacaoItens.reduce((s, it) => s + it.subtotal, 0);
  if (!confirm(`Deseja solicitar a obra "${nomeObraDesejada}" com valor estimado de ${fmtBRL(total)}?`)) return;
  try {
    await criarSolicitacao({
      tipo: 'simulacao_orcamento',
      clienteId: usuarioAtual.uid, clienteNome: usuarioAtual.nome || '',
      nomeObraDesejada,
      etapasSimuladas: simulacaoItens.slice(),
      valorTotalSimulado: total,
      desc: `Simulação de orçamento: ${simulacaoItens.map(i => `${i.tipo} (${i.m2}m²)`).join(', ')}`
    });
    simulacaoItens = [];
    document.getElementById('sim-nome-obra').value = '';
    renderSimItens();
    toast('Solicitação enviada! Aguarde o administrador aceitar.');
    window.goPage('obras');
  } catch (e) { toast('Erro ao enviar solicitação'); console.error(e); }
};

// ============================================================
// PAGAMENTOS DO CLIENTE
// ============================================================
function pagamentosObraHTML(obraId) {
  const pags = db_pagamentosCliente.filter(p => p.obraId === obraId);
  if (!pags.length) return '';
  return `<div style="margin-bottom:12px">
    <div style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:6px">Pagamentos registrados</div>
    ${pags.map(p => {
      const statusChip = p.status === 'confirmado' ? chip('Confirmado','green') : p.status === 'contestado' ? chip('Contestado','red') : chip('Aguardando confirmação','yellow');
      return `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px;background:var(--surface-1);border-radius:8px;margin-bottom:6px">
        <div>
          <div style="font-size:13px;font-weight:600">${fmtBRL(p.valor)}</div>
          <div style="font-size:11px;color:var(--text-muted)">${p.formaPagamento||''}${p.obs?' · '+p.obs:''}</div>
          ${p.motivoContestacao ? `<div style="font-size:11px;color:var(--text-danger)"><i class="ti ti-alert-circle"></i> ${p.motivoContestacao}</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
          ${statusChip}
          ${p.comprovante ? `<button class="btn-sm" onclick="openLightbox('${p.comprovante}','Comprovante')" style="font-size:10px;padding:3px 8px"><i class="ti ti-receipt"></i></button>` : ''}
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

window.abrirRegistrarPagamento = function(obraId, obraNome) {
  pagObraId = obraId;
  pagFotoCliente = null;
  document.getElementById('pag-cli-valor').value = '';
  document.getElementById('pag-cli-forma').value = 'pix';
  document.getElementById('pag-cli-obs').value = '';
  document.getElementById('pag-cli-obra-nome').textContent = obraNome;
  document.getElementById('pag-cli-prev-comprovante').style.display = 'none';
  document.getElementById('pag-cli-icon-comprovante').style.display = 'flex';
  document.getElementById('modal-pagamento-cliente').classList.add('show');
};

window.pagClieFotoChanged = function(input) {
  const file = input.files[0]; if (!file) return;
  fileParaBase64(file).then(d => {
    pagFotoCliente = d;
    document.getElementById('pag-cli-prev-comprovante').src = d;
    document.getElementById('pag-cli-prev-comprovante').style.display = 'block';
    document.getElementById('pag-cli-icon-comprovante').style.display = 'none';
  });
};

window.salvarPagamentoCliente = async function() {
  const valor = document.getElementById('pag-cli-valor').value;
  const forma = document.getElementById('pag-cli-forma').value;
  const obs = document.getElementById('pag-cli-obs').value.trim();
  if (!valor) { toast('Informe o valor pago'); return; }
  const btn = document.getElementById('btn-salvar-pag-cliente');
  btn.disabled = true; btn.textContent = 'Enviando...';
  try {
    let comprovanteUrl = null;
    if (pagFotoCliente) comprovanteUrl = await uploadFoto(pagFotoCliente, `pagamentos_cliente/${usuarioAtual.uid}/${Date.now()}.jpg`);
    await registrarPagamentoCliente({
      obraId: pagObraId,
      clienteId: usuarioAtual.uid,
      clienteNome: usuarioAtual.nome || '',
      valor, formaPagamento: forma, obs,
      comprovante: comprovanteUrl,
      data: hoje()
    });
    document.getElementById('modal-pagamento-cliente').classList.remove('show');
    toast('Pagamento registrado! Aguardando confirmação do administrador.');
  } catch(e) { toast('Erro ao registrar. Tente novamente.'); console.error(e); }
  btn.disabled = false; btn.textContent = 'Registrar pagamento';
};

// ============================================================
// SOLICITAÇÕES DE PAGAMENTO DO ADMIN (cliente recebe cobrança)
// ============================================================
let solicitacaoPagamentoAtiva = null;
let pagSolFoto = null;

// ============================================================
// COBRANÇAS RECEBIDAS DO ADMIN
// ============================================================
let cobFotoComprovante = null;

function renderCobrancasPendentes() {
  // Mostra cobranças pendentes na aba de aprovação
  const el = document.getElementById('lista-aprovacao');
  if (!el) return;
  renderAprovacao(); // re-renderiza incluindo cobranças
}

// Sobrescreve renderAprovacao para incluir cobranças, orçamentos e notificações
function renderAprovacao() {
  const el = document.getElementById('lista-aprovacao');
  if (!el) return;
  const rowsOrcamentos = db_orcamentos.filter(o => o.status === 'pendente');
  const rowsCobracas = db_cobrancas.filter(c => c.status === 'pendente');
  const rowsNotificacoes = db_notificacoes;

  if (!rowsOrcamentos.length && !rowsCobracas.length && !rowsNotificacoes.length) {
    el.innerHTML = `<div class="empty"><i class="ti ti-circle-check"></i><p>Nenhuma notificação por aqui ainda.</p></div>`;
    return;
  }

  let html = '';

  // Orçamentos aguardando aprovação (mais urgente — bloqueia a obra)
  if (rowsOrcamentos.length) {
    html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      <i class="ti ti-file-invoice" style="font-size:16px;color:#3b82f6"></i>
      <span style="font-size:13px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.5px">Orçamentos para aprovar</span>
    </div>`;
    html += rowsOrcamentos.map(o => `
      <div class="etapa-card" style="border:1.5px solid #3b82f6;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
          <div><div style="font-size:15px;font-weight:600">${o.obraNome}</div><div style="font-size:12px;color:var(--text-muted)">${o.criadoEm?.toDate?.()?.toLocaleDateString('pt-BR')||''}</div></div>
          ${chip('Aguardando sua decisão','blue')}
        </div>
        <div class="etapa-valor" style="margin-bottom:8px">${fmtBRL(o.valor)}</div>
        ${o.descricao ? `<div style="font-size:13px;color:var(--text-secondary);margin-bottom:10px">${o.descricao}</div>` : ''}
        <button class="btn-brand" onclick="abrirDecidirOrcamento('${o.id}')"><i class="ti ti-file-invoice"></i> Revisar orçamento</button>
      </div>`).join('');
  }

  // Cobranças do admin
  if (rowsCobracas.length) {
    html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;margin-top:${rowsOrcamentos.length?'16px':'0'}">
      <i class="ti ti-cash" style="font-size:16px;color:#1D9E75"></i>
      <span style="font-size:13px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.5px">Solicitações de pagamento</span>
    </div>`;
    html += rowsCobracas.map(c => `
      <div class="etapa-card" style="border:1.5px solid #1D9E75;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
          <div>
            <div style="font-size:15px;font-weight:600">${c.obraNome}</div>
            <div style="font-size:12px;color:var(--text-muted)">${(c.etapas||[]).length} etapa${(c.etapas||[]).length>1?'s':''} · ${c.criadoEm?.toDate?.()?.toLocaleDateString('pt-BR')||''}</div>
          </div>
          <div style="font-size:20px;font-weight:700;color:#1D9E75">${fmtBRL(c.total)}</div>
        </div>
        ${c.mensagem ? `<div style="font-size:13px;color:var(--text-secondary);margin-bottom:10px;padding:8px;background:var(--surface-1);border-radius:8px">${c.mensagem}</div>` : ''}
        <div style="margin-bottom:10px">
          ${(c.etapas||[]).map(e => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:0.5px solid var(--border)">
            <span style="font-size:13px">${e.tipo}</span>
            <span style="font-size:13px;font-weight:600;color:var(--text-success)">${e.val ? fmtBRL(e.val) : '—'}</span>
          </div>`).join('')}
          <div style="display:flex;justify-content:space-between;padding:8px 0;font-weight:700">
            <span>Total</span><span style="color:#1D9E75">${fmtBRL(c.total)}</span>
          </div>
        </div>
        ${c.pix ? `<div style="background:#f0fdf4;border:0.5px solid #86efac;border-radius:8px;padding:10px;margin-bottom:12px">
          <div style="font-size:11px;font-weight:700;color:#15803d;margin-bottom:6px"><i class="ti ti-brand-whatsapp"></i> Dados para pagamento PIX</div>
          <div style="font-size:13px"><strong>${c.pix.tipo?.toUpperCase()}: </strong>${c.pix.chave}</div>
          <div style="font-size:13px"><strong>Favorecido: </strong>${c.pix.nome}</div>
          ${c.pix.banco ? `<div style="font-size:13px"><strong>Banco: </strong>${c.pix.banco}</div>` : ''}
        </div>` : ''}
        <button class="btn-brand" onclick="abrirCobranca('${c.id}')"><i class="ti ti-clipboard-check"></i> Responder cobrança</button>
      </div>`).join('');
  }

  // Feed de notificações (informativo)
  if (rowsNotificacoes.length) {
    html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;margin-top:${(rowsOrcamentos.length||rowsCobracas.length)?'16px':'0'}">
      <i class="ti ti-bell" style="font-size:16px;color:var(--text-muted)"></i>
      <span style="font-size:13px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.5px">Atualizações</span>
    </div>`;
    html += rowsNotificacoes.map(n => {
      const obra = db_obras.find(o => o.id === n.obraId);
      const podeAvaliar = n.tipo === 'obra_concluida' && obra && !obra.avaliacaoNota;
      return `<div class="etapa-card" style="margin-bottom:8px;${n.lida?'opacity:.7;':''}background:${n.lida?'var(--surface-1)':'var(--surface-2)'}" onclick="marcarNotifLida('${n.id}')">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
          <div style="flex:1;min-width:0">
            <div style="font-size:14px;font-weight:600">${n.titulo||''}</div>
            <div style="font-size:12px;color:var(--text-muted);margin:2px 0 4px">${n.obraNome||''}</div>
            <div style="font-size:13px;color:var(--text-secondary)">${n.mensagem||''}</div>
          </div>
          ${!n.lida ? `<span style="width:8px;height:8px;border-radius:50%;background:#3b82f6;flex-shrink:0;margin-top:4px"></span>` : ''}
        </div>
        ${podeAvaliar ? `<button class="btn-brand" style="margin-top:10px" onclick="event.stopPropagation();abrirAvaliacao('${obra.id}')"><i class="ti ti-star"></i> Avaliar serviço</button>` : ''}
        ${n.tipo === 'obra_concluida' && obra && obra.avaliacaoNota ? `<div style="font-size:12px;color:var(--text-success);margin-top:8px"><i class="ti ti-star-filled"></i> Você avaliou com ${obra.avaliacaoNota} estrela${obra.avaliacaoNota>1?'s':''}</div>` : ''}
      </div>`;
    }).join('');
  }

  el.innerHTML = html;
}

window.marcarNotifLida = function(id) {
  const n = db_notificacoes.find(x => x.id === id);
  if (n && !n.lida) marcarNotificacaoLida(id);
};

window.abrirCobranca = function(cobId) {
  cobAtiva = db_cobrancas.find(c => c.id === cobId); if (!cobAtiva) return;
  cobFotoComprovante = null;
  document.getElementById('cob-form-aceitar').style.display = 'none';
  document.getElementById('cob-form-contestar').style.display = 'none';
  document.getElementById('cob-acoes-iniciais').style.display = 'block';
  document.getElementById('cob-prev-comprovante').style.display = 'none';
  document.getElementById('cob-icon-comprovante').style.display = 'flex';
  document.getElementById('modal-cobranca').classList.add('show');
};

window.mostrarFormAceitar = function() {
  document.getElementById('cob-acoes-iniciais').style.display = 'none';
  document.getElementById('cob-form-contestar').style.display = 'none';
  document.getElementById('cob-form-aceitar').style.display = 'block';
};
window.mostrarFormContestar = function() {
  document.getElementById('cob-acoes-iniciais').style.display = 'none';
  document.getElementById('cob-form-aceitar').style.display = 'none';
  document.getElementById('cob-form-contestar').style.display = 'block';
};
window.voltarCobranca = function() {
  document.getElementById('cob-form-aceitar').style.display = 'none';
  document.getElementById('cob-form-contestar').style.display = 'none';
  document.getElementById('cob-acoes-iniciais').style.display = 'block';
};

window.cobFotoChanged = function(input) {
  const file = input.files[0]; if (!file) return;
  fileParaBase64(file).then(d => {
    cobFotoComprovante = d;
    document.getElementById('cob-prev-comprovante').src = d;
    document.getElementById('cob-prev-comprovante').style.display = 'block';
    document.getElementById('cob-icon-comprovante').style.display = 'none';
  });
};

window.confirmarPagamentoCob = async function() {
  if (!cobAtiva) return;
  const forma = document.getElementById('cob-forma-cli').value;
  const btn = document.getElementById('btn-confirmar-pag-cob');
  btn.disabled = true; btn.textContent = 'Enviando...';
  try {
    let comprovanteUrl = null;
    if (cobFotoComprovante) comprovanteUrl = await uploadFoto(cobFotoComprovante, `cobracas/${usuarioAtual.uid}/${Date.now()}.jpg`);
    await atualizarSolicitacaoPagamento(cobAtiva.id, {
      status: 'paga', formaPagamento: forma, comprovante: comprovanteUrl, dataPagamento: hoje()
    });
    document.getElementById('modal-cobranca').classList.remove('show');
    toast('Pagamento confirmado! O administrador será notificado.');
  } catch(e) { toast('Erro ao confirmar'); console.error(e); }
  btn.disabled = false; btn.textContent = 'Confirmar pagamento';
};

window.contestarCobranca = async function() {
  if (!cobAtiva) return;
  const motivo = document.getElementById('cob-motivo-contestacao').value.trim();
  if (!motivo) { toast('Descreva o motivo da contestação'); return; }
  const btn = document.getElementById('btn-contestar-cob');
  btn.disabled = true; btn.textContent = 'Enviando...';
  try {
    await atualizarSolicitacaoPagamento(cobAtiva.id, { status: 'contestada', contestacao: motivo });
    document.getElementById('modal-cobranca').classList.remove('show');
    toast('Contestação enviada ao administrador.');
  } catch(e) { toast('Erro ao enviar'); console.error(e); }
  btn.disabled = false; btn.textContent = 'Enviar contestação';
};

// ============================================================
// PERFIL
// ============================================================
function preencherPerfil() {
  document.getElementById('perfil-nome').value = usuarioAtual.nome || '';
  document.getElementById('perfil-telefone').value = usuarioAtual.telefone || '';
  document.getElementById('perfil-novo-email').value = '';
  document.getElementById('perfil-senha-email').value = '';
  document.getElementById('perfil-senha-atual').value = '';
  document.getElementById('perfil-senha-nova').value = '';
  document.getElementById('perfil-senha-nova-confirma').value = '';
}

window.salvarDadosPerfil = async function() {
  const nome = document.getElementById('perfil-nome').value.trim();
  const telefone = document.getElementById('perfil-telefone').value.trim();
  if (!nome) { toast('Informe o nome'); return; }
  try {
    await atualizarPerfilUsuario(usuarioAtual.uid, { nome, telefone });
    usuarioAtual.nome = nome; usuarioAtual.telefone = telefone;
    document.getElementById('topbar-sub').textContent = nome;
    toast('Dados atualizados!');
  } catch (e) { toast('Erro ao salvar dados'); console.error(e); }
};

window.salvarTrocaEmail = async function() {
  const novoEmail = document.getElementById('perfil-novo-email').value.trim();
  const senha = document.getElementById('perfil-senha-email').value;
  if (!novoEmail) { toast('Informe o novo e-mail'); return; }
  if (!senha) { toast('Informe a senha atual'); return; }
  try {
    await trocarEmailConta(senha, novoEmail);
    usuarioAtual.email = novoEmail;
    document.getElementById('perfil-novo-email').value = '';
    document.getElementById('perfil-senha-email').value = '';
    toast('E-mail atualizado!');
  } catch (e) { toast(mensagemErroFirebase(e)); console.error(e); }
};

window.salvarTrocaSenha = async function() {
  const senhaAtual = document.getElementById('perfil-senha-atual').value;
  const novaSenha = document.getElementById('perfil-senha-nova').value;
  const confirma = document.getElementById('perfil-senha-nova-confirma').value;
  if (!senhaAtual) { toast('Informe a senha atual'); return; }
  if (!novaSenha || novaSenha.length < 6) { toast('A nova senha precisa ter pelo menos 6 caracteres'); return; }
  if (novaSenha !== confirma) { toast('As senhas não coincidem'); return; }
  try {
    await trocarSenha(senhaAtual, novaSenha);
    document.getElementById('perfil-senha-atual').value = '';
    document.getElementById('perfil-senha-nova').value = '';
    document.getElementById('perfil-senha-nova-confirma').value = '';
    toast('Senha alterada!');
  } catch (e) { toast(mensagemErroFirebase(e)); console.error(e); }
};
