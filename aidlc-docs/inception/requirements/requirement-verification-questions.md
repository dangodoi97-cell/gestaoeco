# Requirements Clarification Questions

Estas perguntas ajudam a definir com precisão os 3 pedidos: (A) filtro/visão por cliente ("fechamento de caixa") na aba Obras, (B) cores para valores financeiros (repasse/entrada/sobra), e (C) sistema de notificações para status/movimentação das obras. Responda preenchendo a letra após cada tag `[Answer]:`. Se nenhuma opção servir, use a última opção (Other) e descreva.

---

## Bloco A — Filtro por cliente / "Fechamento de Caixa"

### Question 1
Onde esse seletor de cliente deve aparecer?

A) Um filtro dentro da própria aba "Obras" existente (um dropdown no topo que filtra a lista já existente)
B) Uma aba/página nova chamada "Fechamento de Caixa", separada da aba "Obras"
C) Ambos — filtro na aba Obras e uma página nova de Fechamento de Caixa com mais detalhe financeiro
X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 2
Ao selecionar um cliente, o que essa visão deve mostrar, além da lista de obras em execução dele?

A) Só a lista de obras em execução do cliente selecionado (sem números financeiros extras)
B) A lista de obras + um resumo financeiro do período (total de entrada, total de repasse, total de sobra) — um "fechamento de caixa" no sentido literal de balanço
C) A lista de obras + o resumo financeiro, mas só das obras já concluídas (não das em execução)
X) Other (please describe after [Answer]: tag below)

[Answer]: B

### Question 3
Sobre "outros clientes que não está cadastrada" (obras sem cliente vinculado no sistema): como tratar isso no filtro?

A) Adicionar uma opção fixa "Sem cliente / Outros" que agrupa todas as obras com `clienteId` vazio
B) Exigir que toda obra tenha um cliente vinculado a partir de agora (cadastro rápido de cliente "avulso" se necessário)
C) Não mexer nisso agora — manter como está, filtro só funciona para obras já vinculadas a um cliente cadastrado
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Bloco B — Cores para valores financeiros

### Question 4
Confirma o mapeamento de cores? (repasse = vermelho, entrada = azul, sobra/lucro = verde)

A) Sim, exatamente esse mapeamento (repasse=vermelho, entrada=azul, sobra=verde)
B) Sim, mas quero trocar uma das cores (descreva qual, após [Answer])
C) Não, quero um mapeamento diferente (descreva completo após [Answer])
X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 5
"Sobra" (o valor verde) deve ser calculado como:

A) Entrada − Repasse (por obra ou por etapa)
B) Valor cobrado do cliente (val) − Repasse (valRepasse) — ignora entrada/pagamento parcial
C) Outro cálculo (descreva após [Answer])
X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 6
Onde essas cores devem aparecer?

A) Só na tela de detalhe da obra (admin), onde já aparecem os valores financeiros
B) Na tela de detalhe da obra E na nova visão de Fechamento de Caixa (Bloco A)
C) Em todo lugar do painel admin onde aparece qualquer valor financeiro relacionado (obra, etapa, parceiro)
X) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## Bloco C — Sistema de notificações

### Question 7
O sistema já tem uma "caixa de notificações" dentro do app (avisa o CLIENTE quando o admin cria/conclui uma obra ou etapa, por exemplo), mas é só uma lista que aparece quando a pessoa abre o app — não existe notificação push (aquela que aparece mesmo com o app fechado, como notificação de celular). O que você precisa agora?

A) Só reforçar/completar a lista de notificações que já existe dentro do app (garantir que todo status/movimentação relevante gera um item na lista)
B) Notificação push real (alerta que aparece mesmo com o app fechado/minimizado, como notificação de celular) — isso exige configuração adicional (Firebase Cloud Messaging) e pedir permissão do usuário
C) As duas coisas — lista dentro do app E push real
X) Other (please describe after [Answer]: tag below)

[Answer]: B

### Question 8
Hoje as notificações só avisam o CLIENTE (quando o admin faz algo). Você também quer que o ADMIN seja notificado quando o CLIENTE fizer alguma ação?

A) Sim — admin também deve ser notificado (ex: cliente enviou solicitação, aprovou/rejeitou orçamento, registrou pagamento, avaliou a obra)
B) Não — por enquanto só o fluxo atual (admin avisa cliente) é suficiente
X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 9
Quais eventos devem gerar notificação? (a lista atual já cobre: obra criada, obra concluída, etapa iniciada, etapa concluída, diária registrada, orçamento enviado)

A) Manter exatamente essa lista atual, sem adicionar nem remover eventos
B) Adicionar também: envio de cobrança/solicitação de pagamento, resposta do cliente à cobrança (pago/contestado), decisão do cliente sobre orçamento (aprovado/rejeitado)
C) Notificar em qualquer alteração relevante em uma obra ou etapa (cobertura ampla, mesmo que gere mais volume de notificações)
X) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## Bloco D — Extensões do processo AI-DLC (obrigatório responder)

### Question 10: Security Extensions
Should security extension rules be enforced for this project?

A) Yes — enforce all SECURITY rules as blocking constraints (recommended for production-grade applications) — recomendado, já que a engenharia reversa encontrou falhas críticas de segurança nas regras atuais do Firestore/Storage
B) No — skip all SECURITY rules (suitable for PoCs, prototypes, and experimental projects)
X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 11: Property-Based Testing Extension
Should property-based testing (PBT) rules be enforced for this project?

A) Yes — enforce all PBT rules as blocking constraints (recommended for projects with business logic, data transformations, serialization, or stateful components)
B) Partial — enforce PBT rules only for pure functions and serialization round-trips (suitable for projects with limited algorithmic complexity)
C) No — skip all PBT rules (suitable for simple CRUD applications, UI-only projects, or thin integration layers with no significant business logic) — this codebase has no test framework/test files today
X) Other (please describe after [Answer]: tag below)

[Answer]: A
