# Reading publication guards

## What changed

- Limited reading cleanup to the audiences named by the `hip explain` invocation. A consumer-only run can no longer delete the stored analyst reading, or vice versa.
- Made an explicit peer-count phrase (for example, `21 counties` or `21st of 21`) win citation binding over an equal-valued rank, change, or margin. Bumped the binding version to 2 so stored version-1 citations are eligible for free re-citation.
- Added a warehouse-backed cleanup regression test, a no-warehouse SQL-scope test, and binder/re-citation tests.

## Files/modules affected

- `src/hip/eval/explain.py` — audience-scoped cleanup.
- `src/hip/packets/citations.py` — cohort attribution and binding version.
- `tests/test_api_explanations.py`, `tests/test_explain_prune.py`, `tests/test_citations.py` — regressions.

## Architectural or implementation decisions

- Syntax that unambiguously names a peer count takes precedence over the binder's general nearby-metric scoring. The filter applies only when the packet actually contains a matching cohort figure.
- No prose or warehouse rows were rewritten as part of this branch. Version 2 follows the existing `freshness`/`rebind` path: `hip explain --dry-run` re-cites stored readings and commits those free citation updates, while never calling a model.
- The canonical project documents were left to Claude's reconciliation.

## Assumptions

- This branch started from `main` at `19c23ea`, the merge of PR #51. An escalated read-only remote check confirmed `origin/main` was still `19c23ea` before the branch was created.
- The saved `dist/artifacts` tree was built at 2026-09-28 19:27 UTC, after the local PR #51 merge, and is useful as a read-only snapshot of the most recent build on this machine. It is not proof of the live deployment.

## New TODOs / limitations

- The saved build contains 40 readings across 21 counties. Gloucester and Warren have no consumer reading: the regeneration log shows all four model attempts were refused. This branch does not weaken the publication rules or make paid calls to fill them.
- The three-figure consumer limit still counts distinct packet fields rather than written occurrences. The saved 40 readings contain no observed answer over the cap from repeated fields, so that latent issue was left outside this immediate-fix branch. The run-cost line also excludes paid reachability probes.
- Before publishing version-2 citations, run `hip explain --dry-run` against a migrated warehouse, then `make publish` and the normal deploy/check-live flow. Its exit code may be 3 because the two absent consumer readings would require generation; the re-citation itself is free. No database update or deploy was performed here.
- The warehouse-backed cleanup test was skipped locally because no migrated warehouse was available. The no-warehouse query-scope test did run.

## Verification

- `.venv/bin/pytest -o addopts='' --tb=short` — 631 passed, 144 skipped (warehouse-backed tests unavailable).
- `npm test -- --run` — 283 passed.
- `.venv/bin/ruff check .` — passed; `.venv/bin/ruff format --check .` — 204 files formatted.
- `.venv/bin/mypy` — passed on 109 source files; `npm run typecheck` — passed.
- `.venv/bin/hip check-config` — passed (18 sources, 38 metrics).
- Re-bound all 40 saved readings against their saved packets without writing them: 101 citations changed field, 100 to the correct cohort; 0 unbound figures and 0 readings with publication-gate problems.
- `git diff --check` — passed. Static export and live verification were not run; the local warehouse was unavailable and no deployment was requested.
