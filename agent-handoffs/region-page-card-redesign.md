# Region page card redesign experiment

## What changed

- Replaced the county, municipality, and ZIP region page's static stand-out grid with
  three independently scrollable shelves: Leading, Lagging, and Highest and lowest.
- Added circular previous/next controls and twelve-second auto-advance with a quiet hairline timer
  for every overflowing shelf. The shelves also support touch/trackpad scrolling,
  keyboard focus, scroll snapping, and reduced-motion preferences.
- Styled Leading cards orange, Lagging cards with the site's ranking blue, and Highest
  and lowest cards neutral graphite.
- Moved The housing here above What it costs per month and restyled it as a compact,
  low-contrast, fixed-height horizontal summary band with its own paging arrows.
- Promoted population to a compact upper-right header card beneath the region rule, with
  its ACS estimate year and five-year change. Removed the duplicate population count from
  the metadata sentence and the People item from The housing here.
- Recast housing ranks as larger corner labels (`6/21`) while keeping the plain-language
  comparison (`newer than most`) in the reading line. A later visual pass increased those
  labels again so the rank reads as a primary fact rather than fine print.
- Restyled The housing here with a layered teal wash, a small Profile eyebrow, Space Grotesk
  figures, and direction-aware staggered transitions unique to that banner.
- Reorganized the long cost explanation into a labelled evidence strip on interactive region
  pages: a distinct amber Not included note modelled on the statewide About Since 2019 note
  now comes first, followed by Monthly cash, Comparison caveat, and Five-year context. The
  fixed-rules disclaimer is a quiet footer; no content or qualification was removed.
- Filled the header of the Every table, the trends and the interpretation expander with the
  region teal while leaving its expanded tables, charts, and interpretation on their existing
  neutral surface.
- Moved stand-out definitions into a floating page layer so the scroll rail cannot clip
  long definitions.
- Kept report pages on the existing compact, non-interactive stand-out grid.

## Files/modules affected

- `web/components/RegionStandOuts.tsx`
- `web/components/HousingBand.tsx`
- `web/components/FloatingMetricTerm.tsx`
- `web/components/useAutoCarousel.tsx`
- `web/components/CostToOwn.tsx`
- `web/components/StandOuts.tsx`
- `web/app/regions/[id]/page.tsx`
- `web/app/globals.css`
- `web/app/redesign.css`

## Architectural or implementation decisions

- The interactive region treatment is a separate client component instead of a mode on
  the report component. This prevents the experiment's markup, controls, and client-side
  behavior from leaking into report pages.
- Stand-out cards use a fixed narrow width and a slightly taller-than-wide proportion,
  reducing their footprint by roughly half while leaving the next card visible as a
  scrolling cue.
- Carousel controls and progress are hidden when a row fits without scrolling. Overflowing
  carousels advance every twelve seconds and wrap at either end, whether advanced by the timer
  or an arrow.
- Auto-advance runs only while a carousel is in view, pauses on hover or focus, pauses while
  the page is hidden, and is disabled when the reader requests reduced motion.
- Graphite is intentionally neutral for current-value extremes: being highest or lowest
  is not consistently favorable or unfavorable across metrics.
- The housing band uses a faint region-accent wash and smaller typography so it remains
  distinct without competing with the larger cost cards immediately below it.
- Population is filtered from the region-page banner at the rendering boundary rather than
  removed from `housingProfile`. The shared data-to-copy helper and its tests remain intact,
  while the header card becomes the region page's single population presentation.
- The population card keeps the existing ACS definition and change context. On a phone it
  occupies the open corner beside the breadcrumb and page-kind label; long breadcrumbs wrap
  into their reserved left column instead of colliding with the card.
- The population card uses a neutral surface and a narrow teal edge instead of the housing
  banner's full teal wash. The shared accent keeps them related without making the card look
  like a miniature version of the banner.
- Housing facts remount only within the region-page banner when its page changes, which lets
  forward and backward moves use short, opposite-direction reveals. Motion remains absent for
  readers who request reduced motion.
