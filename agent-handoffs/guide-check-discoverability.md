# Guide check discoverability

## What changed
- Combined the pre-offer action list and duplicated local-evidence list into ten topic entries. Each exposes its primary action and existing local finding; sources, evidence-strength reasoning, limitations and additional links remain expandable within that entry.
- Check-index links use the guide's rose ink, without changing external-source blue or destination-specific tool links.
- Centered slide arrows with flex layout and adjusted mobile/tablet gutters, sizes and sticky positioning.

## Files/modules affected
- `web/components/DecisionGuide.tsx`
- `web/app/guide.css`
- `web/scripts/check-guide-checks.mjs`

## Architectural or implementation decisions
- Preserve all existing findings, limitations, source attribution and links. No data regeneration or calculations changed.
- Keep a single addressable topic ID for each check, eliminating the second repeated list.
- Sources and limits remain one optional detail per topic, with existing strength explanations nested inside.

## Assumptions
- Browser comments authorize these refinements on the existing `experiment/mobile-search-polish` branch / PR #158.

## New TODOs / limitations
- Physical iOS/Safari testing unavailable. Native Chromium responsive checks are not a substitute.
- Existing legacy guide-refinement script targets retired tagline/preview behavior; new focused regression checks cover the current slide/check interface.

## Verification
- `npm run typecheck`: passed.
- `npm test`: 656 tests / 105 files passed.
- Initial sandbox build could not reach the local API; rerun with localhost access succeeded. Local services already running, so duplicate startup attempts did not replace them.
- Browser regression results recorded after final build below.
- Final local-preview static build passed: 2,386 pages, 16,695 exported files.
- `node scripts/check-guide-checks.mjs`: all eight 320/390/814/1243px light/dark cases passed: ten unified checks, visible findings, sources disclosure, rose shortcut colors, centered arrows and navigation, no horizontal overflow, axe checks on the pre-offer panel and page. Reduced motion avoids auditing transient entrance opacity.
- Inspected 390px dark screenshot. `git diff --check` passed. No backend tests (frontend-only).
