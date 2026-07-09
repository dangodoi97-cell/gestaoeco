# Requirements Clarification Questions — Avaliação por Critérios vinculada ao Parceiro

Estas perguntas ajudam a definir com precisão a nova funcionalidade: avaliação do cliente (por estrelas, em múltiplos critérios) sobre o serviço concluído, vinculada ao parceiro que executou, com nota acumulada serviço a serviço. Responda preenchendo a letra após cada tag `[Answer]:`. Se nenhuma opção servir, use a última opção (Other) e descreva.

**Contexto já levantado no código atual** (para você validar as perguntas abaixo):
- Parceiros são vinculados no nível da **etapa** (execução), não da obra — uma etapa pode até ter mais de um parceiro (`parceiros: [{parceiroId, repasse}, ...]`).
- Já existe hoje uma avaliação simples (1-5 estrelas + comentário) no nível da **obra** (`avaliacaoNota`/`avaliacaoComentario`/`avaliadoEm`), enviada uma única vez pelo cliente quando a obra é concluída — e ela **não** está vinculada a nenhum parceiro hoje.
- A tela de detalhe do parceiro no admin (`renderParceiroDetalhe`) já monta um histórico de etapas daquele parceiro — é o lugar natural para mostrar a nota acumulada do exemplo que você deu (Benedito: Acabamento 5/5, etc.).

---

## Question 1
Qual é a unidade de "serviço" que o cliente avalia?

A) A **etapa** (execução) individual — quando uma etapa é marcada concluída, o cliente pode avaliar aquela etapa especificamente. Uma obra com várias etapas pode gerar várias avaliações, uma por etapa.
B) A **obra** como um todo (igual ao comportamento atual) — o cliente avalia a obra completa uma única vez, e essa avaliação é atribuída ao(s) parceiro(s) que participaram de qualquer etapa daquela obra.
X) Other (please describe after [Answer]: tag below)

[Answer]: B

## Question 2
Uma etapa (ou obra, dependendo da resposta à Q1) pode ter **mais de um parceiro** vinculado (array `parceiros`). Quando isso acontecer, como a nota deve ser atribuída?

A) A mesma nota é aplicada integralmente ao histórico de cada parceiro vinculado (cada um recebe a nota cheia)
B) Não permitir avaliação nesse caso específico (o botão de avaliar só aparece quando há exatamente 1 parceiro vinculado ao serviço)
C) A nota conta para todos, mas com peso proporcional ao valor de repasse de cada parceiro naquele serviço
X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 3
Os 3 critérios do seu exemplo (Tempo de execução, Acabamento, Organização e limpeza) devem ser:

A) Fixos no código exatamente com esses 3 nomes, sem opção de alterar
B) Fixos por agora, mas guardados de um jeito que permita no futuro o admin editar/adicionar critérios sem precisar migrar dados (mais trabalho de estrutura de dados agora, para facilitar depois)
X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 4
A "Avaliação Geral" (nota geral daquele serviço específico) deve ser:

A) A média simples dos 3 critérios daquela avaliação (ex.: 5+5+5 ÷ 3 = 5) — calculada automaticamente
B) Uma nota separada, que o próprio cliente escolhe de forma independente dos 3 critérios
X) Other (please describe after [Answer]: tag below)

[Answer]: A — com uma ressalva do usuário: além da média automática, a interface deve permitir ver a nota de cada critério individualmente (não só a Geral)

## Question 5
Você disse "a nota sendo acumulada serviço a serviço" — isso significa:

A) Para cada critério (e para a Geral), a nota do parceiro é a **média** de todas as avaliações já recebidas por ele até agora, recalculada a cada novo serviço avaliado
B) Uma **soma** acumulada (a pontuação só cresce, sem ser uma média)
X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 6
Já existe uma avaliação simples (nota única 1-5 + comentário) no nível da obra, feita pelo cliente hoje. O que fazer com ela?

A) Substituir completamente pelo novo sistema de 3 critérios vinculado ao parceiro — remover o campo de nota única da obra
B) Manter os dois, como coisas separadas: a nota simples da obra continua existindo do jeito que está, e a nova avaliação por critérios/parceiro é um formulário adicional
C) Fundir: o formulário do cliente passa a ter só os 3 critérios (+ comentário livre), e o campo antigo de nota única da obra passa a ser preenchido automaticamente com a média dos 3 critérios (só faz sentido se a resposta à Q1 for B — obra)
X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 7
Quando o cliente pode enviar essa avaliação?

A) Mesmo gatilho de hoje — aparece um botão "Avaliar" uma única vez quando o serviço (etapa ou obra, conforme Q1) é marcado como concluído, e desaparece depois de enviado
B) Igual à opção A, mas também deixar um ponto de acesso permanente (ex. na tela do serviço) pra ver a avaliação já enviada ou avaliar se ainda não avaliou
X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 8
O cliente pode editar a nota depois de enviada?

A) Não — envio único, travado depois (igual ao comportamento atual da nota da obra)
B) Sim, pode editar livremente depois
C) Sim, mas só dentro de um prazo curto (descreva o prazo em Other)
X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 9
Onde a nota acumulada do parceiro deve aparecer no painel admin?

A) Só na tela de detalhe do parceiro (`renderParceiroDetalhe`), no formato do seu exemplo (Acabamento 5/5, Execução 5/5, Organização e limpeza 5/5, Avaliação Geral 5/5)
B) Também um resumo/selo na listagem geral de parceiros, sem precisar entrar no detalhe de cada um
C) A e B
X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 10
Hoje o cliente nunca vê qual parceiro (terceirizado) executou o serviço — parceiros são informação interna/admin. Isso deve mudar?

A) Não — o cliente continua avaliando "o serviço" de forma genérica, sem saber quem executou; o sistema associa a nota ao parceiro por trás das cortinas
B) Sim — passar a mostrar o nome do parceiro ao cliente no momento da avaliação
X) Other (please describe after [Answer]: tag below)

[Answer]: B
