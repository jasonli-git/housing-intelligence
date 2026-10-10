# Local picture paper note and destination colors

## What changed
- Local AI interpretation gets a muted taped-paper treatment, with a slight desktop tilt and a straight mobile layout.
- Computed annotation and ranked measures remain outside the note; AI badge, stale warnings, citation evidence and model attribution are retained.
- Restored geographic breadcrumb colors by excluding breadcrumbs from the generic internal-link fallback.
- County exploration links use county green; town directory links use town teal; buyer-guide links use its rose accent. State links use state blue. Other internal text links retain stone/ivory, external links retain existing blue.

## Files/modules affected
- ExplanationPanel.tsx, local region page, ui-refinement.css
- CountyPlaces.tsx, StateModeWorkspace.tsx, CountyComparison.tsx
- scripts/check-card-polish.mjs

## Architectural or implementation decisions
- The paperNote prop is opt-in for local consumer summaries, not full reports. It changes presentation only; no regeneration or changes to the interpretation.
- Destination classes mark known geographic relationships instead of guessing a destination from numeric IDs.
- Paper/tape decoration is CSS-only and screen-only. No new dependency or animation.

## Assumptions
- Continue the assigned experiment and PR; no new branch, merge or deployment.

## New TODOs / limitations
- Future directories should use explicit destination classes rather than relying on the generic internal-link fallback.
- Local artifact URL used for verification must not be deployed.

## Verification
- npm run typecheck: passed.
- npm test: 575 tests across 85 files passed.
- Initial axe check caught insufficient contrast on the paper note's citation label. Added paper-specific secondary/muted text colors before the final rerun.
- Browser harness was narrowed to select the buyer-guide link specifically, rather than both household action links.
- NEXT_PUBLIC_ARTIFACT_URL=http://localhost:8001 npm run build: passed, 2,386 exported pages.
- node scripts/check-card-polish.mjs: passed at 1280px/390px in light/dark themes. Exact state/town/county/guide colors verified; note excludes measured annotation and ranked disclosure; no overflow/runtime errors; no axe WCAG A/AA violations in checked local-page states. NJ county-link colors checked too.
- Desktop/light and mobile/dark note screenshots visually inspected. Existing stale-reading warning remains visible; no regeneration performed.
- git diff --check: passed.
