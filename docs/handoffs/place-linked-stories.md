# Place-linked visual stories — local Princeton pilot

## What changed

The owner approved recording the exploratory direction and a local three-topic pilot.
Appended **Place-linked visual stories** to Director Notes without changing earlier
entries or promoting it into canonical requirements.

Princeton now has an always-visible **Explore Princeton through the data** gallery:

- Prices & paychecks → `/stories/income-and-home-value?place=224`.
- Getting around → `/stories/the-long-commute-premium?place=224`.
- Water → `/stories/water-you-can-check?place=224`.

Each card contains a real selected-chart screenshot, one local headline, source/period
and an essential interpretation qualifier. It opens the same place/topic/data snapshot.
The three story pages gain a town/county/ZIP picker, shareable selection, return link,
local chart and the deeper existing components. Their statewide visual context remains
below, explicitly labeled **Across New Jersey**.

Moved only Princeton's detailed price/paycheck trends, commute/transit/destinations
and water-system material. The interactive market portrait, costs, other market
exhibits, contaminated-site records and other living-there topics remain. A direct
supplier-record link stays visible on the place page. Other places retain their
original exhibit layout. The navigator adds Local stories in physical reading order;
the existing getting-around anchor remains on its preview card.
Legacy price-history/trends hashes lead to the gallery, while the drinking-water
heading hash leads to the water preview (including links from property-tax details),
not the retained contaminated-sites section.

## Files/modules affected

- `docs/DIRECTOR_NOTES.md`: approved exploratory note, appended only.
- `web/app/[state]/[place]/page.tsx`: Princeton-only gallery and conditional moves.
- Three story routes listed above; `StoryShell.tsx`: a focus slot before statewide context.
- `PlaceStoryFocus.tsx`: URL selection, shared picker, artifact reads, loading/failure
  handling, abort/stale-response guard and reuse of the deeper components.
- `PlaceStoryGallery.tsx`, `PlaceStoryChart.tsx`, `PlaceStories.module.css`: cards,
  themed actual screenshots, exact-data fallback and shared selected-view chart.
- `lib/placeStories.ts`, `lib/placeStoryData.ts`: shared record/summary definitions,
  region/date/coverage checks, build-time Princeton preload and snapshot stamping.
- `GroundAndWater.tsx` / tests: explicit sites/water scopes, default unchanged.
- `IncomeScatter.tsx`: honor the selected town without removing other dots; avoid a
  second conflicting place search. County/ZIP selections are not drawn as town dots.
  The 3×/5× labels are reference ratios, not personalized affordability judgments.
- `lib/placeStories.test.ts`: source/period/geography/headline/fingerprint guards.
- `scripts/capture-place-stories.mjs`, `scripts/check-place-stories.mjs`: capture,
  identity/interaction/accessibility regressions.

## Architectural or implementation decisions

- One existing static HTML page per story; `?place=` carries selection. No HTML page
  for every place/story combination, new ingestion, endpoint or schema change.
- Princeton is preloaded at build time for this local pilot, but is **not** the default
  when the URL has no selection. Other selections use existing published JSON artifacts.
  Unsupported, invalid or missing records do not silently substitute Princeton/county data.
- Share one summary builder between card and destination. The SHA-256-derived snapshot
  includes source data, derived wording and a chart version. Capture filenames carry it;
  changed data cannot silently use an old image. Canonicalize history metadata so
  incidental display labels cannot give identical charts different fingerprints.
- The source identity includes full reused detail data, not only the headline. Bump
  the chart version when changing chart-only semantics. Theme files are separate.
- Screenshot failure falls back to the same data-derived graphic, never unrelated
  statewide artwork. Capture only six active images: three topics × two themes.
- Use neutral system-history language for water. Zero recorded historical health-based
  violations is not a current safety result; private wells are outside these records.
- Survey market values remain distinct from the current Zillow values in the portrait.
  Income/home-value pairing requires identical ACS periods. Commute modes require the
  mean's survey period; missing modes are omitted, not converted to zero.
- Existing underlying charts/tables/qualifications are reused in the focused stories,
  not rewritten as new analytical claims. Practical checks and report/source routes stay.

## Assumptions

- Approval was for the three-topic local pilot, not all components, all stories or all
  place pages. Continue `experiment/place-page-hierarchy`; do not push, open a PR or deploy.
