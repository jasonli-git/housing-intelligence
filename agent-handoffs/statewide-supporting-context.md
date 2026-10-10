# Statewide supporting context

## What changed

- Three compact disclosures inside statewide evidence: mortgage lending, work destinations/transit, and FCC broadband availability.
- Existing statewide packet levels feed MortgageLending and GettingAround, preserving their methodology and caveats. Work destinations uses its statewide endpoint; community response supplies FCC state records.
- Focused StateBroadband component shows wired/fiber offer shares, observation/revision dates, FCC unit denominator and official address-check/source links. No school/crime/health placeholders imported into NJ.

## Files/modules affected

- State route, ui-refinement.css, new StateBroadband component/tests, responsive state check script.

## Architectural or implementation decisions

- Reuse published records; no new source acquisition, licensing changes, calculations or generated prose.
- Borrowing-history records are distinct from today's national mortgage benchmark. Job destinations count jobs, not people; stop proximity is not service quality. Broadband is provider-reported offers, not measured speed or household subscriptions; overlapping wired/fiber shares must not be added.
- All 54 current summary level metrics remain in the existing complete table.

## Assumptions

- Approval applied to the three recommended priorities, on existing experiment/ui-density-discoverability / PR #141.

## New TODOs / limitations

- Utility-provider detail, water-system detail and flood-history presentation remain unported. Schools/health/crime have no attached state context in the current response; migration and income-limit endpoints have no state result. Do not manufacture state numbers from county statistics.
- State utility provider records are not a statewide single utility tariff; future presentation needs appropriate scope.
- Local artifact URL remains localhost:8001; never deploy this preview configuration. No canonical documentation changes or deployment.

## Verification

- Typecheck passed; all 570 tests across 83 files passed, including two new FCC presentation regressions.
- Static build passed, 2,386 pages exported with the existing localhost artifact URL.
- Updated responsive state script passed six width/theme combinations with lending/work/broadband open: 10 work destinations, FCC unit-denominator caveat, lending qualification caveat, keyboard disclosures, retained comparison mode state, page reflow and WCAG-tagged axe audits.
- Reviewed `/tmp/nj-supporting-context.png`. `git diff --check` passed. No separate frontend lint task; backend tests not run for presentation-only changes.
