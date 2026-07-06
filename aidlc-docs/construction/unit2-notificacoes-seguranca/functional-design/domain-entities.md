# Domain Entities — Unit 2: Notificações Push e Correções Críticas de Segurança

## Extended Entity: `usuarios/{uid}`
| Field | Type | Change |
|---|---|---|
| `fcmTokens` | `string[]` | **New**. Device push tokens; managed exclusively by the owning client and (for cleanup only) the NotificationDispatcher Cloud Function via the Admin SDK. |
| *(all existing fields)* | — | Unchanged in shape; access to `tipo`/`status` is now rule-restricted per business-rules.md (no schema change, an authorization change). |

## Extended Entity: `notificacoes/{notifId}`
| Field | Type | Change |
|---|---|---|
| `destinatarioTipo` | `'admin' \| 'cliente'` | **New**. Replaces the implicit "always cliente" assumption. |
| `clienteId` | `string \| null` | Now optional — present only when `destinatarioTipo === 'cliente'`. |
| `linkPagina` | `'obras' \| 'solicitacoes' \| 'financeiro' \| 'aprovacao' \| 'pagamentos-cli'` | **New**. Deep-link target page (Q1=A). |
| `linkId` | `string` | **New**. Deep-link target entity id (meaning depends on `linkPagina`/`tipo` — see business-logic-model.md A1). |
| `tipo` | `string` | Extended enum: existing 6 values + `cobranca_enviada`, `solicitacao_criada`, `orcamento_decidido`, `pagamento_cliente_registrado`, `cobranca_respondida`, `avaliacao_registrada` |
| *(titulo, mensagem, lida, criadoEm, obraId)* | — | Unchanged. |

## New Entity: FCM Push Payload (transient, not persisted)
The shape of the `data` field in the FCM message the Cloud Function sends — exists only in transit (Cloud Function → device), never stored:
| Field | Type | Purpose |
|---|---|---|
| `panel` | `'admin' \| 'cliente'` | Which app shell to open (derived from `destinatarioTipo`) |
| `linkPagina` | `string` | Copied from the source `notificacoes` doc |
| `linkId` | `string` | Copied from the source `notificacoes` doc |
| `notifId` | `string` | The source `notificacoes` document id (lets the client mark it read on open, if desired later — not required by this unit's scope) |

## Relationships
```
usuarios (tipo:'admin')          --receives (broadcast, Q3=A)-->  notificacoes (destinatarioTipo:'admin')
usuarios (tipo:'cliente', 'aprovado') --receives-->                notificacoes (destinatarioTipo:'cliente', clienteId match)
usuarios (any authenticated)     --owns-->                        usuarios.fcmTokens (own array only)
notificacoes --triggers (onCreate)-->                              Cloud Functions: NotificationDispatcher
NotificationDispatcher --resolves via-->                           usuarios.fcmTokens --sends via--> FCM --delivers to--> Service Worker / NotificationClient
notificacoes.linkPagina + linkId --resolved by--> handleNotificationOpen (business-logic-model.md A3) --into--> existing obra/solicitação/pagamento/cobrança entities (unchanged shapes, documented in reverse-engineering/api-documentation.md)
```

## No New Top-Level Collections
This unit extends 2 existing collections (`usuarios`, `notificacoes`) and adds no new Firestore collection — a deliberate minimization consistent with Application Design's decision to keep this unit's data-model footprint small.
