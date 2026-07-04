# Gestão de Obras — Guia de Configuração

## ⚠️ ATUALIZAÇÃO (04/07/2026) — Orçamento e Notificações

O fluxo mudou: agora **só o orçamento precisa de aprovação do cliente**. Etapas, diárias e conclusão de obra viram só notificações informativas (aba "Notificações" do cliente). Cobranças de pagamento continuam com aceitar/contestar, sem mudança.

**Antes de usar, republique as regras do Firestore** (o arquivo `firestore.rules` foi atualizado com 2 coleções novas: `notificacoes` e `orcamentos`, além de ajustar as permissões de `obras` e `etapas`):
1. No Firebase, vá em **Firestore Database → Regras**
2. Apague tudo e cole o novo conteúdo de `firestore.rules`
3. Clique em **Publicar**

Sem isso, o app vai dar erro de permissão ao tentar enviar notificações ou orçamentos.

**Como usar o orçamento (painel admin):** dentro de uma obra com cliente vinculado, tem um botão azul "Enviar orçamento". Enquanto o cliente não aprovar, a obra fica bloqueada para novas etapas/diárias (aparece um aviso no topo). Se o cliente rejeitar, é só enviar um novo orçamento.

### 🐛 Bug corrigido: cobrança não chegava para o cliente
A tela de "cobrar cliente" (Solicitações de pagamento) exigia que a etapa estivesse com `aprovacao: 'aprovado'` pra poder ser selecionada. Como esse campo não existe mais (etapas não passam mais por aprovação do cliente), nenhuma etapa aparecia disponível pra cobrança — por isso a cobrança nunca era criada e o cliente nunca via nada. Isso já foi corrigido: agora qualquer etapa concluída e ainda não paga pode ser cobrada.

### 📇 Índices do Firestore (importante!)
Esta atualização usa consultas do tipo "filtrar por cliente + ordenar por data" em várias coleções (`notificacoes`, `orcamentos`, `solicitacoes_pagamento`, etc). O Firestore exige um **índice composto** pra isso funcionar. Se algo não aparece do lado do cliente mesmo com as regras publicadas, quase sempre é isso.

**Como verificar:** abra o app do cliente, aperte F12 (ferramentas de desenvolvedor) → aba "Console". Se aparecer um erro tipo `FAILED_PRECONDITION: The query requires an index`, ele vem com um **link direto** — clique nele, confirme no Firebase, espera 1-2 minutos e recarrega o app.

**Alternativa manual** (sem precisar do erro/link): no Firebase, vá em **Firestore Database → Índices → Índices compostos → Adicionar índice**, e crie um para cada coleção abaixo com os mesmos 2 campos:
- Coleção: `obras` | Campos: `clienteId` (Crescente) + `criadoEm` (Decrescente)
- Coleção: `solicitacoes` | mesmos campos
- Coleção: `pagamentos_cliente` | mesmos campos
- Coleção: `solicitacoes_pagamento` | mesmos campos
- Coleção: `notificacoes` | mesmos campos
- Coleção: `orcamentos` | mesmos campos

(Se você usa a Firebase CLI, o arquivo `firestore.indexes.json` já vem pronto no projeto — é só rodar `firebase deploy --only firestore:indexes`.)

---

Este sistema tem 3 áreas:
- **Login** (`index.html`) — tela inicial, onde admin e cliente entram
- **Admin** (`admin/index.html`) — seu painel completo
- **Cliente** (`cliente/index.html`) — painel do seu patrão/cliente

---

## PASSO 1 — Configurar as regras do Firestore

1. No Firebase, vá em **Firestore Database** → aba **Regras**
2. Apague tudo que estiver lá e cole o conteúdo do arquivo `firestore.rules` (está junto dos outros arquivos)
3. Clique em **Publicar**

## PASSO 2 — Configurar as regras do Storage

1. No Firebase, vá em **Storage** → se ainda não tiver ativado, clique em **Começar** → modo de teste → Avançar → Concluir (escolha a mesma região do Firestore)
2. Vá na aba **Regras**
3. Apague tudo e cole o conteúdo do arquivo `storage.rules`
4. Clique em **Publicar**

## PASSO 3 — Criar o seu primeiro login de ADMIN

Como o cadastro normal do app só cria contas de **cliente**, o primeiro admin precisa ser criado manualmente uma única vez:

1. No Firebase, vá em **Authentication** → aba **Users** → **Add user**
2. Coloque seu e-mail e uma senha → **Add user**
3. Copie o **UID** gerado (aparece na listagem de usuários)
4. Vá em **Firestore Database** → **Iniciar coleção**
5. ID da coleção: `usuarios`
6. ID do documento: cole o **UID** que você copiou
7. Adicione estes campos:
   - `nome` (string) → seu nome
   - `email` (string) → seu e-mail
   - `tipo` (string) → `admin`
   - `status` (string) → `aprovado`
8. Clique em **Salvar**

Pronto! Agora você consegue entrar em `index.html` com esse e-mail/senha e cair direto no painel admin. Pelo próprio painel, em **Mais → Administradores**, você pode criar outros admins no futuro sem repetir esse processo manual.

## PASSO 4 — Subir os arquivos no Netlify

1. Acesse **netlify.com** → crie conta gratuita
2. Arraste a **pasta inteira** do projeto (não só um arquivo) para a área de upload
3. Em segundos você recebe um link tipo `seusite.netlify.app`

## PASSO 5 — Instalar como app no celular

No Android (Chrome): abra o link → menu (3 pontinhos) → "Adicionar à tela inicial"
No iPhone (Safari): abra o link → ícone de compartilhar → "Adicionar à Tela de Início"

---

## Como funciona o fluxo

**Você (admin):**
- Entra com seu e-mail/senha em `index.html`
- Cadastra parceiros (pedreiros), obras, etapas, encargos, tabela de preços/repasse
- Aprova ou rejeita clientes que se cadastraram
- Vê o andamento de tudo, mas a aprovação final do serviço é feita pelo cliente

**Seu cliente:**
- Cria a própria conta em `index.html` (aba "Criar conta")
- Fica com status "pendente" até você aprovar em **Mais → Clientes**
- Depois de aprovado, vê apenas as obras vinculadas a ele
- Pode revisar, aprovar/rejeitar cada etapa concluída, marcar como Pago ou A Pagar, e deixar anotações

**Vincular obra a um cliente:**
Ao criar a obra no admin, selecione o cliente no campo "Cliente responsável". Só clientes já aprovados aparecem na lista.

---

## Estrutura de arquivos

```
/
├── index.html          ← tela de login
├── pendente.html        ← tela de "aguardando aprovação"
├── manifest.json
├── firestore.rules      ← colar no Firebase
├── storage.rules        ← colar no Firebase
├── css/
│   └── style.css
├── js/
│   ├── firebase-config.js
│   ├── auth.js
│   └── data.js
├── admin/
│   ├── index.html
│   └── app.js
└── cliente/
    ├── index.html
    └── app.js
```

## Ajustes futuros

Qualquer mudança que precisar depois, é só trazer os arquivos de volta e pedir o ajuste — a estrutura modular faz com que eu só precise tocar no arquivo certo, sem precisar reescrever tudo de novo.
