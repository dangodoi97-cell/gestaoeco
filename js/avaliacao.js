// Funções puras de atribuição e agregação para a "Avaliação por Critérios vinculada ao Parceiro" (Unidade 3).
// Sem dependência de Firebase/DOM — recebem dados já carregados em memória pelos listeners existentes.

const CRITERIOS = ['tempoExecucao', 'acabamento', 'organizacaoLimpeza'];

// Média simples dos 3 critérios de uma única avaliação, arredondada a 1 casa decimal.
export function mediaCriterios(criterios) {
  const soma = CRITERIOS.reduce((s, c) => s + (criterios[c] || 0), 0);
  return Math.round((soma / CRITERIOS.length) * 10) / 10;
}

// Parceiros distintos creditados por uma obra: apenas os vinculados a etapas
// dessa obra com status 'concluido' (Functional Design Q2=A). Lê tanto o formato
// legado (etapa.parceiroId, sem nome) quanto o atual (etapa.parceiros[], com nome).
export function parceirosCreditados(etapas, obraId) {
  const concluidas = etapas.filter(e => e.obraId === obraId && e.status === 'concluido');
  const porId = new Map();
  for (const etapa of concluidas) {
    if (Array.isArray(etapa.parceiros)) {
      for (const p of etapa.parceiros) {
        if (p.parceiroId && !porId.has(p.parceiroId)) porId.set(p.parceiroId, { parceiroId: p.parceiroId, nome: p.nome || '' });
      }
    }
    if (etapa.parceiroId && !porId.has(etapa.parceiroId)) {
      porId.set(etapa.parceiroId, { parceiroId: etapa.parceiroId, nome: etapa.parceiroNome || '' });
    }
  }
  return Array.from(porId.values());
}

// Nota acumulada de um parceiro: média (não soma) de cada critério + da Geral,
// entre todas as obras que o creditam (Functional Design Q1=A/Q5 anterior — só obras
// já no novo formato; avaliações legadas com avaliacaoNota não entram nessa conta).
export function calcularAcumuladoParceiro(obras, parceiroId) {
  const avaliadas = obras.filter(o => (o.avaliacaoParceiros || []).some(p => p.parceiroId === parceiroId) && o.avaliacaoCriterios);
  const totalServicosAvaliados = avaliadas.length;
  if (!totalServicosAvaliados) {
    return { totalServicosAvaliados: 0, mediaTempoExecucao: null, mediaAcabamento: null, mediaOrganizacaoLimpeza: null, mediaGeral: null };
  }
  const media = (valores) => Math.round((valores.reduce((s, v) => s + v, 0) / valores.length) * 10) / 10;
  return {
    totalServicosAvaliados,
    mediaTempoExecucao: media(avaliadas.map(o => o.avaliacaoCriterios.tempoExecucao)),
    mediaAcabamento: media(avaliadas.map(o => o.avaliacaoCriterios.acabamento)),
    mediaOrganizacaoLimpeza: media(avaliadas.map(o => o.avaliacaoCriterios.organizacaoLimpeza)),
    mediaGeral: media(avaliadas.map(o => o.avaliacaoGeral))
  };
}
