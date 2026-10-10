# Local picture paper revision

## What changed
- Returned computed highlight and ranked measures inside the local-picture note, as requested.
- Replaced yellow/olive note colors with neutral ivory paper and dark ink in both themes.
- Added faint paper grain, uneven translucent tape, layered edge shadows and a small corner fold. Mobile stays straight.

## Files/modules affected
- web/components/ExplanationPanel.tsx
- web/app/ui-refinement.css
- web/scripts/check-card-polish.mjs

## Architectural or implementation decisions
- The note uses a light paper color scheme even on a dark page; paper-specific tokens preserve legible controls and labels.
- AI attribution, stale warning, citations and computed labels remain intact. No regeneration or changed measurements.
- CSS decoration adds no dependencies; full-report and print presentation remain unchanged.

## Assumptions
- Continue the assigned branch and existing PR; no merge or deployment.

## New TODOs / limitations
- Paper is intentionally lighter than surrounding dark-mode surfaces; user visual review remains the integration decision.
- Local artifact build configuration must not be deployed.

## Verification
- npm run typecheck: passed.
- npm test: 575 tests across 85 files passed.
- git diff --check: passed.
- Expanded-note browser checks passed at 1280px and 390px in both themes, including no overflow/runtime errors and no axe WCAG A/AA violations. Visual inspection additionally caught a faint Close label; explicitly set its paper-ink color.
- Visual review also caught cited numbers inheriting pale dark-page ink; explicitly set paper citation ink and added a computed-color assertion.
- Final NEXT_PUBLIC_ARTIFACT_URL=http://localhost:8001 npm run build: passed, 2,386 exported pages.
- Final node scripts/check-card-polish.mjs: all four desktop/mobile light/dark cases passed, including cited ink, expanded rank disclosure, existing destination-color assertions, and axe checks. Final mobile/dark screenshot visually inspected.