- The housing band has a fixed 6.75-rem desktop height and seven-rem mobile height. Its
  narrow title column owns the paging arrows, and the fact area measures how many items fit
  at each viewport width.
- Housing facts are paged in place rather than placed in an overflow container so their
  definition tooltips are not clipped by the fixed-height banner.
- Stand-out definitions use a region-page-only client tooltip rendered under `document.body`.
  The general CSS-only definition component and all report/table definitions remain intact.
- `CostToOwn` selects the evidence-strip presentation only when its interactive controls are
  present. Reports pass `control={false}` and retain the original prose, preserving the explicit
  report-isolation boundary.
- The omissions note uses the existing amber caution token rather than teal or green: insurance,
  upkeep, closing costs, and opportunity cost are limitations of the estimate, not favorable data.
- Moving the omissions note changes only the interactive region-page evidence strip. Reports
  continue to use their existing prose order through `control={false}`.

## Assumptions

- "Apple-like" means large rounded cards, restrained gradients, generous internal space,
  horizontal shelves, scroll snapping, and compact circular navigation rather than a
  direct copy of an Apple product surface.
- Stand-out groups remain conditional. A row is not rendered when the packet contains no
  qualifying metric for that group.
- The graphite treatment is an experimental choice and can be replaced after visual
  review without changing the component structure.

## New TODOs / limitations

- The project has no component-test harness for interactive React behavior. Auto-advance,
  arrow wrapping, progress, floating definitions, responsive layouts, and report isolation
  were checked in the browser rather than added as DOM tests.
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
  - The first sandboxed attempt could not reach the already-running host API on port 8000; the
    same build passed once run with local-API access.
- Browser checks against the local API and Next development server:
  - County `/regions/8`: housing band precedes costs; stand-out arrows scroll correctly in
    light and dark themes.
  - County `/regions/5`: all three card colors/groups render, including blue Lagging.
    At a 700px viewport the banner remained 108px tall while it automatically advanced
    from `1974 / 0.19 acres / 68.7%` to `68.7% / 0.3% / 17.1%`; the progress line reset for
    the new page. A current-value shelf stayed in place after 6.5 seconds and advanced after
    the twelve-second interval. Its computed timer was one pixel high, with an 8%-strength
    track and a 34%-strength fill.
  - The longest tested stand-out definition rendered to 161px high, extended 49px below the
    scroll rail, and remained fully visible rather than being clipped.
  - Municipality `/regions/415` and ZIP `/regions/2842`: no horizontal page overflow at
    the mobile viewport; data-thin pages continue to omit absent stand-out groups cleanly.
  - At a 375px page width, the revised Atlantic County layout also had no horizontal page
    overflow. The banner measured 112px high, showed one fact with its larger corner rank,
    and retained its progress line; stand-out cards retained the 172px by 192px proportion.
  - The amber Not included slip remained readable at 375px, and the teal details header kept
    the expanded body neutral in dark mode.
  - Somerset County `/regions/12`: the new population card measured 140px by 69px at the
    375px viewport, ended 11px before the title began, and its ACS definition opened fully
    within the viewport. Population no longer appeared in either the metadata sentence or
    The housing here; Not included was the first item in the cost evidence strip.
  - Municipality `/regions/415`: its three-part breadcrumb wrapped beside the population card
    without colliding with it. Both tested phone pages had a 360px document width and a 360px
    scroll width, so neither introduced horizontal overflow.
  - Follow-up polish at 375px: housing ranks computed at 14px. Aberdeen's longest first-page
    rank (`276/562`) occupied 53px, cleared the value below it, and preserved the 360px document
    and scroll widths. Somerset's neutral population card remained in the same header footprint
    while reading separately from the teal-washed housing banner.
  - Report `/regions/5/report`: the cost explanation remains in its original paragraph layout,
    the existing static stand-out grid remains, and there are no carousel controls.
