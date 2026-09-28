# Reading citation measure binding

## What changed

- Citation binding now weighs measure words beside each figure ahead of words elsewhere in the sentence. It handles both "incomes rose 24% while rents rose 28%" and "24% income growth and 28% rent growth" without attributing rent growth to rent-to-income.
- Regression tests pin the selected packet field and source release, including the case where the prose explicitly says "rent to income" and should cite that composite measure.
- Stored bindings now carry a binder revision. A reading saved before this revision is re-cited on the next `hip explain` run, without a model call when its prose still passes the publication gates. A changed citation that fails a gate remains stale for normal regeneration rather than being accepted as a free rebind.

## Files/modules affected

- `src/hip/packets/citations.py`: local measure-word matching and binding revision.
- `src/hip/eval/explain.py`: version-aware reading freshness and publication-gated re-citation.
- `src/hip/eval_cli.py`: only count a rebind as successful when the stored row was actually updated.
- `tests/test_citations.py`: multi-measure sentence, source release, and stored-binding regressions.

## Architectural or implementation decisions

- Keep the existing numerical licensing and sentence-wide fallback. The change affects which equally licensed field is cited, not whether a figure is supported by the packet.
- Use the words on the nearer side of the figure, bounded by adjacent figures and clause separators. A composite measure's term from another clause no longer earns it an attribution for the nearby figure. When no nearby measure word is found, retain the former sentence-wide scoring and ambiguity reporting.
- Version the binding JSON rather than regenerating prose on a code-only citation change. Versionless stored bindings are valid to read but are no longer considered current by `hip explain`.

## Assumptions

- A measure named nearest a figure is the intended source when multiple packet fields license the same number. Truly ambiguous prose can still have multiple plausible citations; this remains a deterministic heuristic, not a claim-level semantic validator.
- Existing readings are served from stored binding JSON. The matcher change alone cannot update a published source list until the re-citation command runs and the site is republished.

## New TODOs / limitations

- **Post-merge repair:** run `hip explain` for the published region levels (a `--dry-run` also performs free re-citation), then rebuild/publish the site so existing reading source lists use the new binding. No warehouse rows or deployed artifacts were changed by this PR. A reading whose new binding fails a publication gate may need a model call to regenerate.
- The proximity heuristic can still be ambiguous when prose does not clearly attach a measure to a number. Reviewers can decide whether TODO #257 is closed after checking representative published readings; no canonical document was edited here.

## Verification

- `.venv/bin/pytest -o addopts= -q --disable-warnings`: 626 passed, 143 skipped.
- Focused citation and uncertainty tests: 75 passed, 1 skipped.
- `.venv/bin/ruff check .`: passed.
- `.venv/bin/ruff format --check .`: passed, 203 files.
- `.venv/bin/mypy`: passed, 109 source files.
- `cd web && npm test -- --run`: 283 passed across 33 test files.
- `cd web && npm run typecheck`: passed.
- `uv build --out-dir /private/tmp/hip-citation-build.7OnChn`: source distribution and wheel built. An initial offline build could not find `hatchling` in the local cache; the normal build succeeded.
- `git diff --check`: passed.
- No full pipeline, warehouse re-citation, frontend static build, or deployment was run.
