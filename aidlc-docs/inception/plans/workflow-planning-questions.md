# Workflow Planning — Clarifying Question

Esta é a última pergunta pendente antes de eu montar o plano de execução final (unidades de trabalho e quais etapas de construção vão rodar para cada uma).

## Question 1 — Empacotar as 2 correções críticas de segurança junto com o Cloud Functions?
Da Requirements Analysis: os achados críticos da engenharia reversa — #1 (qualquer usuário pode se autopromover a admin) e #2 (vazamento de dados entre clientes na leitura de `etapas`) — devem ser corrigidos na mesma unidade de trabalho que cria o Cloud Functions para as notificações push (FR-3), ou tratados depois, separadamente?

A) Sim — corrigir os 2 achados críticos agora, na mesma unidade (é a mesma mudança de arquitetura: mover verificação de autorização para o servidor)
B) Não — manter esta unidade só com FR-1/FR-2/FR-3; os 2 achados de segurança ficam como trabalho futuro separado
X) Other (please describe after [Answer]: tag below)

[Answer]: A
