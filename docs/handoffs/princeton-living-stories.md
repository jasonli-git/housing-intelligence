# Princeton living-there stories

## What changed

The owner approved the proposed first pass: flood, contaminated sites, utility
reliability and broadband become local stories, while practical address checks stay
easy to reach. Continued the Princeton-only experiment on
`experiment/place-page-hierarchy`, locally; no push, PR or deployment.

The gallery gains four selected-view screenshot cards (twelve total):

| Topic | Story | Treatment |
| --- | --- | --- |
| Flood exposure and claims | Existing **The flood claims calendar** | Add a place-aware annual/exposure view; keep the statewide daily calendar separate |
| Sites and cleanup | **New** `/stories/sites-and-cleanup` | NJDEP site-status counts, original local detail and map/source routes |
| Power and reliability | **New** `/stories/when-the-power-goes-out` | Utility-wide EIA records, event-basis switch, original suppliers/prices/BPU/energy/source detail |
| Internet availability | **New** `/stories/where-internet-reaches` | Switch between town mapped locations and explicitly labeled published area units |

Princeton's Living there disclosure now contains only schools, public-safety reporting
and health. Removed the moved components there, preserving their old anchor destinations
on the matching preview cards. Added a compact **Check the actual home** route to
`/guide?place=224#guide-checks-heading`, which opens the existing Before an offer
guide section for Princeton. The direct supplier-water-record link remains visible.

Schools, public safety and health were flagged as separate future decisions in the
recommendation; they were not migrated or recast as rankings here. The inline Mercer
County history and prior market/cost/interpretation work remain unchanged.

## Files/modules affected

- Place route: four new records, compact address-check route, conditional removal of
  Princeton's moved living exhibits and updated disclosure description.
- `lib/placeStories.ts`, `placeStoryData.ts`, new `livingPlaceStories.ts`: topic
  definitions, matching geography, shared summaries and selected-record data.
- New `placeFloodStory.ts`: shared existing town/county fallback and partial-year
  rules, used by the original place page, build-time story and browser selections.
- `PlaceStoryFocus.tsx`: reuse original FloodRisk, GroundAndWater (sites scope),
  Utilities and broadband components; read existing published records for other places.
- New `LivingStoryExplorers.tsx`: outage-event-basis and broadband-denominator controls.
- `CommunityContext.tsx`: optional topic selection and broadband heading prefix;
  defaults preserve existing callers. The new story mounts broadband alone.
- `PlaceStoryGallery.tsx`, `PlaceStories.module.css`, `place-overview.module.css`:
  covers, accents, source-link contrast, legacy anchors, controls and checklist strip.
- Three new story routes; flood-calendar route; `stories.ts` and `storyLibrary.ts`:
  new stories appear in Look beneath the surface and library search.
- Capture/browser scripts: twelve place-story pairs and new library covers, controls,
  retained context, old anchors, address-guide navigation and non-pilot regressions.
- New summary, shared flood-loader and explorer-control tests.

## Architectural or implementation decisions

- No new endpoints, schema, ingestion, Fabric access or external data acquisition.
  Use the same static story pages and `?place=` selection model. No implicit Princeton
  selection on a bare story URL, and no place-by-story HTML export matrix.
- Share record normalization and summaries between screenshot, preview headline and
  selected destination. New data lives only on its relevant topic record; old preview
  records and snapshot identities are unchanged.
- Flood uses the original estimated town claims, unplaceable-claims threshold and
  labeled county fallback. The newest year comes from the state dataset, rather than
  incorrectly calling a town's last claim year partial. The existing resolver was
  extracted, not redesigned. Browser reads reject incomplete observation lists.
- FEMA mapped-home shares are not land shares or one property's risk. Digital-map
  coverage limits remain enforced. Annual local claims are not presented as a local
  daily calendar. Current zone, tidal and historical insured-claim concepts stay apart.
- Site-status categories can overlap and are not stacked into a total. Zero records
  is not a clean-property result; no severity or safety score is computed.
