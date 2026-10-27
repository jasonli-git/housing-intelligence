# Princeton market exhibits → local stories

## What changed

The owner approved extending the local-story gallery to as many market exhibits as
fit, flagging new pages and the material that should remain on the place page.
Continued the local Princeton pilot on `experiment/place-page-hierarchy`; no push,
PR or deployment. This expands the earlier three-topic approval for this task only.

The gallery now contains eight screenshot-backed cards. Five are new:

| Place component | Treatment | Destination / scope |
| --- | --- | --- |
| Prices/paychecks and indexed trends | Already moved; retained | Income and home value; town's same-period survey medians, deeper time series |
| HomeSales: sale distribution, recent prices, assessments/revaluation | Moved | Existing **The price ladder**, now with a selected-place view and the complete HomeSales component |
| IncomePressure: renter/owner burden by HUD income band | Moved; **one new story page** | **Who feels housing costs most?**, `/stories/who-feels-housing-costs`; local selection plus statewide CHAS county sum |
| Buyer financing / MortgageLending | Moved | Existing **The mortgage market**, including the original local loan programmes, applications and limits |
| HomesAdded: permits, completions, demolitions, net, yearly table and coverage | Moved | Existing **Is New Jersey building?**; missing reports and preliminary years remain explicit |
| WhoIsMoving: arrivals/departures, income and destinations | Moved | Existing **Who’s moving in**; Princeton selection carries **Mercer County** context, never Princeton-level moves |
| Getting around | Already moved; retained | Existing commute story and selected-place work/transit/destination component |
| Water systems | Already moved; retained | Existing water story and selected-place water-only component |

Removed Princeton's now-duplicated market exhibits and the entire **More market
evidence** disclosure. Removed the redundant Market exhibits navigator entry; Local
stories occupies that part of the sequence. Existing `#field-notes`, trend, sales,
loan, building, burden, migration and water anchors lead to their previews. In
particular, property-tax and buyer's-guide links to `#sales-heading` still reach sales.
Other town/county/ZIP place pages keep their existing exhibits.

### What stays, and why

- **Market opening/interactive portrait and prices/rent:** the place's primary answer
  and its nearby comparisons should be immediately usable without leaving the page.
- **Cost comparison and household controls:** practical tools tied to the visitor's
  assumptions; keep their live interaction on the place page.
- **Local interpretation, computed highlights and ranked measures:** the short synthesis
  and orientation for the place, distinct from choosing a deeper topical story.
- **Living-there checks:** contaminated sites, flood, services and community remain in
  their existing group. They are outside this market-only expansion. The direct water
  supplier-record link remains visible alongside the gallery.
- **“How unusual?”:** not rendered for Princeton because its historical series is
  county/state-level. No town history was invented. Existing county exhibits remain
  unchanged. The existing `/stories/is-today-unusual` could take a county selection in
  a future county rollout; it does not need a new story page.

## Files/modules affected

- Place route: builds eight shared records and conditionally removes Princeton's market
  block, leaving the rest of the place-page hierarchy and other places intact.
- `lib/placeStories.ts`, `lib/placeStoryData.ts`: new topics, shared history keys,
  selected-record extras and server-side Princeton preloads.
- `lib/marketPlaceStories.ts` / tests: five summaries and concise interpretation notes.
- `PlaceStoryFocus.tsx`: reads the existing pressure/migration/metrics artifacts for
  other selections and mounts the original detailed components for the five topics.
- `PlaceStoryGallery.tsx`, `PlaceStories.module.css`: new cards, legacy anchor targets,
  existing accent treatment extended, self-referential story links hidden in focus.
- Four existing story routes gain local focus; price ladder adopts the existing
  StoryShell while retaining its statewide interactive comparison and notes.
- New `app/stories/who-feels-housing-costs/page.tsx`; `lib/stories.ts` and
  `lib/storyLibrary.ts` register it in What your money buys and library search.
- `IncomePressure.tsx`: optional id prefix for the statewide instance so local and
  statewide controls/headings do not produce duplicate IDs. Default remains unchanged.
- Existing capture and browser scripts cover all eight topics, the new library cover
  and the moved controls/anchors.

## Architectural or implementation decisions

- Reuse existing story URLs and details; only housing-cost burden needs a new route.
  No per-place HTML story matrix, API/schema change or data ingestion.
- Query selection remains `?place=<id>`. No query means no implicit Princeton selection.
  Other places use published JSON and explicitly show limited/missing coverage.
- Sales pair the sale count and quartiles only within the median's exact period.
  Sale medians describe usable one- to four-family transactions, not all homes or
  current asking prices. Different-period quartiles are omitted.
