# Visual stories library

## What changed

Experimental frontend pass on `experiment/stories-library`, approved by the user.
The `/stories` index is now a curated library rather than a uniform wall of graphs:

- Compact featured story: **Twin towns, different price tags**.
- **Editor’s picks** plus five horizontal topic rails: **Only in New Jersey**,
  **What your money buys**, **The feel of a place**, **Places in motion**, and
  **Look beneath the surface**.
- Each story belongs to exactly one primary collection; editorial picks repeat a
  small selection deliberately. All 37 current stories remain discoverable.
- Landscape covers use cropped details from the existing, actual chart captures,
  with collection accents, rather than fabricated quantitative illustrations.
  The covers have no overlaid caption. These are art-directed existing
  captures, not newly commissioned poster artwork or new live chart components.
- Discover / All stories switch, collection-specific “View all,” title/description
  search, topic filter, result count and recoverable empty state.
- Touch scrolling, previous/next controls with edge detection, keyboard arrows and
  Home/End between links, visible next-card peeks and reduced-motion support.
- No autoplay, auto-scrolling, hover-triggered navigation or popularity claims.

The homepage component/preview-card design and every individual story page remain
unchanged. The screenshot utility needed a compatibility change because it selected
the old index grid: it now discovers unique story links across the rails and opens
the All stories grid when generating the existing homepage montage. Thus the same
image filenames/output contract remain supported; its next generated image will
naturally reflect the new card styling, not a separate homepage redesign.

## Files/modules affected

- `web/lib/storyLibrary.ts`: collection metadata, editorial selection, slug lookup,
  primary-topic resolution and search. Original `STORIES` registry unchanged.
- `web/components/StoryLibrary.tsx`: library, covers, rail controls and directory.
- `web/app/stories/page.tsx`, `web/app/stories/library.css`: index integration and
  scoped styling; individual story CSS/layouts unchanged.
- `web/lib/storyLibrary.test.ts`, `web/components/StoryLibrary.test.tsx`: eight new
  tests for complete/non-overlapping collections, valid editorial links, filters,
  search/empty recovery, view switching and keyboard navigation.
- `web/scripts/check-story-library.mjs`: responsive browser/axe checks, including
  screenshot-discovery and montage-grid selectors.
- `web/scripts/capture-readme.mjs`: new library selectors and deduplicated discovery.
- `DIRECTOR_NOTES.md`: appended the user-approved library direction, following the
  Director Note skill. No canonical project documentation was edited.

## Architectural or implementation decisions

- Retain a server-rendered page shell and add one client entry point for browsing.
  Read the installed Next.js 16.3.5 documentation for `use client`, server/client
  composition, and the CLI’s route-scoped debug build before implementation/build.
- No new data fetching, metrics, dependencies, backend changes or API contracts.
  Covers reuse `ThemedShot` and its existing light/dark image contract.
- Explicit `prefetch={false}` on story cards prevents a catalogue of rails from
  eagerly prefetching many complete interactive stories.
- All stories are present in the initial rail markup, including without JavaScript;
  the interactive directory is an additional discovery path, not the only path.
- Existing theme tokens supply every new colour. No one-off palette/baseline update.
- Rails intentionally share sizing/type/controls. Their cover accents vary by topic;
  the individual stories retain their existing distinct chart styles.

## Assumptions

- This pass refines the index first, not each individual story or the homepage card.
- New Jersey is the current catalogue’s scope. “Only in New Jersey” is an identity
  collection, not a misleading state filter that would currently include everything.
- Editor’s picks are qualitative curation, not measured engagement or an objective
  ranking. They are labelled as editorial picks, not popularity rankings. The featured
  story and picks can be changed in metadata.
- Future stories need primary collection assignment; the coverage test fails if a
  registry entry is omitted, assigned twice, or references a missing story.

## New TODOs / limitations

- Homepage preview redesign is deferred, as approved. Individual story-page refinement
  is also separate work.
- Covers still derive from screenshots: some fine labels are intentionally too small
  to read as thumbnails. They are navigation previews, not readable chart substitutes;
  readers open the unchanged story for full axes, caveats and sources.
- Full screenshot generation across all 37 individual story routes was not run in
  this pass. The new discovery selector, complete unique link set and directory-grid
  capture target were verified in Chromium against the production-mode index.
- No physical-device, Safari/iOS, Android or production performance validation.
- No full `make publish`/site-wide static build, ingestion or deployment. A scoped
  Next production export was verified; `web/out` is consequently a **debug subset**
  (`/stories` and framework not-found), not a deployable full-site export. Run the
  normal full publication workflow before any eventual deployment.

## Verification

- `npm test -- --reporter=dot`: **742 tests passed across 123 files**, including the
  eight new library tests and the existing colour-token guards.
