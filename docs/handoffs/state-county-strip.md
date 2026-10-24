# State county strip

## What changed
- Replaced the folder-style county cabinet with a single full-width pill-navigation row above the statewide snapshot.
- Each county name links directly to its place page. Removed preview descriptions, decorative folders, and the separate directory toggle.
- Native swipe/trackpad scrolling, smooth arrow-button scrolling, directional/Home/End keyboard browsing, subtle hover motion and progressive scroll-linked text motion.
- Existing search and compare modes remain below the snapshot. Jump-to-section discovers the new county row in reading order.

## Files/modules affected
- `web/components/CountyCabinet.tsx` and its tests
- `web/components/StateModeWorkspace.tsx`
- `web/app/states/new-jersey/page.tsx`
- `web/app/county-cabinet.css`
- `web/scripts/check-county-strip.mjs`

## Architectural or implementation decisions
- Reuse verified county IDs/canonical routes, not inferred URL names.
- No auto-scrolling; readers control the strip. Scroll-linked animation is progressive enhancement and reduced motion disables decorative/smooth motion.
- Keep all links reachable with native tab navigation; arrows provide a visible desktop alternative to trackpad/swipe.
- Remove obsolete folder styling but preserve search/comparison workspace styling.

## Assumptions
- User browser comment authorizes implementing this on the existing UI branch and PR.

## New TODOs / limitations
- Physical Safari/mobile testing unavailable. Scroll-linked animation support varies; native scrolling and hover styling work without it.
- No data/backend changes or canonical-document edits.

## Verification
- `npm run typecheck`: passed.
- `npm test`: 656 tests / 105 files passed; cabinet tests now verify direct destinations and keyboard focus movement.
- Additional build/browser results below.
- Local-preview static build passed: 2,386 pages, 16,695 exported files.
- `node scripts/check-county-strip.mjs`: eight 320/390/814/1243px light/dark cases passed: 21 direct destinations, no folder/preview panels, strip under 70px tall above snapshot, arrow scrolling, Home/End focus, working comparison/search modes, no page overflow, axe on strip, actual county navigation.
- Viewed 390px dark and 1243px light screenshots; inspected dark pill computed border/background. `git diff --check` passed.