- A story may have a local evidence view plus broader statewide context, rather than
  filtering away every other point or changing its whole geographic scope.
- Existing story methods outside this pilot were not independently re-audited.

## New TODOs / limitations

- Library-wide “stories available for this place” filtering is not implemented. This
  pilot tests selection **inside three stories** and discovery **from Princeton** first.
- No mass screenshot generation or automatic deploy-hook activation. A shipping plan
  must decide capture/invalidation/retention before multiplying place/topic variants.
  Local generated files are ignored artifacts, not committed publisher data or web assets.
- Six current captures total **183,126 bytes** (~179 KiB), **4.5 seconds** against the
  static preview; the development pass took **8.1 seconds**. These are local pilot
  measurements, not production estimates for a full matrix. Earlier experimental
  capture variants may remain locally but are not referenced by the current cards.
- JavaScript is needed to select a place on the static story route. Without it, the
  statewide story and source links remain available; no pretend selected view is shown.
- Existing generic home/library covers were not regenerated by this pilot. Only the
  six place-specific images were captured. No homepage/menu/library redesign.
- No reader study, physical-device/assistive-technology test or full report-print audit.
  No full publication, hosting/account change, remote push, PR or deployment.

## Verification

- `npm test -- --reporter=dot`: **811 tests in 135 files passed**.
- `npm run typecheck`: passed; `npm run publication:test`: five tests passed.
- Scoped Next production build: place-page dynamic route, compare, the three pilot
  stories and search/state JSON. Passed, generating 1,191 routes; not a full `make publish`.
- `node scripts/capture-place-stories.mjs`: six actual selected charts captured in
  light/dark. `SITE_URL=http://localhost:3006` rerun passed with matching identities.
- `node scripts/check-place-stories.mjs`: four viewport/theme combinations, each
  testing all three card/story pairs, at 390/1440px light/dark. Images decode; headline,
  snapshot, selected id, exact URL and return context agree. Retained site records,
  no duplicated trends, no horizontal overflow and scoped axe pass.
- The same browser checks passed against the production static preview. Additional
  checks cover Hoboken selection, county/ZIP identity, back/reload, invalid/unavailable ids and unchanged
  Hoboken/Mercer County/ZIP 08540 layouts. No page errors in the interaction cases.
- Initial QA caught a shared-history metadata fingerprint mismatch, a low-contrast
  reused chart caption, legacy-anchor labels needing group semantics, waiting on hidden
  lazy images and incorrect axe context setup. Corrected the data normalization,
  scoped caption colour, anchor semantics and test harness, then reran. A final
  county test also needed its caption locator narrowed to the shared selected chart.
- Visual review: desktop light/mobile dark gallery and real selected chart captures.
- Existing portrait regression passed ten responsive/theme cases in development:
  interactive dot plots, historical scrubbing, monthly purchase inputs/reset, comparison
  links and no-script primary charts remain functional.
- `git diff --check`: passed. API and artifact reads only; no warehouse-writing tests.

Local review: `http://localhost:3002/nj/princeton#place-story-gallery`.

## Follow-up: headline-first previews

At the owner's request, reduced screenshot emphasis in the Princeton gallery.
Each card now leads with its topic and a larger headline, followed by the reading
qualifier. A 112 × 70px thumbnail sits beside the source/date at the bottom. The
whole screenshot fits inside the thumbnail without cropping or centering on a
particular chart detail. Removed the repeated “Explore Princeton” line; the topic's
arrow and whole-card link retain the navigation cue. Sources, dates, qualifications,
anchors, selected-story URLs and existing screenshot identities are unchanged.

Files: `PlaceStoryGallery.tsx`, `PlaceStories.module.css`, this handoff.

Verification: TypeScript passed; the two existing story-data and ground/water test
files passed (12 tests). `node scripts/check-place-stories.mjs` passed at 390/1440px
in both themes, including scoped axe, screenshot/headline identity, links,
county/ZIP selection, back/reload and non-pilot regressions. Visually reviewed the
desktop light and mobile dark gallery captures. `git diff --check` passed. No fresh
production build or full test suite was run for this presentation-only follow-up;
the build and full-suite results above belong to the initial pilot commit.
