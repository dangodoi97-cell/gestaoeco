# Functional Design Plan — Unit 3: Avaliação por Critérios vinculada ao Parceiro

## Execution Checklist
- [ ] Step 1: Answer the 5 questions below (remaining open items flagged in requirements.md FR-4)
- [ ] Step 2: Generate `aidlc-docs/construction/unit3-avaliacao-parceiro/functional-design/business-logic-model.md`
- [ ] Step 3: Generate `aidlc-docs/construction/unit3-avaliacao-parceiro/functional-design/business-rules.md`
- [ ] Step 4: Generate `aidlc-docs/construction/unit3-avaliacao-parceiro/functional-design/domain-entities.md`
- [ ] Step 5: Generate `aidlc-docs/construction/unit3-avaliacao-parceiro/functional-design/frontend-components.md`

## Questions

### Question 1 — Obras já avaliadas antes dessa mudança existir
Hoje já existem obras com o campo antigo `avaliacaoNota` preenchido (nota única 1-5). Quando o novo sistema de 3 critérios substituir o antigo (FR-4.4), o que fazer com essas notas antigas?

A) Ignorar — os dados antigos ficam como estão (histórico "congelado", sem entrar na média de nenhum parceiro), e só as obras avaliadas *depois* dessa mudança entram na conta dos parceiros
B) Aproveitar — para obras já avaliadas, usar a nota antiga como se fosse o valor dos 3 critérios (melhor esforço), e já creditar isso no histórico do(s) parceiro(s) vinculado(s)
X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 2 — Confirmação do critério "parceiro vinculado à obra"
Para decidir quais parceiros recebem a nota de uma obra avaliada, o plano assumiu (FR-4.6) usar o mesmo filtro que já existe na tela do parceiro no admin: só contam parceiros de etapas com status **'concluido'**.

A) Confirmo — só parceiros de etapas concluídas contam
B) Não — contar parceiros de qualquer etapa da obra, independente do status dela
X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 3 — Obra sem nenhum parceiro vinculado
Uma obra pode não ter nenhum parceiro vinculado em nenhuma etapa concluída (ex.: serviço feito diretamente, sem terceirizado). Nesse caso, o que acontece com a avaliação?

A) O cliente ainda pode avaliar normalmente — a nota só não é creditada a nenhum parceiro (fica só registrada na obra, com o comentário)
B) O botão de avaliar não aparece nesse caso — avaliação só existe quando há pelo menos 1 parceiro pra receber a nota
X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 4 — Nome do parceiro mostrado ao cliente: fixo ou sempre atualizado?
Você já decidiu que o cliente vai ver o nome do parceiro na hora de avaliar (FR-4.9). Se esse parceiro for renomeado no cadastro depois, o nome que aparece nas avaliações antigas do cliente deve:

A) Ficar congelado com o nome de quando a avaliação foi feita (não muda depois, mesmo que o parceiro seja renomeado no cadastro)
B) Sempre mostrar o nome atual do cadastro do parceiro, mesmo em avaliações antigas
X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 5 — Mais de um parceiro na mesma obra: o que o cliente vê?
Quando uma obra tiver mais de um parceiro distinto vinculado (etapas diferentes, parceiros diferentes), e o cliente for avaliar vendo o nome do parceiro (FR-4.9):

A) Mostra todos os nomes distintos daquela obra (ex.: "Serviço executado por: Benedito, José")
B) Mostra um rótulo genérico nesse caso, sem citar nomes (ex.: "Equipe de parceiros") — a atribuição interna a cada parceiro continua acontecendo, só não é exibida nominalmente ao cliente quando há mais de um
X) Other (please describe after [Answer]: tag below)

[Answer]: A