- `npm run typecheck`: **passed**.
- `npm run publication:test`: **five tests passed**.
- Route-scoped production build:
  `NEXT_PUBLIC_API_URL=http://localhost:8094 NEXT_PUBLIC_ARTIFACT_URL=http://localhost:8093 npx next build --debug-build-paths=app/stories/page.tsx`:
  **passed**, compiled and statically prerendered `/stories`. Entire-project Next
  TypeScript checking also passed. The preview endpoints read existing published
  JSON/images only; no warehouse/data rebuild was needed for this build.
- `node scripts/check-story-library.mjs` against the development preview and
  `SITE_URL=http://localhost:8095 node scripts/check-story-library.mjs` against the
  generated static export: **passed at 1440, 768 and 390px, light and dark**.
  Checked six rails; scrolling controls; keyboard focus movement; complete directory;
  search, empty recovery and topic-specific View all; directory focus/placement;
  page overflow; no page errors; unique screenshot discovery of all 37 stories;
  capturable montage grid. Axe reported **zero main-content violations** in curated
  and directory modes for all six viewport/theme combinations.
- Reviewed full-page desktop-dark and mobile-light screenshots. Captures are at
  `/private/tmp/stories-library-{width}-{theme}.png`; not committed.
- `node --check scripts/capture-readme.mjs` and
  `node --check scripts/check-story-library.mjs`: **passed**.
- `git diff --check`: **passed**.

### Preview environment

The local API was initially absent; the first browser attempt correctly failed on
the shared header’s `/sources` dependency. Verification then used the existing
artifact snapshot through a temporary read-only JSON endpoint, not invented API
responses. An initial axe-runner error was corrected by using an explicit Playwright
browser context; final audits above supersede those preliminary attempts.

For convenient review the existing read-only API was subsequently started on 8000,
and the development frontend on **http://localhost:3002/stories** restored to that
normal API connection. Existing chart images are served locally on 8093. The API has
no startup ingestion/load behavior; no warehouse writes were performed. Preview
processes are local and are not deploys.

## Review follow-up: concise library copy — 2026-10-23

At the user's request, removed the tagline below “Visual stories” and tightened the
visible copy throughout the library:

- All 37 cards now have short, library-specific previews (under 90 characters each),
  rather than repeating the longer source-registry descriptions. Individual stories
  and original descriptions remain unchanged.
- Removed all rail subtitles and the closing slogan; titles already identify each
  collection. Shortened the feature label/CTA, scope and repeated cover caption.
- Removed the search placeholder while retaining its visible label; shortened the
  empty-state message and final directory link.
- Search includes the short preview as well as the title and full original blurb,
  so both new visible vocabulary and existing detailed terms remain discoverable.
- Added a test checking complete preview coverage and length against the originals.

Verification after the text pass: **743 tests passed (123 files)**; TypeScript passed;
the route-scoped `/stories` production build passed against the normal read-only local
API; browser/axe checks passed at 1440/768/390px in both themes. `git diff --check`
passed. The build remains a debug subset, not a full deployable export. No deploy.

## Review follow-up: header search/theme overlap — 2026-10-23

- Reproduced at 1440px: the search wrapper was 160px wide, but its grid's intrinsic
  input track was about 200px. The input extended beneath the adjacent theme button
  even though the page itself did not overflow horizontally.
- Shared `site-chrome.css` now uses a `minmax(0, 1fr)` search track and a shrinkable,
  border-box input constrained to its wrapper. This fixes the underlying header
  geometry, not just the stories page, without clipping results or changing controls.
- Extended `check-story-library.mjs` to verify input containment, separation from the
  theme button, button-center hit testing and viewport containment at 320, 390, 600,
  768, 1024, 1240, 1241, 1280, 1440 and 1920px in both themes. All passed, as did
  the existing six responsive library/axe combinations.
- Frontend tests: **743 passed**; TypeScript and the stories-scoped production build
  passed. `git diff --check` passed. No deployment or background colour change.

Background explanation for the user: `/stories` inherits the existing Horizon theme,
not a dedicated new library palette. The page base is warm ivory `#f7f2ea` in light
mode and warm near-black `#0b0a09` in dark mode. A fixed, blurred rust/violet/amber
radial-gradient layer, opacity .42, drifts on a 26-second alternating animation;
reduced-motion disables that movement. The library's surfaces use existing neutral
surface tokens, which can appear slightly cooler than the warm page base.

## Review follow-up: readable desktop search prompt — 2026-10-23

The prior containment fix exposed the existing 160px desktop allocation: the input
no longer overlapped the theme toggle, but the prompt was too wide for that space.
At the user's request, increased the desktop search to a fixed 14rem (224px), moving
the tool links 64px left at 1440px while preserving their order and the theme gap.
The existing Tools disclosure now takes over at 1420px and below, rather than 1240px,
so narrower desktop layouts cannot squeeze the full links and readable field together.
No labels or font sizes were reduced to hide the problem.

The browser check now covers 12 widths in both themes, including 1420/1421px. It
measures desktop placeholder text against the usable input width and checks that
tools do not overlap the brand, in addition to the earlier containment/hit-area
checks. All passed, as did the six library/axe combinations, 743 frontend tests,
TypeScript, the stories-scoped production build and `git diff --check`. No deploy.

