# Local picture theme and layout restoration

## What changed
- Restored the computed From the data highlight to the right-hand column beside the interpretation on desktop, retaining the existing 10-second animated rotation and mobile stacking.
- Ranked measures remain within the note in their existing disclosure/card layout.
- Paper, ink, tape and folded corner now follow light/dark mode: ivory in light mode, neutral charcoal in dark mode.
- Tax lookup links use its teal accent. Same-page commute/service-provider and public-safety links use green. Official external links remain blue.

## Files/modules affected
- web/components/ExplanationPanel.tsx
- web/app/ui-refinement.css
- web/scripts/check-card-polish.mjs

## Architectural or implementation decisions
- Reused the original editorial grid and EditorialMetrics component; no new animation implementation or regeneration.
- Existing reduced-motion, focus/hover and document-visibility behavior is preserved.
- Internal-link fallback excludes the specifically colored tax and next-step fragment links.
- Full-report layout and print styling are unchanged.

## Assumptions
- Continue the assigned experimental branch and PR; no merge or deployment.

## New TODOs / limitations
- Local artifact build configuration must not be deployed.
- AI reading remains stale where its underlying figures changed; the warning is retained.

## Verification
- npm run typecheck: passed.
- npm test: 575 tests passed across 85 files.
- git diff --check: passed.
- NEXT_PUBLIC_ARTIFACT_URL=http://localhost:8001 npm run build: passed, 2,386 exported pages.
- node scripts/check-card-polish.mjs: passed at 1280px and 390px in light/dark modes, including right-hand desktop highlight placement, paper citation ink, exact tax and same-page link colors, expanded rankings, existing destination colors, no overflow/runtime errors, and no axe WCAG A/AA violations in checked states.
- Additional normal-motion browser check confirmed the computed highlight changes after ten seconds. Desktop/dark screenshot visually inspected.
