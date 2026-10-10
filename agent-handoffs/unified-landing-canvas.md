# Unified landing canvas

## What changed

- Follow-up: remove the redundant Find your place heading, replace separate reveal/return shortcuts with a persistent Search places / Explore map pressed-button group, and remove the outer tinted surface. Search atlas, coverage strip and page now share one background. Query/viewport preservation and focus transfer retained.
- Group the existing title, tagline, free badge, place search/illustrated atlas, New Jersey coverage and national benchmarks into one continuous landing composition.
- Keep desktop's faint surface without a heavy outline; mobile removes the extra inset to preserve reading width and the single-line free badge. No fixed-height hero or duplicate search.
- Trace actual national trend linework once on entry (750ms). Values, dates, definitions, dots and scales remain static. The US atlas still loops independently.

## Files/modules affected

- `web/app/page.tsx`, `housing-entry.css`, `ui-refinement.css`.
- `web/components/NationalTrend.tsx`, new `TrendEntrance.tsx` and its tests.
- `web/scripts/check-accessibility-interactions.mjs`.

## Architectural or implementation decisions

- Retain server-rendered data and accessible chart markup; a small client wrapper observes visibility and disconnects on first entry. No chart package, data fetch or recalculation.
- Content remains visible without JavaScript or IntersectionObserver. Reduced motion disables the line animation. Animation is decorative, not a claim of live data.
- Existing search/map focus handling, coverage routes and footer remain intact. The canvas is a grouping element, not an extra landmark or modal.

## Assumptions

- User approved both the unified composition and one-time metric motion on the existing experimental branch. No production deployment, canonical documentation or model regeneration requested.

## New TODOs / limitations

- Native chart point titles retain their existing touch/keyboard discoverability limitations.
- Visual reader review and real-device/screen-reader review remain useful; automated audits are not a substitute.
- Initial 320px audit found badge wrapping from added canvas padding; removed mobile inset before final verification.

## Verification

- Single-tone/mode-switch follow-up: typecheck, 564 tests/80 files, 2,386-page build, focused UI checks, all eight landing axe states and full interaction audit passed. New assertions cover no redundant heading, pressed states and atlas/page background equality. Desktop dark and mobile light screenshots reviewed. Existing input field keeps its own readable control surface; no tinted outer composition. No deployment.
- `npm test`: 564 tests across 80 files passed, including entry/disconnect and unavailable-observer cases.
- `npm run typecheck`: passed.
- `npm run build`: passed; 2,386 static pages exported against the local API.
- `check:ui-refinement`: passed after the mobile-inset fix; 1280/390/320px checks in both themes, search/map preservation and revealed-map axe checks. Desktop dark and mobile light screenshots reviewed.
- `check:a11y` restricted to `/`: all eight desktop/mobile, light/dark, closed/expanded states passed with no automated violations. Manual/incomplete checks remain manual.
- `check:a11y:interactions`: passed, including new one-time chart/reduced-motion assertions, search/map keyboard controls, expanded mobile routes and no-JavaScript report fallback.
- `git diff --check`: passed. No backend tests for this presentation-only change; no separate frontend linter configured. No merge or deployment.
