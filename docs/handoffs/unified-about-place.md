# Unified About this place

## What changed

Grouped Princeton's current-value comparison rail and local story carousel into one coordinated block within the existing About this place section. Replaced their repeated place-name headings with smaller sibling h3 labels: How it compares and Local stories. Tightened inter-section spacing and changed the jump-navigation entry to About this place, targeting the shared parent. Existing gallery/measure anchors remain usable.

## Files/modules affected

- Place page, PlaceComparisonRail, PlaceStoryGallery and their CSS modules.

## Architectural or implementation decisions

Reuse the existing About this place parent rather than adding a second identically named section or another card wrapper. Keep the local picture before the coordinated rails and practical home checks afterward. Preserve all five comparison measures, 13 stories, uncertainty/date/source labels, destinations and carousel interactions. Other place pages unchanged.

## Assumptions

The request is a presentation/hierarchy consolidation, not removal of content or combining the two datasets into one carousel.

## New TODOs / limitations

No push/deploy. Existing local-only Princeton pilot scope remains.

## Verification

- TypeScript and five focused comparison/alternatives tests run.
- 390/1440px light/dark browser checks cover shared parent/heading levels, all content, navigation entry, document overflow and scoped axe.
- No full suite/build rerun for this heading/spacing refinement.
- Story headlines now use h4 beneath the Local stories h3; their visual styling and deep-link IDs remain unchanged. Updated the story browser harness headline selector accordingly.
- Typecheck and five focused tests passed. All four width/theme hierarchy/navigation/axe checks passed after correcting an initial harness assertion that counted both responsive navigation representations as two entries. Final story-heading styling/axe check run separately.

## Follow-up: main heading and shared rail arrows

Promoted About this place to the same responsive Georgia size/weight/line-height as The housing market, scoped to the Princeton grouped-data pilot. Added previous/next controls to the ranked-measure rail using the exact CSS module classes from Local stories: same frosted-glass surface, hover/focus fade, touch visibility, edge disabling, 85%-viewport paging and reduced-motion handling. The measure rail also supports ArrowLeft/ArrowRight/Home/End on its focused links.

The comparison rail is now a client component for measured scroll/resize state, with cleanup of its listener/observer. Existing packet/uncertainty Maps remain serializable across the React server/client boundary; verified by the production export and local hydration checks. No ranking/calculation changes.

Verification: TypeScript and all 847 web tests passed; scoped production export passed (1,188 routes). Extended the comparison browser harness to check exact heading-font parity, shared control classes and forward/back/keyboard edge behavior. Initial custom check sampled the previous-button state before the asynchronous scroll event updated it; final harness waits for the edge state before asserting. Final browser outcomes appended on completion.

The final `check-place-comparisons.mjs` run passed at 320/390/768/1440px in both themes, including heading parity, shared arrows/edge states/keyboard, comparison navigation/back, overflow and scoped axe; nonpilot Hoboken retained its prior layout. `git diff --check` passed.
