# Unit Test Execution

## Run Unit Tests

### 1. Execute All Unit Tests
```bash
npm test                        # Unit 1: js/fechamento.js + Unit 3: js/avaliacao.js logic + PBT invariants (27 tests)
(cd functions && npm test)      # Unit 2: notificationDispatcher.js logic, mocked (12 tests)
```

### 2. Review Test Results
- **Expected**: 27/27 passing (root — 15 Unit 1 + 12 Unit 3), 12/12 passing (functions/) — 39 total, 0 failures.
- **Test Coverage**: no coverage tool is configured (proportionate for this project's size); coverage is reasoned about qualitatively — every exported pure function in `js/fechamento.js`, `js/avaliacao.js`, and `functions/notificationDispatcher.js` has at least one example-based test, plus the flagged PBT invariants (sobra aggregation; parceiro-rating bounds/isolation/round-trip; recipient resolution correctness) have property-based coverage.
- **Test Report Location**: Node's built-in test runner prints results directly to stdout (TAP-like format); no separate report file is generated (proportionate — no CI pipeline consumes a report format).

### 3. Fix Failing Tests
If tests fail:
1. Review the `node --test` output — it names the failing test and prints an assertion diff.
2. Identify whether the failure is in the test (e.g. a bad fixture, as happened once during this unit's generation — see audit.md) or the implementation.
3. Fix and re-run until green.

## Verified During Code Generation
All 3 suites were actually executed (not just written) during their respective units' Code Generation — see `aidlc-docs/construction/unit1-fechamento-de-caixa/code/summary.md`, `aidlc-docs/construction/unit2-notificacoes-seguranca/code/summary.md`, and `aidlc-docs/construction/unit3-avaliacao-parceiro/code/summary.md` for the exact recorded results.
