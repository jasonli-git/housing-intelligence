# Consumer reading and evidence-page experiment

## What changed

- Retired the redundant affordability and rent-versus-buy questions from the visible consumer reading without regenerating or deleting the stored reading. The remaining “What’s changing?” answer leads the ranked measures; “What should I check before moving?” sits with the cost caveats and is displayed as a sentence list.
- Moved the monthly-cash comparison into a joined headline above the cost cards. Made ranked measures a separate disclosure and gave the tables and trends a clearer data-exploration entry point.
- Added an indexed housing-costs-versus-income trend and interactive grouped rank plots, with exact rank and sampling range available on inspection. Kept the underlying tables.
- Separated the model-written detailed reading from the data disclosure, labeled it “Automated data summary,” and added a direct shortcut. No reading content or generation rules changed.
- Tightened the New Jersey county comparison so all 21 counties appear without an inner scroll on desktop.

## Files/modules affected

- `web/app/regions/[id]/page.tsx`, `web/components/CostToOwn.tsx`, `web/components/ExplanationPanel.tsx`, `web/components/MoreExpander.tsx`, `web/components/RankOverview.tsx`
- New `web/components/IndexedComparison.tsx`, `web/components/RankDotPlot.tsx`, and `web/lib/chartInsights.ts`
- `web/lib/citations.ts` and its tests; new `web/lib/chartInsights.test.ts`
- Presentation styles in `web/app/atlas-pages.css`, `web/app/globals.css`, `web/app/new-jersey.css`, and `web/app/redesign.css`

## Architectural or implementation decisions

- The API's `analyst` audience, generation prompt, stored bodies, and citations remain unchanged. “Automated data summary” is a display label, not a new reading type.
- Visible consumer sections are selected from the stored reading and their figure list is filtered to the citations within that section. Sentence splitting preserves the source wording.
- The indexed chart requires all three expected series and a shared baseline year; it hides on sparse pages rather than implying a partial three-way comparison. Series retain their actual latest publication dates.
- Ranked plots group nearby marks only for display. The inspector gives each measure's exact rank and, where available, its plausible sampling range; tables remain the full accessible record.

## Assumptions

- This is an experimental UI exploration, not approval of a new narrative methodology or a change to canonical documentation.
- The existing consumer “What’s changing?” answer is preferable to duplicating an affordability or cost conclusion already computed above it.

## New TODOs / limitations

- Evaluate whether a separately piloted, grounded “so what?” synthesis adds useful, well-supported context beyond the consumer headline and the automated digest. Do not regenerate readings until that method is reviewed.
- Sentence-based bullets reflect punctuation in stored model text; they are not a newly authored checklist.
- The local static build warns that `NEXT_PUBLIC_ARTIFACT_URL` defaults to localhost. Set the published artifact origin for deployment; this branch is not deployed.

## Verification

- `cd web && npm test -- --run` — 34 test files, 292 tests passed.
- `cd web && npm run typecheck` — passed.
- `cd web && npm run build` — passed with access to the running local API; 2,278 static pages generated. A first sandboxed attempt could not reach localhost:8000.
- `git diff --check` — passed before the handoff edit; rerun before commit.
- No separate lint script is defined in `web/package.json`.
