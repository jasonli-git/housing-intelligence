# Loader release attribution

## What changed

- `load_facts` now requires an exact `(source, layer, vintage)` release for every staged observation. It no longer falls back to another vintage, another layer, or any release from the same source, and it no longer silently drops a row with no release.
- A staged vintage outside an adapter's current acquisition window may use its unique exact release already recorded in `source_releases`. If none exists, or several versions make the choice ambiguous, the fact-load transaction fails with the affected keys and row counts.
- The CLI prints that error without a traceback, and regression tests cover current, historical, missing, ambiguous, duplicate, and whole-load failure paths.

## Files/modules affected

- `src/hip/warehouse/load.py`: exact release resolution and failure diagnostics.
- `src/hip/cli.py`: concise operator-facing failure message.
- `tests/test_fact_release_attribution.py`: new regression tests.

## Architectural or implementation decisions

- Prefer the file provided by this load's cached release list; that exact file hash wins over older versions with the same key in the warehouse.
- Look up historical warehouse releases only for keys absent from that current list. Use one only if its exact key has one candidate. The staged observation has no file hash with which to choose among multiple historical versions.
- Resolve and validate all staged keys before the first fact upsert. The existing `engine.begin()` rolls back the source, release, and metric writes in the same fact-load transaction on failure.
- A duplicate `(source, layer, vintage)` in the current release list is now an error rather than an arbitrary map overwrite.

## Assumptions

- `source_releases` is the authoritative record for an older exact release that the present adapter window no longer enumerates; a unique matching row is sufficient to cite it. This preserves historical permits, HUD income-limit, and IRS observations without reassigning their vintages.
- A missing or ambiguous exact match is a load failure, not an acceptable partial result. This follows the correctness intent of TODO #237.

## New TODOs / limitations

- **Post-merge repair:** existing loaded facts are not changed by this PR alone. Run a load/pipeline and regenerate the published artifacts after integration, then verify the affected citations before deployment. A refresh that decides no publisher changed may not run the loader.
- The present staged schema records a release layer and vintage but not a file hash. If an older exact key has multiple historical releases, the loader intentionally stops; resolving that case requires stage-level file identity or a deliberate restage.
- This work does not clean up the separate dangling `old_release_id` revision-history pointers in TODO. Claude can reconcile TODO #237 and any canonical documentation after review/merge.

## Verification

- `PYTHONPATH=src .venv/bin/python -m pytest -o addopts= -q --disable-warnings`: 540 passed, 142 skipped. The skipped tests require a migrated Postgres connection unavailable in the default test sandbox.
- Focused new regression file: 7 passed.
- `.venv/bin/ruff check .`: passed.
- `.venv/bin/ruff format --check .`: passed, 191 files.
- `.venv/bin/mypy`: passed, 103 source files.
- Read-only local staged/warehouse audit: 410,625 staged observations across 835 release keys; 790 keys matched the current cached releases, and 45 older keys (689 rows) matched unique exact historical releases. No key remained unresolved. All 689 of those older staged observations are currently misattributed in the local warehouse. A sampled 2015 municipal permits fact cites a 2025 permits release despite an exact 2015 release being present.
- No full loader, pipeline, publish, or deploy was run; the local warehouse was not modified by the audit.
