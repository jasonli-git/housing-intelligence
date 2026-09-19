# Data comprehensiveness Director Note

## What changed

- Added the approved exploratory Director Note on expanding the platform's data
  comprehensiveness, freshness, cost coverage, and user usefulness.
- Recorded possible firm, current-projected, and future-forecast modes while
  keeping modeled values explicitly separate from observed data.
- Recorded that these ideas are candidates for scoping and roadmap scheduling
  in v3 and beyond, not approved roadmap commitments.

## Files/modules affected

- `DIRECTOR_NOTES.md`
- `agent-handoffs/data-comprehensiveness-note.md`

## Architectural or implementation decisions

- No application architecture or implementation was changed.
- The note remains exploratory and provenance-first: observed, projected, and
  forecast values must not appear interchangeable.
- The reported 6.67% versus 6.95% mortgage-rate discrepancy is preserved as an
  example requiring verification, not as a confirmed current rate.
- No item was promoted into `SPEC.md`, `ARCHITECTURE.md`, `ROADMAP.md`,
  `TODO.md`, or implementation work.

## Assumptions

- The user's approval to create a pull request also approved recording the
  reviewed Director Note and final roadmap-scope addition.
- Source discovery, licensing analysis, refresh design, forecasting, and cost
  modeling remain future investigation tasks.

## New TODOs / limitations

- The note identifies possible research and product directions but does not
  select sources, validate licensing, establish forecast methods, or schedule
  roadmap work.
- Candidate work will probably require separate scoping and prioritization for
  v3 and later releases.

## Verification

- Commands run: `git diff --check`
- Result: passed.
- Application tests were not run because the change is documentation-only.
