# Region page card redesign experiment

## What changed

- Replaced the county, municipality, and ZIP region page's static stand-out grid with
  three independently scrollable shelves: Leading, Lagging, and Highest and lowest.
- Added circular previous/next controls whose enabled state follows each shelf's scroll
  position. The shelves also support touch/trackpad scrolling, keyboard focus, scroll
  snapping, and reduced-motion preferences.
- Styled Leading cards orange, Lagging cards with the site's ranking blue, and Highest
  and lowest cards neutral graphite.
- Moved The housing here above What it costs per month and restyled it as a compact,
  low-contrast, fixed-height horizontal summary band with its own paging arrows.
- Kept report pages on the existing compact, non-interactive stand-out grid.

## Files/modules affected

- `web/components/RegionStandOuts.tsx`
- `web/components/HousingBand.tsx`
- `web/components/StandOuts.tsx`
- `web/app/regions/[id]/page.tsx`
- `web/app/globals.css`

## Architectural or implementation decisions

- The interactive region treatment is a separate client component instead of a mode on
  the report component. This prevents the experiment's markup, controls, and client-side
  behavior from leaking into report pages.
- Stand-out cards use a fixed narrow width and a slightly taller-than-wide proportion,
  reducing their footprint by roughly half while leaving the next card visible as a
  scrolling cue.
- Carousel controls are hidden when a row fits without scrolling and disabled at the
  corresponding edge when it overflows.
- Graphite is intentionally neutral for current-value extremes: being highest or lowest
  is not consistently favorable or unfavorable across metrics.
- The housing band uses a faint region-accent wash and smaller typography so it remains
  distinct without competing with the larger cost cards immediately below it.
- The housing band has a fixed eight-rem height. Its narrow title column owns the paging
  arrows, and the fact area measures how many items fit at each viewport width.
- Housing facts are paged in place rather than placed in an overflow container so their
  definition tooltips are not clipped by the fixed-height banner.

## Assumptions

- "Apple-like" means large rounded cards, restrained gradients, generous internal space,
  horizontal shelves, scroll snapping, and compact circular navigation rather than a
  direct copy of an Apple product surface.
- Stand-out groups remain conditional. A row is not rendered when the packet contains no
  qualifying metric for that group.
- The graphite treatment is an experimental choice and can be replaced after visual
  review without changing the component structure.

## New TODOs / limitations

- The project has no component-test harness for interactive React behavior. Arrow states,
  scrolling, responsive layouts, and report isolation were checked in the browser rather
  than added as DOM tests.
- Region pages with no qualifying stand-outs continue to omit the section entirely.
- The redesign intentionally does not change report pages or canonical documentation.

## Verification

- `cd web && npm run typecheck`
  - Passed.
- `cd web && npm test -- --run`
  - 24 files passed; 204 tests passed.
- `cd web && npm run build`
  - Production static export passed; 2,276 pages generated.
  - The existing warning that `NEXT_PUBLIC_ARTIFACT_URL` was unset remained.
- Browser checks against the local API and Next development server:
  - County `/regions/8`: housing band precedes costs; stand-out arrows scroll and disable
    correctly at both ends in light and dark themes.
  - County `/regions/5`: all three card colors/groups render, including blue Lagging.
    At the 639px preview the banner remained 128px tall before and after paging, its title
    column measured 104px, and stand-out cards measured 172px by 192px. Controls disappear
    when a row fully fits.
  - Municipality `/regions/415` and ZIP `/regions/2842`: no horizontal page overflow at
    the mobile viewport; data-thin pages continue to omit absent stand-out groups cleanly.
  - At a 375px page width, the revised Atlantic County layout also had no horizontal page
    overflow; stand-out cards retained the 172px by 192px proportion.
  - Report `/regions/8/report`: the existing static grid remains and has no carousel
    controls.
