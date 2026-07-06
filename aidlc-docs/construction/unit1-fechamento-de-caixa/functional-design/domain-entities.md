# Domain Entities — Unit 1: Fechamento de Caixa e Cores

**Note**: This unit introduces no new persisted entities/collections — it only reads existing `obras`, `obras/{obraId}/etapas`, and `usuarios` documents (fully documented in `aidlc-docs/inception/reverse-engineering/api-documentation.md`). The one new "entity" is a computed, non-persisted view model.

## New Entity (computed, not persisted): FechamentoCaixaViewModel

| Field | Type | Derivation |
|---|---|---|
| `clienteId` | `string \| '__outros__' \| null` | The current filter selection |
| `clienteNome` | `string` | Looked up from `usuarios`, or the literal label "Sem cliente / Outros" |
| `obras` | `Obra[]` | `filteredObras` per business-logic-model.md step 3 |
| `totalEntrada` | `number` | Sum of `entradaObra` across `obras` |
| `totalRepasse` | `number` | Sum of `repasseObra` across `obras` |
| `totalSobra` | `number` | `totalEntrada - totalRepasse` (can be negative) |

**Lifetime**: recomputed on every render trigger listed in business-logic-model.md's "Recompute Triggers" section; never written to Firestore, never cached beyond the current render.

## Existing Entities Referenced (unchanged — see reverse-engineering/api-documentation.md for full field lists)
- **`obras/{obraId}`**: read fields — `clienteId`, `status`, `entrada`, `nome` (for list display)
- **`obras/{obraId}/etapas/{etapaId}`**: read field — `valRepasse` (for `repasseObra` aggregation)
- **`usuarios/{uid}`**: read fields — `tipo`, `status`, `nome` (for client classification and dropdown population)

## Relationships
```
usuarios (tipo:'cliente', status:'aprovado') --1:N--> obras (via obras.clienteId)
obras --1:N--> etapas (existing subcollection relationship, unchanged)
FechamentoCaixaViewModel --computed-over--> filtered subset of (obras + their etapas), scoped to one usuarios doc or the "Outros" bucket
```