- Financing bars use one reporting period. Historical and tract-estimated qualifications
  are visible; observed loan statistics do not predict approval or current offers.
- Building preview uses the newest reporting year and completions less demolitions.
  If either report is missing, it does not fill with zero or silently fall back to a
  fuller older year. Preliminary status is visible on card and story.
- Pressure uses published CHAS shares and uncertainty. Uncomputed households stay in
  the denominator. Income bands are HUD area family-income bands, not eligibility
  limits or the town's median household income. Both tenures and all supporting
  definitions remain in the detailed component.
- Migration checks the requested record identity, retains the county name in the
  headline and labels county context on the card and selected chart. Tax returns are
  distinguished from people and exact household counts.
- Shared records, summaries and fingerprinted filenames continue to bind preview and
  destination. Adding geoid to those records changes the earlier fingerprints; all
  sixteen selected-view images were regenerated locally in both themes. The new
  story's default statewide library cover was also captured in both themes.

## Assumptions

- “In the same way” continues the screenshot-backed design and Princeton-only rollout.
  It does not authorize replacing exhibits across all place/state pages.
- Existing statewide story methods remain intact; they are broader context below the
  selected-place view. This task did not independently re-audit those methods.
- The prior local-only restriction remains: save local commits, no remote actions.

## New TODOs / limitations

- County and other-place story selection works, but automatic gallery migration remains
  limited to Princeton. County-specific history needs a deliberate future mapping.
- Eight stacked cards take more mobile scrolling than three. This is the direct
  expansion requested; no additional hidden carousel/disclosure was introduced.
- Screenshot pipeline rollout, retention and all-place generation remain unactivated.
  Generated images are ignored local artifacts. Sixteen active selected images total
  **524,851 bytes**, captured in **20.3 seconds** locally; this excludes the byte count
  of the two generic new-story library covers. Old ignored variants may remain locally.
- No full `make publish`, deployment, new data, hosting/account changes, reader study,
  physical-device/screen-reader audit or full print audit.

## Verification

- `npm run typecheck`: passed.
- `npm test -- --reporter=dot`: **817 tests in 136 files passed**.
- `npm run publication:test`: **5 tests passed**.
- New summary tests cover sale-period mismatch, historical/tract loan semantics,
  real zero versus missing, preliminary and incomplete construction, CHAS denominator
  and uncertainty, wrong-geography refusal and county-only migration wording.
- Scoped Next production build: place pages, story library, all eight selected story
  routes, comparison and search/state JSON. **1,197 routes generated successfully**.
  This is a scoped export, not a full publication build.
- `node scripts/capture-place-stories.mjs`: 16 selected-view captures and 2 default
  new-story library covers generated locally from the existing published records.
- `node scripts/check-place-stories.mjs`: all eight preview/destination pairs at
  390/1440px in light/dark, exact headline and snapshot identity, image decoding,
  return links, new burden and migration interactions, scoped axe, no horizontal
  overflow, retained sites and no duplicated market exhibits.
- Same checks against static preview with `SITE_URL=http://localhost:3006` passed.
- Expanded browser checks also cover each added topic's Mercer County selection,
  no implicit Princeton selection on the new page, library search/cover loading,
  invalid/missing selections, back/reload and unchanged non-pilot places.
- Visual review: full desktop dark and mobile light galleries; source dates,
  preliminary labels and Mercer County wording remain visible.
- `git diff --check`: passed. API/artifact reads only, no warehouse-writing tests.

Local review: `http://localhost:3002/nj/princeton#place-story-gallery`.

## Follow-up: quieter topic labels and historical scope

The owner requested stronger topic/headline hierarchy. The labels were already
10px versus 23–27px headlines; uppercase, tracked, medium-weight monospace made
them disproportionately prominent. Changed them to light sentence-case body type
at 10px, reduced tracking and shrank the topic dot from 6px to 4px without its glow.
Story headlines, screenshots, content and links are unchanged.

Confirmed historical scope directly in `src/hip/analytics/persistence.py` and
`src/hip/api/routers/persistence.py`: the current measure combines annual FHFA
county/state price indices and SAIPE income, reads only county/state regions and
requires at least ten matching years. Town/ZIP records are unsupported. Town
trends already exist, but a town-level equivalent would need a separately reviewed
method; no county history is relabeled as town history in this task.

Verification for this CSS-only follow-up: TypeScript and `git diff --check` passed.
Browser checks at 390/1440px in both themes verify every label is less than half
its headline's font size, sentence case, no horizontal overflow and scoped axe.
No new full-suite or production build run; those results above belong to the
market-story expansion.
