# Buyer guide refinement

## What changed

- Clean up the buyer's guide into a neutral workspace: place and household setup side by side on desktop, stacked on phones.
- Use quieter numbered setup labels, editorial section headings and distinct affordability/longer-view/pre-offer cues.
- Consolidate how-it-works and section jump into a compact header utility row. Shorten introductory/privacy copy without changing its meaning.
- Use readable 44px controls and two-column household fields on mobile. Arrange pre-offer checks in two columns on desktop, one on mobile, with fine horizontal rules instead of repeated side bars/cards.
- Add an explicit empty-state direction before a place is selected.
- Correct strong-evidence badge contrast in dark mode, caught by the populated guide audit; scoped to the guide, retaining evidence classifications.

## Files/modules affected

- `web/app/guide/page.tsx`, `web/components/DecisionGuide.tsx`, `web/app/ui-refinement.css`.
- `web/scripts/check-guide-refinement.mjs`.

## Architectural or implementation decisions

- Presentation only: retain all calculations, persistence, sources, strength labels, limitations, official links and section-jump targets.
- Native input, select, details and existing place picker remain unchanged; no dependencies, new fetches or hidden result tabs.

## Assumptions

- Approved buyer's guide cleanup on the current experimental branch, not an official milestone or production deployment.
- Canonical documentation and data remain untouched.

## New TODOs / limitations

- Plain `npm run build` defaults artifact requests to the API, which has no `/packet/5y.json` file route. Initial place-selection audit timed out on that 404. Local preview rebuilt with `NEXT_PUBLIC_ARTIFACT_URL=https://housing-data.jasonli.app`, the configured publish origin in Makefile. The guide reads deployed place artifacts, not locally regenerated artifacts; no application data-flow change made.
- Direct published-origin preview also failed: the artifact host returned 200 but no localhost CORS permission. Final preview uses a temporary loopback read-only proxy on 8001, permitting only GETs for `/regions/<id>/*.json` from the fixed published host, with CORS for localhost:3002. Build uses `NEXT_PUBLIC_ARTIFACT_URL=http://localhost:8001`. No production CORS/configuration changes. Restart/reconfigure this preview proxy after the session ends; never deploy a localhost artifact URL. Normal production publish uses the Makefile's configured origin.
- Automated checks supplement real-device and screen-reader review.
- An unrestricted axe scan flags the existing global source-status text outside a landmark (`region`, a best-practice rule). This guide-only pass does not alter the shared masthead. Final audits use the same WCAG 2 A/AA through 2.2 AA tags as the repository's existing audits; do not claim all best-practice rules passed.
- The guide still needs a published mortgage rate and readable per-place artifacts to answer; unavailable data states are retained.

## Verification

- `npm run typecheck`: passed; `npm test`: all 564 tests across 80 files passed.
- `NEXT_PUBLIC_ARTIFACT_URL=http://localhost:8001 npm run build`: passed; 2,386 static pages.
- `A11Y_ORIGIN=http://localhost:3002 node scripts/check-guide-refinement.mjs`: all six 1280/390/320px light/dark workflows passed (place picker, actual published Somerset artifacts, income answer, comparison/checklist, expanded evidence, WCAG, no overflow or application errors). Desktop light and mobile dark screenshots reviewed; screenshots `/tmp/guide-*.png`.
- `A11Y_ORIGIN=http://localhost:3002 A11Y_PATHS='/guide,/guide?place=12' A11Y_OUTPUT=/tmp/guide-a11y.json npm run check:a11y`: 16 desktop/mobile light/dark closed/expanded states passed. Incomplete/manual checks remain manual; best-practice landmark limitation noted above.
- `git diff --check`: passed. No backend changes/tests; no separate frontend linter configured. No canonical documentation edit, merge or deployment.
