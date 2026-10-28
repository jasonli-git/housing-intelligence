# Local stories rail

## What changed

Converted the Princeton local-story gallery from a multirow grid into a compact horizontal rail. Retained all 13 stories, screenshot backgrounds, live headlines, geographic qualifications, source periods and place-aware destination links. Cards peek at the right edge to suggest additional content.

## Files/modules affected

- `web/components/PlaceStoryGallery.tsx`
- `web/components/PlaceStories.module.css`
- `web/scripts/check-place-stories.mjs`

## Architectural or implementation decisions

Mirrors Visual Stories' StoryRail behavior: horizontal native overflow, proximity snapping, a thin scrollbar, frosted glass edge arrows fading on hover/focus, always available on touch devices, disabled controls at boundaries, ResizeObserver measurements with listener cleanup. Buttons move 85% of the viewport and respect reduced motion. Arrow keys/Home/End navigate focused story links; normal Tab and native scrolling remain available. No auto-advancing carousel. Print uses an expanded two-column grid rather than clipping the rail.

Cards use a slightly smaller headline and tighter padding, but essential qualifiers and metadata are not truncated. The responsive rail shows about 3.25 cards on desktop, 2.2 on medium screens, and 84% card width on mobile. Existing story/deep-link IDs remain on the cards. No changes to the public story library or nonpilot place pages.

## Assumptions

Use the existing Visual Stories interaction style without changing story content or introducing another categorization layer. Local-only work on the assigned experiment branch; no push/deploy.

## New TODOs / limitations

Arrow buttons require JavaScript; native overflow and story links do not. No data fetch, warehouse or capture changes required. Whole-row height follows the longest card at each width so caveats remain readable.

## Verification

- TypeScript passed.
- All 842 web tests in 142 files passed.
- Scoped production export passed (1,188 routes).
- Browser checks at 320/390/768/1440px in light/dark passed for 13 cards, compact track height, next-arrow scrolling, Home/End/arrows, no document overflow and scoped axe accessibility.
- Verified offscreen-card access and visually inspected desktop dark/mobile light screenshots.
- Added carousel assertions to the broader story regression harness. The full cross-story harness was not rerun for this presentation change; focused rail checks covered its new interactions.
- No-JavaScript native scrolling/deep-link checks passed at 390/1440px: all 13 links present, horizontal overflow available, native hash navigation reveals the offscreen broadband card.
- `git diff --check`: passed.