- Outage figures stay utility-wide, with company, year and method visible. SAIDI
  minutes, SAIFI frequency and CAIDI restoration times are not exchanged. The event
  switch keeps a fixed scale, preserves missing values and does not sort a ranking.
  Original BPU reports, OPRA context, utility prices and energy qualifications remain.
- Princeton's existing FCC location artifact is available: 6,903 serviceable locations,
  6,825 with fiber offers in the inspected copy. These are not households. The county
  unit-summary view uses a different denominator and explicitly names Mercer County.
  The switch exposes its figures directly, without another disclosure. ZIP selections
  without local records do not inherit a county percentage in the headline.
- The broadband topic strips unused school/crime/health payload arrays before sending
  the record to its story. Those sections remain on the original place page.
- New story default views use the configured primary state's existing records. Source
  links are blue, using the stronger existing state-blue token for contrast; project
  links retain their project/tool accent.

## Assumptions

- Approval covers the recommended first pass, including broadband, and preserves the
  established local-only Princeton pilot. Other place pages keep their exhibits.
- Full school, crime-coverage and modeled-health story directions need a later choice;
  a disclosure still holds those supporting records for now.
- Existing statewide flood-calendar methods and all upstream source methods were not
  independently re-audited. This is a presentation and reuse task, not a data revision.

## New TODOs / limitations

- Twelve stacked previews add mobile length. No hidden carousel or new nested
  expansion was introduced to conceal them; a future gallery layout may be worth testing.
- Full all-place migration and screenshot scheduling/retention remain unactivated.
  Generated images are ignored local artifacts. Captured 24 active selected images
  (798,100 bytes), plus eight generic library covers across the four newly added story
  pages in this branch. The final full local capture run took 46.1 seconds.
- Earlier ignored image variants may remain locally unused. No publisher files or
  downloaded datasets were committed.
- No broad school/safety/health story rollout, new data, full `make publish`, hosting
  changes, account changes, purchases, production deployment or warehouse-writing tests.
- No physical-device, assistive-technology, reader study or full print audit.

## Verification

- TypeScript passed. `npm test -- --reporter=dot`: **833 tests, 140 files passed**.
- `npm run publication:test`: **5 tests passed**.
- New tests cover site-category/date separation and zero values; incomplete flood
  mapping; utility-wide event bases/deduplication/missingness; town locations versus
  county units; impossible/wrong-geography broadband counts; unchanged flood fallback,
  dataset-newest year and ZIP rules; live event/broadband basis switching.
- Scoped Next production build includes affected place/story routes, library, guide,
  compare and search/state JSON: **1,203 routes**. This is not a full publication build.
- Browser regression verifies twelve exact screenshot/headline/data pairs, new controls,
  county context, original inline history, preserved anchors, no duplicate moved sections,
  retained schools/safety/health, address checklist, library covers, other-place selections,
  invalid selections and back/reload in 390/1440px light/dark views.
- QA caught a broadband test's assumption that the existing short area label was
  “Mercer County” rather than “Mercer · county.” The selected unit view was also improved
  to name the county and expose its measurements directly. Navigation checks now wait
  for the guide URL to commit before asserting selected place, and use the actual
  `#guide-checks-heading` rather than a retired slideshow-panel ID.
- Axe found weak source-blue contrast on light surfaces; switched focused/default
  explorer source links to the existing stronger blue and rebuilt. Default statewide
  views receive a separate accessibility audit, alongside selected panels.
- Final development and static browser runs both passed all four viewport/theme
  combinations and the concluding county/ZIP, library, address-guide and non-pilot
  checks. Default statewide bodies for all three new stories also passed twelve
  additional accessibility/overflow/hydration cases (three pages × two widths ×
  two themes). Refreshed the broadband library covers from that final static build.
- Visually reviewed the expanded desktop dark gallery, including all four new cards,
  and the broadband unit view. Long element screenshots can include the existing
  sticky navigation; this is a capture artifact, not new gallery positioning.
- `git diff --check`: passed. No frontend lint script is configured. No backend tests
  or warehouse-writing commands were run; production Python code is unchanged.

Local review: `http://localhost:3002/nj/princeton#place-story-gallery`.
