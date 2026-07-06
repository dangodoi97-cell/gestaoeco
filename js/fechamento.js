// Funções puras de classificação e cálculo para o "Fechamento de Caixa" (Unidade 1).
// Sem dependência de Firebase/DOM — recebem dados já carregados em memória pelos listeners existentes.

export function parseBRLValue(str) {
  return parseFloat((str || '0').toString().replace(',', '.')) || 0;
}

// Classifica uma obra em relação ao filtro de cliente: 'cliente' (cliente aprovado vinculado)
// ou 'outros' (sem clienteId, cliente inexistente/deletado, ou status diferente de 'aprovado').
export function classifyObraClient(obra, usuariosById) {
  const clienteId = obra.clienteId;
  if (!clienteId) return 'outros';
  const cliente = usuariosById[clienteId];
  if (!cliente || cliente.status !== 'aprovado') return 'outros';
  return 'cliente';
}

// Valor de entrada/sinal já recebido do cliente — indicador de fluxo de caixa,
// não usado no cálculo da sobra (correção de 2026-07-06, ver audit.md).
export function entradaObra(obra) {
  return parseBRLValue(obra.entrada);
}

// Valor total bruto cobrado do cliente (soma do "val" de cada etapa da obra) —
// é isso, não a entrada, que compõe o lucro líquido junto com o repasse.
export function valorTotalObra(obra, etapas) {
  return etapas
    .filter(e => e.obraId === obra.id)
    .reduce((soma, e) => soma + parseBRLValue(e.val), 0);
}

export function repasseObra(obra, etapas) {
  return etapas
    .filter(e => e.obraId === obra.id)
    .reduce((soma, e) => soma + parseBRLValue(e.valRepasse), 0);
}

// Lucro líquido da obra: valor total cobrado do cliente menos o repasse aos parceiros.
// Independe de quanto já foi efetivamente recebido (entradaObra).
export function sobraObra(obra, etapas) {
  return valorTotalObra(obra, etapas) - repasseObra(obra, etapas);
}

// filtro: '' (sem filtro — retorna obras sem alteração, comportamento padrão de hoje) |
//         '__outros__' (bucket "Sem cliente/Outros") | um clienteId específico
export function filtrarObras(obras, filtro, usuariosById) {
  if (!filtro) return obras;
  return obras.filter(o => {
    if (o.status !== 'andamento') return false;
    const classe = classifyObraClient(o, usuariosById);
    if (filtro === '__outros__') return classe === 'outros';
    return o.clienteId === filtro && classe === 'cliente';
  });
}

export function calcularResumoFechamento(obras, etapas, usuariosById, filtro) {
  const obrasFiltradas = filtrarObras(obras, filtro, usuariosById);
  // totalEntrada é só um indicador de fluxo de caixa (quanto já entrou), independente da sobra.
  const totalEntrada = obrasFiltradas.reduce((soma, o) => soma + entradaObra(o), 0);
  const totalValorTotal = obrasFiltradas.reduce((soma, o) => soma + valorTotalObra(o, etapas), 0);
  const totalRepasse = obrasFiltradas.reduce((soma, o) => soma + repasseObra(o, etapas), 0);
  return { filtro, obras: obrasFiltradas, totalEntrada, totalValorTotal, totalRepasse, totalSobra: totalValorTotal - totalRepasse };
}
