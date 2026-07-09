# NFR Requirements Plan — Unit 3: Avaliação por Critérios vinculada ao Parceiro

## Execution Checklist
- [ ] Step 1: Answer the 2 questions below (the 2 items flagged during Functional Design)
- [ ] Step 2: Generate `aidlc-docs/construction/unit3-avaliacao-parceiro/nfr-requirements/nfr-requirements.md`
- [ ] Step 3: Generate `aidlc-docs/construction/unit3-avaliacao-parceiro/nfr-requirements/tech-stack-decisions.md`

**Note**: Scalability, Performance, Availability, Reliability, Maintainability, and Usability inherit the same platform-managed defaults already established in Unit 2's NFR Requirements (same Firebase-only architecture, no new infrastructure, no new dependencies) — no new questions needed for those categories. Only the 2 Security items flagged during Functional Design require a decision.

## Questions

### Question 1 — Travar o envio único também nas regras do Firestore (não só na interface)
Hoje o "só pode avaliar uma vez" é garantido apenas pela interface do cliente (o botão desaparece). As regras do Firestore permitiriam, em teoria, um segundo envio se alguém contornasse a interface (ex.: chamando a API do Firestore diretamente). Adicionar essa trava nas regras (`!('avaliacaoCriterios' in resource.data)`) é simples e não tem custo de performance.

A) Sim, adicionar a trava nas regras (recomendado) — reforça o que a interface já faz, sem custo extra
B) Não, manter como está hoje — só a interface impede reenvio
X) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 2 — Verificar nas regras se o parceiro creditado realmente participou da obra
Hoje, quem decide quais parceiros recebem a nota é o próprio celular do cliente (código do app), e as regras do Firestore não conferem se aquele parceiro realmente trabalhou na obra. Em tese, um cliente malicioso (ou um bug) poderia creditar um parceiro que nunca trabalhou ali, inflando a média dele. Fazer essa conferência dentro das regras do Firestore é tecnicamente complicado (regras não são boas pra esse tipo de verificação cruzada com outras coleções) e pode não escalar bem.

A) Não implementar essa verificação agora — aceitar o risco, seguindo o mesmo padrão já aceito antes neste projeto (Unit 2 aceitou lacunas parecidas, como falta de MFA e de limite de tentativas). O pior cenário aqui é a média de um parceiro ficar errada, não é vazamento de dado nem invasão de conta
B) Implementar a verificação — vai exigir uma solução mais complexa (provavelmente uma Cloud Function em vez de regra pura, já que o projeto ainda não tem uma função de backend para escrita de obra) — implica mais tempo de desenvolvimento
X) Other (please describe after [Answer]: tag below)

[Answer]: A
