import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { mediaCriterios, parceirosCreditados, calcularAcumuladoParceiro } from './avaliacao.js';

test('mediaCriterios: média simples arredondada a 1 casa decimal', () => {
  assert.equal(mediaCriterios({ tempoExecucao: 5, acabamento: 5, organizacaoLimpeza: 5 }), 5);
  assert.equal(mediaCriterios({ tempoExecucao: 5, acabamento: 4, organizacaoLimpeza: 4 }), 4.3);
});

test('parceirosCreditados: dedup no formato atual (etapas.parceiros[])', () => {
  const etapas = [
    { obraId: 'o1', status: 'concluido', parceiros: [{ parceiroId: 'p1', nome: 'Benedito' }] },
    { obraId: 'o1', status: 'concluido', parceiros: [{ parceiroId: 'p1', nome: 'Benedito' }, { parceiroId: 'p2', nome: 'José' }] },
  ];
  const creditados = parceirosCreditados(etapas, 'o1');
  assert.deepEqual(creditados.map(p => p.parceiroId).sort(), ['p1', 'p2']);
});

test('parceirosCreditados: lê o formato legado (etapa.parceiroId)', () => {
  const etapas = [{ obraId: 'o1', status: 'concluido', parceiroId: 'p1', parceiroNome: 'Benedito' }];
  assert.deepEqual(parceirosCreditados(etapas, 'o1'), [{ parceiroId: 'p1', nome: 'Benedito' }]);
});

test('parceirosCreditados: ignora etapas não concluídas (Q2=A)', () => {
  const etapas = [{ obraId: 'o1', status: 'execucao', parceiros: [{ parceiroId: 'p1', nome: 'Benedito' }] }];
  assert.deepEqual(parceirosCreditados(etapas, 'o1'), []);
});

test('parceirosCreditados: obra sem nenhum parceiro vinculado retorna array vazio (Q3=A)', () => {
  const etapas = [{ obraId: 'o1', status: 'concluido' }];
  assert.deepEqual(parceirosCreditados(etapas, 'o1'), []);
});

test('parceirosCreditados: ignora etapas de outras obras', () => {
  const etapas = [{ obraId: 'outra-obra', status: 'concluido', parceiroId: 'p1' }];
  assert.deepEqual(parceirosCreditados(etapas, 'o1'), []);
});

test('calcularAcumuladoParceiro: sem avaliações -> tudo null', () => {
  const acumulado = calcularAcumuladoParceiro([], 'p1');
  assert.deepEqual(acumulado, { totalServicosAvaliados: 0, mediaTempoExecucao: null, mediaAcabamento: null, mediaOrganizacaoLimpeza: null, mediaGeral: null });
});

test('calcularAcumuladoParceiro: média entre múltiplas obras que creditam o mesmo parceiro', () => {
  const obras = [
    { id: 'o1', avaliacaoParceiros: [{ parceiroId: 'p1', nome: 'Benedito' }], avaliacaoCriterios: { tempoExecucao: 5, acabamento: 5, organizacaoLimpeza: 5 }, avaliacaoGeral: 5 },
    { id: 'o2', avaliacaoParceiros: [{ parceiroId: 'p1', nome: 'Benedito' }], avaliacaoCriterios: { tempoExecucao: 3, acabamento: 4, organizacaoLimpeza: 4 }, avaliacaoGeral: 3.7 },
    { id: 'o3', avaliacaoParceiros: [{ parceiroId: 'p2', nome: 'José' }], avaliacaoCriterios: { tempoExecucao: 1, acabamento: 1, organizacaoLimpeza: 1 }, avaliacaoGeral: 1 },
  ];
  const acumulado = calcularAcumuladoParceiro(obras, 'p1');
  assert.equal(acumulado.totalServicosAvaliados, 2);
  assert.equal(acumulado.mediaTempoExecucao, 4);
  assert.equal(acumulado.mediaGeral, 4.4); // média de 5 e 3.7 (Geral já calculada por avaliação, não recomputada dos critérios)
});

test('calcularAcumuladoParceiro: ignora obras com avaliação legada (sem avaliacaoCriterios)', () => {
  const obras = [{ id: 'o1', avaliacaoParceiros: [{ parceiroId: 'p1', nome: 'Benedito' }], avaliacaoNota: 5 }];
  assert.equal(calcularAcumuladoParceiro(obras, 'p1').totalServicosAvaliados, 0);
});

// PBT 1: toda média acumulada (quando existe) está sempre entre 1 e 5.
test('PBT: médias acumuladas do parceiro estão sempre em [1, 5]', () => {
  const criteriosArb = fc.record({
    tempoExecucao: fc.integer({ min: 1, max: 5 }),
    acabamento: fc.integer({ min: 1, max: 5 }),
    organizacaoLimpeza: fc.integer({ min: 1, max: 5 }),
  });
  const obraArb = criteriosArb.map(c => ({
    id: Math.random().toString(36),
    avaliacaoParceiros: [{ parceiroId: 'p1', nome: 'X' }],
    avaliacaoCriterios: c,
    avaliacaoGeral: mediaCriterios(c),
  }));
  fc.assert(
    fc.property(fc.array(obraArb, { minLength: 1, maxLength: 20 }), (obras) => {
      const acumulado = calcularAcumuladoParceiro(obras, 'p1');
      return ['mediaTempoExecucao', 'mediaAcabamento', 'mediaOrganizacaoLimpeza', 'mediaGeral'].every(
        k => acumulado[k] >= 1 && acumulado[k] <= 5
      );
    })
  );
});

// PBT 2: isolamento de atribuição — a média de um parceiro nunca é afetada por avaliações de outro.
test('PBT: avaliações creditadas a outro parceiro nunca afetam a média deste parceiro', () => {
  const criteriosArb = fc.record({
    tempoExecucao: fc.integer({ min: 1, max: 5 }),
    acabamento: fc.integer({ min: 1, max: 5 }),
    organizacaoLimpeza: fc.integer({ min: 1, max: 5 }),
  });
  const obraArb = (parceiroId) => criteriosArb.map(c => ({
    id: Math.random().toString(36),
    avaliacaoParceiros: [{ parceiroId, nome: 'X' }],
    avaliacaoCriterios: c,
    avaliacaoGeral: mediaCriterios(c),
  }));
  fc.assert(
    fc.property(
      fc.array(obraArb('p1'), { minLength: 1, maxLength: 10 }),
      fc.array(obraArb('p2'), { minLength: 0, maxLength: 10 }),
      (obrasP1, obrasP2) => {
        const semRuido = calcularAcumuladoParceiro(obrasP1, 'p1');
        const comRuido = calcularAcumuladoParceiro([...obrasP1, ...obrasP2], 'p1');
        return JSON.stringify(semRuido) === JSON.stringify(comRuido);
      }
    )
  );
});

// PBT 3: round-trip — avaliacaoGeral computado no envio é sempre a média arredondada dos 3 critérios.
test('PBT: mediaCriterios(criterios) é sempre a média aritmética arredondada a 1 casa decimal', () => {
  const criteriosArb = fc.record({
    tempoExecucao: fc.integer({ min: 1, max: 5 }),
    acabamento: fc.integer({ min: 1, max: 5 }),
    organizacaoLimpeza: fc.integer({ min: 1, max: 5 }),
  });
  fc.assert(
    fc.property(criteriosArb, (c) => {
      const esperado = Math.round(((c.tempoExecucao + c.acabamento + c.organizacaoLimpeza) / 3) * 10) / 10;
      return mediaCriterios(c) === esperado;
    })
  );
});
