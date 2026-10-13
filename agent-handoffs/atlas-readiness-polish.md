# Atlas readiness polish

## What changed
- Put coverage beside the main controls: New Jersey figures versus other-state outlines; county views show the available count.
- Unsupported-state selections explicitly say Boundary only. Existing missing-value hatching, source notes and tables remain.
- Defer the 23,874-byte county geometry download until the county view is opened; retain loaded geometry across geography changes.
- Income-band labels are keyboard/touch buttons with a concise HUD-benchmark explanation. No inferred dollar thresholds.
- Kept the existing Reset control and interruptible camera behavior; no redundant new controls.

## Files/modules affected
- `web/components/HousingAtlas.tsx`
- `web/components/IncomePressure.tsx` and its unit test
- `web/app/income-pressure.css`
- `web/scripts/check-atlas-readiness.mjs`

## Architectural or implementation decisions
- County fetch waits for URL restoration and county mode, avoiding unnecessary startup work on globe/state visits. Abort on navigation; cached component state avoids repeat downloads once successful.
- Coverage remains explicit without removing navigation into unsupported states.
- Kept analytical tables, margins and provenance intact; no backend/data changes.

## Assumptions
- Current state-data coverage remains New Jersey only, as in the existing Atlas contract.
- Local CPU-throttled Chromium timings are diagnostic, not production field-performance measurements.

## New TODOs / limitations
- Physical iOS/Safari and Android checks are still required: touch drag versus scroll, real keyboard/visual viewport, theme transitions and comparison sheet.
- Browser reduced-height reflow does not substitute for a real software keyboard.
- No production network latency, low-end-device GPU/FPS or deployed Web Vitals measured. No speedup claim from the modest deferred download.
- No deployment or merge performed.

## Verification
- `npm run typecheck`: passed.
- `npm test`: 671 tests / 108 files passed.
- Static build passed: 2,388 pages / 16,705 exported files. Initial sandboxed attempt could not reach the existing local API; retry with local network access passed. Existing API/preview services were preserved.
- `node scripts/check-atlas-readiness.mjs`: six width/theme cases passed for visible coverage, deferred requests, direct dragging, reset, finder, reflow and axe. Local cold-context map readiness 420–828 ms at 4x CPU; decoded script resources 779,721–917,070 bytes (not compressed transfer sizes).
- `node scripts/check-atlas-comparison-pressure.mjs`: four cases passed.
- `node scripts/check-atlas-navigation.mjs`: six cases passed.
- `git diff --check`: passed.
