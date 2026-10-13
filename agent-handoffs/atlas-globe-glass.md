# Atlas globe and glass overlays

## What changed
- Atlas opens on an interactive world globe. Added Globe → US states → NJ counties navigation, with state selection/focus and a New Jersey county drilldown action.
- Map now fills the main viewport; filters, comparison list, zoom controls and legend float over it. Desktop comparison panel remains resizable; mobile results remain a compact expandable drawer.
- Apple-inspired glass treatment: frosted backdrop blur/saturation, rounded surfaces, soft highlights and layered shadows. Comparison content retains a near-opaque backing for legibility. Reduced-transparency and unsupported-filter fallbacks are opaque.
- State and county views share a scoped measure loader and synchronized map/table controls. Latest values, dates, margins and change windows remain sourced records.

## Files/modules affected
- `web/app/atlas/page.tsx`, `atlas.css`
- `web/components/HousingAtlas.tsx`
- `web/scripts/check-atlas-globe.mjs`, `check-housing-atlas.mjs`

## Architectural or implementation decisions
- Reused existing Natural Earth world silhouette, Census state backdrop asset, packed county geometry and orthographic renderer. No new map provider, dependency or backend changes.
- State coverage verified from live local API: only New Jersey has warehouse state records. Other US states/DC/Puerto Rico have geographic navigation only, labelled unavailable. No county drilldown or place link is fabricated for them.
- Geographic placeholders use UI-only negative identifiers and are never passed into canonical place routing. Actual state/county rows use warehouse IDs.
- Globe dragging/arrow keys rotate the camera; county dragging/arrow keys pan. Reset and zoom remain explicit controls. Decoded outlines are memoized to retain renderer culling caches during camera movement.
- A single published figure uses a single-color legend, not a spurious comparative range. The UI explicitly states that cross-state comparison is not yet available.
- This approximates glass with CSS, not Apple's proprietary/native material rendering. Vendor-prefixed backdrop declaration must precede the standard declaration: the build optimizer otherwise retained only the unsupported prefixed property in Chromium. Browser computed-style assertion now checks actual blur.

## Assumptions
- User's continuation adds glass styling to the unfinished globe/full-map redesign; both belong on `experiment/housing-atlas` / existing PR #159.
- State comparison is an interface ready for future coverage, not a claim of national housing data availability.

## New TODOs / limitations
- Non-US land is geographic context, not an interactive country data layer. US coverage is NJ-only for figures; further state/county coverage needs data work.
- No multi-touch pinch zoom, animated camera flights or per-state county drilldown beyond NJ. Existing zoom buttons and explicit geography controls are available.
- Backdrop appearance varies by browser/device; physical Safari/iOS testing unavailable. Publisher notices and source footer remain below the full-map viewport.
- No canonical-document edits, data changes or deployment.

## Verification
- `npm run typecheck`: passed. `npm test`: 662 tests / 106 files passed.
- Final local static build passed: 2,388 pages / 16,704 exported files.
- `node scripts/check-atlas-globe.mjs`: six 390/900/1280px light/dark cases passed: real globe/land, rotation, state-only coverage guard, NJ drilldown, unavailable-state routing guard, full-map sizing, actual backdrop blur, single-color legend, selected-state link contrast, axe/reflow and no runtime errors.
- `node scripts/check-housing-atlas.mjs`: six responsive/theme cases plus geometry-failure fallback passed; preserved county clicks, keyboard selection, map/table synchronization, drag/zoom/reset, panel resizing, filters, source details, axe and actual place navigation.
- Viewed final desktop dark and mobile light screenshots. `git diff --check` passed. Backend tests not run (no backend edits).
