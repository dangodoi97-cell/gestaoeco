# Unit Test Execution

## Run Unit Tests

### 1. Execute All Unit Tests
```bash
npm test                        # Unit 1: js/fechamento.js logic + PBT invariant (13 tests)
(cd functions && npm test)      # Unit 2: notificationDispatcher.js logic, mocked (12 tests)
```

### 2. Review Test Results
- **Expected**: 13/13 passing (root), 12/12 passing (functions/) — 25 total, 0 failures.
- **Test Coverage**: no coverage tool is configured (proportionate for this project's size); coverage is reasoned about qualitatively — every exported pure function in `js/fechamento.js` and `functions/notificationDispatcher.js` has at least one example-based test, plus the 2 flagged PBT invariants (sobra aggregation; recipient resolution correctness) have property-based coverage.
- **Test Report Location**: Node's built-in test runner prints results directly to stdout (TAP-like format); no separate report file is generated (proportionate — no CI pipeline consumes a report format).

### 3. Fix Failing Tests
If tests fail:
1. Review the `node --test` output — it names the failing test and prints an assertion diff.
2. Identify whether the failure is in the test (e.g. a bad fixture, as happened once during this unit's generation — see audit.md) or the implementation.
3. Fix and re-run until green.

## Verified During Code Generation
Both suites were actually executed (not just written) during Unit 1 and Unit 2 Code Generation — see `aidlc-docs/construction/unit1-fechamento-de-caixa/code/summary.md` and `aidlc-docs/construction/unit2-notificacoes-seguranca/code/summary.md` for the exact recorded results.
