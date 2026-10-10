# Tool family and buyer-guide previews

## What changed

- Unify property tax, buyer's guide and find-within-budget tools: shared serif title/result-heading scale, sans-serif explanatory text and controls, consistent field heights/radii and detail-summary treatment. Retain each tool's colour identity and neutral working surfaces.
- Flatten the tax result card to an open, divided result section; retain all data and links.
- Always show the guide's three questions and short descriptions before selection. Populate those same sections after a place loads, keeping headings/IDs stable and answers open. A 220ms decorative entrance respects reduced motion.
- Preserve explicit loading/failure messages. Missing income prompts for income; unavailable local measurements are not asserted before selection.

## Files/modules affected

- `web/components/DecisionGuide.tsx`, its new SSR regression test.
- `web/app/ui-refinement.css`.
- `web/scripts/check-guide-refinement.mjs`.

## Architectural or implementation decisions

- No new tabs, accordions or duplicated question headings; source/evidence disclosures remain native.
- Scope shared CSS to these three tools rather than changing regional/landing/report typography.
- Calculations, source-fetch behavior, scenario persistence and caveats are unchanged.

## Assumptions

- User approved the proposed shared tool design and question previews on the existing experimental branch.
- Find place refers to the budget tool; main landing search is not changed.

## New TODOs / limitations

- Real-device/screen-reader review remains useful. Existing global landmark best-practice issue remains documented in the earlier buyer-guide handoff; audits use repository-standard WCAG tags.
- Local preview uses the temporary read-only artifact proxy on 8001, now admitting published region and parcel JSON paths so both guide and tax can function. It forwards only GETs to the fixed public host, with CORS restricted to localhost:3002. Local build artifact URL must never be deployed. No production configuration changes.

## Verification

- `npm run typecheck`: passed. `npm test`: 565 tests across 81 files passed, including initial three-question SSR previews with no premature missing-data claim.
- `NEXT_PUBLIC_ARTIFACT_URL=http://localhost:8001 npm run build`: passed, 2,386 pages exported.
- `node scripts/check-guide-refinement.mjs`: all six desktop/390/320px light/dark workflows passed; preview count, stable heading identity, loaded answers, calculations, evidence, WCAG and reflow checked.
- Repository `check:a11y` for `/guide`, `/guide?place=224`, `/tax`, `/afford?income=100000`: all 32 desktop/mobile light/dark closed/expanded WCAG states passed. Manual/incomplete checks remain manual.
- `check:a11y:interactions`: passed across existing map/search/theme, expanded routes, section/evidence focus and no-JavaScript report fallback.
- Populated public tax-result smoke check at 390px dark: passed WCAG/reflow after correcting the temporary proxy to allow uppercase shard filenames and using the browser context required by axe. Result screenshot reviewed at `/tmp/tool-tax-result-mobile.png`. These were preview/harness failures, not application code fixes.
- `git diff --check`: passed. No backend tests for presentation-only changes; no separate frontend linter configured. No merge/deployment or canonical-document changes.
