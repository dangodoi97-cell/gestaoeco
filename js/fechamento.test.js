import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import {
  parseBRLValue, classifyObraClient, entradaObra, valorTotalObra, repasseObra, sobraObra,
  filtrarObras, calcularResumoFechamento
} from './fechamento.js';

test('parseBRLValue converte strings BRL (vírgula decimal) e trata vazio/undefined como 0', () => {
  assert.equal(parseBRLValue('1234,56'), 1234.56);
  assert.equal(parseBRLValue(''), 0);
  assert.equal(parseBRLValue(undefined), 0);
});

test('classifyObraClient: sem clienteId -> outros', () => {
  assert.equal(classifyObraClient({ clienteId: null }, {}), 'outros');
});

test('classifyObraClient: cliente aprovado -> cliente', () => {
  const usuariosById = { c1: { status: 'aprovado', nome: 'William' } };
  assert.equal(classifyObraClient({ clienteId: 'c1' }, usuariosById), 'cliente');
});

test('classifyObraClient: cliente rejeitado -> outros (Q2=A)', () => {
  const usuariosById = { c1: { status: 'rejeitado' } };
  assert.equal(classifyObraClient({ clienteId: 'c1' }, usuariosById), 'outros');
});

test('classifyObraClient: cliente pendente -> outros (generalização de Q2)', () => {
  const usuariosById = { c1: { status: 'pendente' } };
  assert.equal(classifyObraClient({ clienteId: 'c1' }, usuariosById), 'outros');
});

test('classifyObraClient: clienteId referencia usuário deletado -> outros', () => {
  assert.equal(classifyObraClient({ clienteId: 'uid-inexistente' }, {}), 'outros');
});

test('repasseObra soma valRepasse só das etapas da obra em questão', () => {
  const obra = { id: 'o1' };
  const etapas = [
    { obraId: 'o1', valRepasse: '100,00' },
    { obraId: 'o1', valRepasse: '50,50' },
    { obraId: 'o2', valRepasse: '999,00' },
  ];
  assert.equal(repasseObra(obra, etapas), 150.5);
});

test('valorTotalObra soma o val (valor cobrado do cliente) só das etapas da obra em questão', () => {
  const obra = { id: 'o1' };
  const etapas = [
    { obraId: 'o1', val: '1000,00' },
    { obraId: 'o1', val: '200,00' },
    { obraId: 'o2', val: '999,00' },
  ];
  assert.equal(valorTotalObra(obra, etapas), 1200);
});

test('sobraObra = valorTotal - repasse (correção de 2026-07-06 — não usa mais entrada)', () => {
  const obra = { id: 'o1', entrada: '0,00' };
  const etapas = [{ obraId: 'o1', val: '1000,00', valRepasse: '400,00' }];
  assert.equal(sobraObra(obra, etapas), 600);
});

test('sobraObra pode ser negativa quando repasse > valorTotal (Q1=A: sem tratamento especial)', () => {
  const obra = { id: 'o1' };
  const etapas = [{ obraId: 'o1', val: '100,00', valRepasse: '150,00' }];
  assert.equal(sobraObra(obra, etapas), -50);
});

test('filtrarObras: sem filtro retorna as obras sem alteração (comportamento padrão de hoje)', () => {
  const obras = [
    { id: 'a', status: 'andamento' },
    { id: 'b', status: 'concluida' },
  ];
  assert.deepEqual(filtrarObras(obras, '', {}), obras);
});

test('filtrarObras: bucket "Outros" agrupa sem-cliente, rejeitado, pendente e cliente deletado', () => {
  const usuariosById = { c1: { status: 'rejeitado' }, c2: { status: 'pendente' } };
  const obras = [
    { id: 'a', status: 'andamento', clienteId: null },
    { id: 'b', status: 'andamento', clienteId: 'c1' },
    { id: 'c', status: 'andamento', clienteId: 'c2' },
    { id: 'd', status: 'andamento', clienteId: 'c3-deletado' },
    { id: 'e', status: 'concluida', clienteId: null },
  ];
  const outros = filtrarObras(obras, '__outros__', usuariosById);
  assert.deepEqual(outros.map(o => o.id).sort(), ['a', 'b', 'c', 'd']);
});

test('filtrarObras: filtro por cliente aprovado só retorna obras em andamento daquele cliente', () => {
  const usuariosById = { c1: { status: 'aprovado' } };
  const obras = [
    { id: 'a', status: 'andamento', clienteId: 'c1' },
    { id: 'b', status: 'concluida', clienteId: 'c1' },
    { id: 'c', status: 'andamento', clienteId: 'outro' },
  ];
  assert.deepEqual(filtrarObras(obras, 'c1', usuariosById).map(o => o.id), ['a']);
});

test('calcularResumoFechamento: totalSobra = totalValorTotal - totalRepasse (entrada é indicador separado)', () => {
  const usuariosById = { c1: { status: 'aprovado' } };
  const obras = [
    { id: 'o1', status: 'andamento', clienteId: 'c1', entrada: '1000,00' },
    { id: 'o2', status: 'andamento', clienteId: 'c1', entrada: '500,00' },
  ];
  const etapas = [
    { obraId: 'o1', val: '2000,00', valRepasse: '300,00' },
    { obraId: 'o2', val: '500,00', valRepasse: '600,00' }, // gera sobra negativa nesta obra
  ];
  const resumo = calcularResumoFechamento(obras, etapas, usuariosById, 'c1');
  assert.equal(resumo.totalEntrada, 1500); // indicador de caixa, não entra no cálculo da sobra
  assert.equal(resumo.totalValorTotal, 2500);
  assert.equal(resumo.totalRepasse, 900);
  assert.equal(resumo.totalSobra, 1600); // 2500 - 900, NÃO 1500 - 900
});

// Property-based test (fast-check) — invariante corrigido em 2026-07-06 (ver audit.md): totalSobra
// deve sempre ser igual a totalValorTotal - totalRepasse (lucro líquido sobre o valor cobrado do
// cliente), não totalEntrada - totalRepasse — entrada é só o sinal recebido, indicador separado.
test('PBT: totalSobra === totalValorTotal - totalRepasse para qualquer conjunto de obras/etapas', () => {
  const valorBRLArb = fc.integer({ min: -100000, max: 100000 }).map(n => (n / 100).toFixed(2).replace('.', ','));
  const obraComEtapasArb = fc.record({
    id: fc.uuid(),
    entrada: valorBRLArb,
    etapas: fc.array(fc.record({ val: valorBRLArb, valRepasse: valorBRLArb }), { maxLength: 5 }),
  });

  fc.assert(
    fc.property(fc.array(obraComEtapasArb, { maxLength: 15 }), (itens) => {
      const usuariosById = { c1: { status: 'aprovado' } };
      const obras = itens.map(it => ({ id: it.id, status: 'andamento', clienteId: 'c1', entrada: it.entrada }));
      const etapas = itens.flatMap(it => it.etapas.map(e => ({ obraId: it.id, val: e.val, valRepasse: e.valRepasse })));
      const resumo = calcularResumoFechamento(obras, etapas, usuariosById, 'c1');
      return Math.abs(resumo.totalSobra - (resumo.totalValorTotal - resumo.totalRepasse)) < 1e-6;
    })
  );
});