## Review follow-up: remove cover captions — 2026-10-23

Removed “Chart detail” from all covers, including the feature and directory. Removed
the unused caption styles/screenshot selector and its reserved top space, so chart
images fill their covers rather than leaving an empty label strip. Added a regression
assertion that the caption is absent. Full story pages remain unchanged.

Verification: 743 frontend tests, TypeScript, the stories-scoped production build and
`git diff --check` passed. No deployment.

## Review follow-up: neutral backgrounds — 2026-10-23

Removed the coloured Horizon glow from the stories library and switched its page
base/header paper to the existing neutral surface token: off-white in light mode,
charcoal in dark mode. Removed the decorative coloured wash over cover images too.
Actual chart colours and the thin topic accents remain. Overrides are scoped to
`body:has(.story-library)`; individual stories and other Horizon pages are unchanged.
This supersedes the earlier description of the library's warm animated background.

Added a browser assertion that the body's computed background matches the neutral
surface and its glow pseudo-element is absent in both themes. Verification: 743 tests,
TypeScript, scoped production build, responsive/axe checks and `git diff --check`
passed. No deployment.

## Review follow-up: restore the previous design — 2026-10-23

The user rejected the cinematic overhaul and asked to return to the preceding
design. Reverted only `fb7b16a`; all web files now match `9f5ba9e` exactly. Restored
the split-panel feature, original rail/card treatment and typography. The prior
concise copy, removed tagline/captions, neutral background and header search fixes
are retained. Removed the overhaul-only feature selectors and boundary-check helper.
The rejected experiment remains recoverable in Git history, not active code.

Verification after restoration: 743 frontend tests passed, TypeScript passed, the
stories-scoped production build passed, and responsive/axe checks passed in both
themes. `git diff 9f5ba9e -- web` is empty; staged/unstaged whitespace checks passed.
No merge or deployment.

## Homepage follow-up: curated sampler — 2026-10-23

### What changed

Replaced the homepage's screenshot of the full stories catalogue with three direct
previews, in the approved order: The Wawa line, Twin towns, different price tags,
and The flood claims calendar. A separate “Browse all 37” link uses the actual
catalogue count. “New Jersey” identifies the scope without an additional tagline.
Placement remains after the national backdrop and before Tools.

Desktop/tablet show three cards in one row; mobile uses native horizontal scrolling
with the next card peeking into view. There are no carousel buttons, autoplay or
rotation. Actual chart captures, concise teasers and the accepted library card
styling are reused. The rejected cinematic design is not reintroduced.

### Files/modules affected

- `web/components/HomeStories.tsx` and its regression test: static homepage sampler.
- `web/components/StoryCard.tsx` and `web/app/stories/story-cards.css`: extracted shared
  card/cover presentation, also consumed by `StoryLibrary.tsx` and the stories index.
- `web/app/page.tsx`, `web/app/home-refresh.css`: replace montage and scope layout.
- `web/scripts/check-home-stories.mjs`: responsive, keyboard, image, navigation and
  section-scoped automated accessibility checks.
- `DIRECTOR_NOTES.md`: append the approved homepage direction.

### Architectural or implementation decisions

The sampler is server-renderable and adds no carousel state, timer or API request.
The library retains its client-side rail/search interactions. Shared CSS has no
page-background selectors, so the homepage does not inherit the library's neutral
background override. Header/navigation/status, national figures, Tools, publisher
notices and individual stories are unchanged. No canonical project docs edited.

### Assumptions / new TODOs and limitations

Selection is editorial, not popularity-based. Existing themed screenshot artifacts
remain the cover source; their generation pipeline is unchanged. Browser verification
is local Chromium, not physical-device, Safari/iOS, Android or deployed validation.
The scoped export contains only the tested page subset, not a complete deployable
site; no full data publication, deployment or merge was performed.

### Verification

- `npm test -- --reporter=dot`: 744 tests across 124 files passed.
- `npm run typecheck`: passed.
- `npm run publication:test`: all 5 tests passed.
- `NEXT_PUBLIC_ARTIFACT_URL=http://localhost:8093 npx next build
  --debug-build-paths=app/page.tsx,app/stories/page.tsx`: both pages compiled and
  statically exported successfully; full-project TypeScript check passed.
- `node scripts/check-home-stories.mjs`: passed at 1440, 768 and 390px in light/dark;
  three correct direct links, placement, no document overflow, mobile keyboard
  scrolling, both image variants, navigation, no page errors and sampler-scoped axe.
  Inspected desktop/light and mobile/dark section screenshots.
- `SITE_URL=http://localhost:3002 node scripts/check-story-library.mjs`: passed;
  header checks at 12 widths in both themes, plus library rails/search/directory,
  keyboard, overflow and axe at 1440, 768 and 390px in both themes.
- Browser test development initially exposed whitespace formatting in `innerText`
  and hidden lazy images not loading during verification. Normalized whitespace
  and explicitly loaded both variants in the test; no production workaround needed.
- `git diff --check`: passed.
