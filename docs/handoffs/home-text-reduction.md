# Homepage text reduction

## Review follow-up: re-emphasise metric graphs — 2026-10-24

Bring back stronger graph visibility while retaining the quieter card surfaces and
narrower 440px pair. Increase background chart opacity from .28 to .6 and stroke
width from .9 to 1.5. Do not restore the card/chart glow or change numbers, sources,
card geometry, real-data paths, history disclosures or print behavior. Update the
browser assertion for the stronger, still non-glowing linework.

Files: `web/app/home-tool-previews.css`, `web/scripts/check-home-tool-previews.mjs`.
No data changes, deployment or merge.

Verification: TypeScript, affected-route production build and whitespace checks passed.
Local Chromium metric/tool checks passed at 1440/768/390/320px in light/dark, including
line emphasis, unchanged card dimensions, sources, history-path equality, scoped axe,
keyboard/touch, destinations and print suppression. Inspected desktop light and mobile
dark captures. Unit suite not rerun for this line-style-only change; no full-site
publication or physical-device testing.

## Review follow-up: narrower metric cards — 2026-10-24

Reduce the metric pair's maximum width from 520px to 440px. With the unchanged 12px
gap, each desktop card is now 214px rather than 254px (about 16% narrower). Preserve
fonts, padding, heights, source dates, real graphs and muted treatment. Small screens
remain fluid within the existing page gutters rather than squeezing their text further.
Update the browser maximum-width guard. Files: `web/app/home-tool-previews.css` and
`web/scripts/check-home-tool-previews.mjs`. No data, navigation or other section changes.

Verification: TypeScript, affected-route production build and whitespace checks passed.
Local Chromium metric/tool regression passed at 1440/768/390/320px in both themes,
including narrowed width, unchanged 161px/159px heights, intact publisher names, source/
graph clearance, history path equality, scoped axe, keyboard/touch, tool destinations
and print behavior. Inspected desktop light capture. Unit suite not rerun for this
width-only adjustment. No full-site publication, physical-device testing, deploy or merge.

## Review follow-up: mute whole metric cards — 2026-10-24

User clarified that “mute” meant reducing overall prominence, not only desaturating
the blue/amber. Keep the existing neutral-mixed accents, dimensions, shape and data,
but reduce visual weight across the card:

- Outline/top-band colour contribution: 65% accent to 35%; retain the requested 12px
  top thickness and square-top / rounded-bottom shape.
- Background light pool: 20% accent to 8%; reduce the glass wash to 35% strength.
- Remove the card halo/inset glow and the chart-line glow.
- Background line opacity: .5 to .28; stroke width 1.25 to .9.
- Values: 44px/500 to 40px/400, keeping the 36px line box so card heights do not change.

Labels and source/date contrast stay unchanged. Do not lower the entire section's
opacity, which would also impair essential text. Full histories, plotted values,
missing-data gaps and provenance remain unchanged. The two metric colours still
identify their series rather than implying positive/negative movement.

Files: `web/app/home-tool-previews.css` and `web/scripts/check-home-tool-previews.mjs`.
Browser guards now check the lighter type weight, no card/chart glow and quieter graph
opacity, while retaining the existing dimension, shape, source and history checks.

Verification: 751 frontend tests, TypeScript, affected-route production build and
whitespace checks passed. Local Chromium checks passed at 1440/768/390/320px in both
themes, including muted styling, exact 161px/159px card heights, readable source/graph
separation, full-history path equality, scoped axe, keyboard/touch, tool destinations
and print behavior. Inspected desktop light and mobile dark captures. No data changes,
full-site publication, physical-device testing, deployment or merge.

## Review follow-up: slightly muted metric palette — 2026-10-24

Soften each metric accent by mixing 75% of its existing blue/amber token with 25% of
the theme's neutral secondary text colour in Oklab. Scope this to the two homepage
cards, not the shared story palette. Values, top/side borders, background lines and
light pools all inherit the quieter accent. Preserve the blue-versus-amber distinction,
contrast, sources, dimensions, fonts, geometry and interactions. No opacity reduction
on text and no changes to other homepage sections.

File: `web/app/home-tool-previews.css`. No data changes, deployment or merge.

Verification: 751 frontend tests, TypeScript, affected-route production build and
whitespace checks passed. The local metric/tool browser regression passed at
1440/768/390/320px in both themes, including scoped axe contrast checks, matching
metric colours, unchanged dimensions, graph/source clearance, full histories,
keyboard/touch, tool destinations and print suppression. Inspected desktop light and
mobile dark captures. No full-site publication or physical-device testing.

## Review follow-up: larger stories title and tighter section rhythm — 2026-10-24

Remove “Explore collection” and its arrow from the Visual stories gateway. Keep the
whole card as one accessible link, including its artwork; keep the real story count
and NJ scope. Enlarge the serif title from a 46px desktop maximum to 54px, and from
34px to 40px mobile. Interpret “justify center but keep aligned left” as vertical
centring of the copy group on desktop, with unchanged left alignment. On mobile,
centre the copy within its upper 142px region so it does not collide with the artwork
below. Card heights stay 220px desktop / 300px mobile.

Reduce the metric section's top margin from 48px to 16px and remove its 11.2px top/
bottom padding. Reduce the stories section's top margin from 41.6px to 17.6px. Leave
the search/map canvas, search-result stacking, metric cards (161px / 159px), charts,
source text, tools rail and publisher notices unchanged. Remove unused CTA-specific
CSS, including its old hover/reduced-motion rules.

Files: `web/components/HomeStories.tsx`, `web/components/HomeStories.test.tsx`,
`web/app/home-refresh.css`, `web/app/home-tool-previews.css`, and
`web/scripts/check-home-stories.mjs`. Browser guards now check CTA absence, larger
heading size, desktop vertical alignment, compact section gaps and existing link access.

Verification: 751 frontend tests, TypeScript and affected-route production build
passed. Eight local responsive/theme story cases passed at 1440/768/390/320px,
including copy fit, gap/centring checks, artwork click-through, focus, scoped axe,
hover/no-autoplay and reduced motion. Inspected desktop light and mobile dark cards.
Additional metric/search checks are recorded with this follow-up. No data changes,
full-site publication, physical-device testing, deployment or merge.
The same eight story cases and motion checks also passed against the final static
production build. Tool/metric checks passed at all four widths in both themes,
including exact card heights, graph/source clearance, histories, keyboard/touch,
destinations and scoped axe. All fourteen search/map cases passed from 320px to
1920px in light/dark, including result stacking despite the closer metric section.
Whitespace checks passed.

## Review follow-up: coloured values and square card tops — 2026-10-24

Colour the headline numbers with each card's existing metric accent: blue mortgage
rate, amber annual home-price change. Remove the neutral text gradient so the values
use solid, theme-aware accent colours. These identify metrics, not positive/negative
movements. Square only the two top corners; keep both bottom corners at 24px and
the existing 12px top border. No change to card width/height, typography, alignment,
source/date lines, real-data backdrops or history disclosures.

Files: `web/app/home-tool-previews.css` and the card browser regression. Update guards
to check all four radii explicitly and that each number resolves to its metric accent
with no background-image treatment. No data, navigation or other section changes.

Verification: 751 frontend tests, TypeScript, affected-route production build and
whitespace checks passed. Local Chromium regression passed at 1440/768/390/320px in
light/dark, checking colours, corners, unchanged heights, source/graph clearance,
matching history paths, scoped axe, keyboard/touch, six tool destinations and print
suppression of the decorative backdrops. Inspected desktop light/dark captures.
No full-site publication, physical-device testing, deployment or merge.

## Review follow-up: compact horizon metric cards — 2026-10-24

Restore the older horizon aesthetic without increasing card dimensions. Keep the
centred serif labels, 24px corners, 12px coloured top edges and blue/amber identities;
use larger 44px sans-serif values with tight spacing and a subtle vertical fade.
Their line box remains 36px, preserving existing card heights and source/date placement.

Add real background sparklines using the exact `trendGeometry` path behind each full
history chart. `NationalTrendBackdrop` is a static server-rendered SVG: no new request,
dependency or animation. It preserves missing-data gaps and renders nothing when there
is insufficient comparable history. The full histories retain labels, dates, ranges,
definitions and independent-scale/not-a-forecast caveats in the existing disclosure.
The redundant miniature is `aria-hidden`, non-focusable, and ignores pointer events.
It is absolutely positioned/clipped within the card and hidden when printing. Sources
and dates are above the artwork and the actual linework stays clear of their text.

Files: `web/app/page.tsx`, `web/components/NationalTrend.tsx`,
`web/components/NationalTrend.test.tsx`, `web/app/home-tool-previews.css`, and
`web/scripts/check-home-tool-previews.mjs`. No change to series selection, calculations,
coverage, text, fetches, other homepage sections or existing full-history geometry.

Two added unit tests check exact/gap-preserving path reuse and absent-history omission.
Browser guards check identical backdrop/history paths, original card heights (161px
desktop, 159px mobile), non-interactive background positioning and clear source text.

Verification: 751 frontend tests across 126 files, TypeScript, final affected-route
production build and whitespace checks passed. Local tool/metrics regression passed
at 1440/768/390/320px in both themes, including all six tool destinations, keyboard,
touch, history and scoped axe. Additional static-production checks at those same eight
width/theme combinations passed: unchanged heights, source/graph clearance, matching
full-history paths, zero metric-region axe violations and hidden backdrops in print.
Inspected desktop light and mobile dark captures. No full-site publication, physical-
device testing, deployment, merge or data changes.

## Review follow-up: original search wording, upright type — 2026-10-24

Restore “State, town, county or ZIP code” in the homepage search and make its
placeholder upright rather than italic. Scope the type change to the homepage;
keep the serif face, accessible label, shared header/404 behavior and search logic.
Remove the now-unused placeholder override prop introduced by the previous follow-up.
Consolidate its unit tests to cover the default header and hero accessible names and
placeholders. Update the browser check for the original wording and computed normal
placeholder font style. Plate caption and tagline removal are unchanged.

Files: `web/components/PlaceSearch.tsx`, `web/components/PlaceSearch.test.tsx`,
`web/components/NationalCoverageMap.tsx`, `web/app/home-tool-previews.css`,
`web/scripts/check-search-first.mjs`. No data changes, deployment or merge.

Verification: 749 frontend tests across 126 files and TypeScript passed (one now-
redundant override test was removed when consolidating defaults). Homepage/stories-
scoped production build and whitespace checks passed. Inspected mobile light capture;
placeholder is upright, fully readable and retains its original wording.
All fourteen local search browser cases passed at 320/390/768/1024/1280/1440/1920px in
light/dark, including the computed normal font style, accessible name, suggestions,
map transitions, artwork clearance, reduced motion, scoped axe and no overflow.

## Review follow-up: restore plate caption and simplify search wording — 2026-10-24

Restore the decorative “Plate I · The United States · 39.8° N · 98.6° W” caption exactly
as before, including its existing mobile behavior (coordinates hidden at narrow widths)
and `aria-hidden` treatment. Keep the tagline removed and larger desktop title.
Change the hero-only search placeholder to “Find a place or ZIP code”; the shared
header search wording and full accessible state/town/county/ZIP label are unchanged.
No changes to search matching, destinations, keyboard behavior or coverage.

Files: `web/app/page.tsx`, `web/components/PlaceSearch.tsx`,
`web/components/NationalCoverageMap.tsx`, and the search browser regression, which now
checks the restored caption, new placeholder and accessible name. Pass an optional
placeholder override from the focused homepage map; the 404's existing hero placeholder
and non-focused map uses keep their previous wording.
Earlier text-count measurements describe prior iterations, not this restored caption.

Verification: 750 frontend tests across 126 files, TypeScript, final affected-route
production build and whitespace checks passed. Added three PlaceSearch unit tests for
the unchanged header/default hero wording and the homepage override's full accessible
label. Search browser checks passed at 320/390/768/1024/1280/1440/1920px in both themes,
including caption/placeholder, first-screen search, suggestions, map/title/menu
clearance, transitions/reduced motion and scoped axe. Inspected final desktop light
capture. No full-site publication, physical-device testing, deployment or merge.

## Review follow-up: larger desktop title, no tagline — 2026-10-24

Remove the homepage tagline altogether. Increase desktop heading size from
`clamp(42px, 4.2vw, 64px)` to `clamp(50px, 5.2vw, 72px)`. At 1440/1920px the title
ends about 20px before the US artwork; 1024/1280px have more clearance. Preserve
vertical space in the desktop header for the existing artwork so removing the tagline
does not move it into the navigation/source-check row. Mobile heading size is unchanged.

Update the search regression to require no tagline and to check that desktop artwork
clears the source-check row as well as the heading, search box and viewport edges.
No change to the map caveat in this follow-up: that means the small exploration-mode
note identifying the map as coverage rather than prices, NJ's available housing pages,
and the omission of Alaska/Hawaii. This was explained to the user, not newly hidden.

Files: `web/app/page.tsx`, `web/app/home-tool-previews.css`,
`web/scripts/check-search-first.mjs`. The hero now has eight rendered words instead of
the previous twelve; the original region-specific measurement below is historical.

Verification: 747 frontend tests and TypeScript passed. Final affected-route production
build and whitespace checks passed. Static-production geometry checks passed at
320/390/768/1024/1280/1440/1920px in both themes: no tagline/overflow, and desktop
artwork clears the title, metadata row and search. During iteration, the new metadata
clearance assertion caught insufficient spacing at 1280px; the final 4rem desktop
header bottom padding resolves it. Inspected final desktop light and mobile dark
captures (the scoped export's existing metadata-icon limitation still applies).
No deploy, merge or data changes; source notices and metric cards remain unchanged.
The final development search regression also passed all fourteen width/theme cases,
including search suggestions, map transitions, reduced motion and scoped axe.

## What changed

- Created `experiment/home-text-reduction` from clean `main` at `7580ed8` after approval.
- Removed the decorative Plate I / United States / coordinates line.
- Shortened the hero to “Housing data. Clear sources.” Kept the free/no-fees/no-ads
  reassurance, but made it static: its former disclosure only repeated the message.
- Shortened each tool description to five or six words. Kept useful distinctions
  (budget, buying checks, assessments/taxes, comparison, affordable housing, map).
- Replaced six repeated New Jersey badges with one “New Jersey coverage” note at the
  tool-row heading. Each link references it with `aria-describedby`, so coverage is
  still associated with individual links for assistive technology.
- Shortened the homepage's map-mode caveat without removing its distinctions:
  coverage rather than prices, supported housing pages, and omitted Alaska/Hawaii.
  Non-homepage map wording is unchanged.
- Reduced desktop title size to clear the existing right-hand US artwork after the
  browser regression exposed overlap. Kept the serif style and map placement; mobile
  title sizing is unchanged.

## Files/modules affected

- `web/app/page.tsx`: hero copy and static free reassurance.
- `web/components/HomeTools.tsx`: concise descriptions and shared coverage context.
- `web/components/NationalCoverageMap.tsx`: focused-homepage map caveat only.
- `web/app/home-tool-previews.css`: static badge, shared tool heading and desktop title.
- `web/components/HomeTools.test.tsx`: descriptions, shared coverage association,
  absence of per-card state badges and a six-word description ceiling.
- `web/scripts/check-home-tool-previews.mjs`: shared coverage browser assertions.
- `web/scripts/check-search-first.mjs`: shorter hero and static reassurance expectations.
  Accepts `SITE_URL` so the same checks can run against the static build.

## Architectural or implementation decisions

No new client component, fetch, dependency or disclosure. Remove redundant rendered
elements rather than hide more information behind dropdowns. Keep the scale figures,
recent national metric-card treatment, Visual stories gateway, tool screenshots,
navigation, publisher notices and footer unchanged. The shared coverage note is real
visible text, not just a tooltip or screen-reader-only qualification.

## Assumptions

This is a homepage presentation experiment, not an expansion of geographic coverage.
Tool descriptions are invitations, not promises of property-specific results. Existing
tool pages retain their definitions, assumptions and limits.

## New TODOs / limitations

- No canonical documentation changes; this handoff is for later reconciliation.
- Do not infer performance or conversion improvements from this copy reduction.
- The broad historical browser scripts include assumptions from older homepage
  designs; this branch updates and runs the relevant search, tools and stories checks.
- No data ingestion/rebuild, hosting/account changes, full-site publication, deploy or
  merge. Browser checks are local Chromium, not physical iOS/Android or Safari testing.

## Verification

### Text measurement

Measured the same rendered regions with Playwright `innerText`, splitting on whitespace
and including labels/control glyphs consistently before and after:

| Region | Before | After | Reduction |
| --- | --- | --- | --- |
| Hero | 24 words | 12 words | 50% |
| Tools (all six cards and controls) | 84 words | 57 words | 32% |
| Visual stories | 10 words | 10 words | unchanged |

These are region-specific measures, not a claim that the entire page lost 50% of its
words. Publisher notices, hidden definitions and screenshot text are not included.

### Commands and results

- `npm test -- --reporter=dot`: 747 tests across 125 files passed.
- `npm run typecheck`: passed.
- `npm run publication:test`: five tests passed.
- A production build of the homepage, stories, six tools and their local JSON routes
  (`next build --debug-build-paths=...`) passed against existing local data. This is
  an affected-route build, not a full static-site publication.
- `node scripts/check-home-tool-previews.mjs`: responsive light/dark checks passed at
  1440/768/390/320px, including shared coverage, tool links/rail, metrics, histories,
  keyboard/touch, scoped axe and no browser errors.
- `node scripts/check-home-stories.mjs`: eight responsive/theme cases passed, including
  artwork click-through, keyboard focus, no autoplay and reduced motion.
- Initial `node scripts/check-search-first.mjs`: passed through 768px, then exposed a
  desktop title/artwork collision at 1024px. Addressed with the scoped title-size rule;
  final rerun and production checks recorded below.
- Final search-first checks passed in development and against the built static routes
  (`SITE_URL=http://localhost:3006`) at 320/390/768/1024/1280/1440/1920px in both themes.
  Includes first-screen search, suggested-result stacking, unchanged map identity,
  transitions/reduced motion, map caveat, static free reassurance, licence disclosure,
  scoped axe and no page overflow.
- Tool-preview and story-gateway regressions also passed against the final static
  build at 1440/768/390/320px in light/dark. All six tool links/back navigation and
  the story destination still work.
- Visually inspected desktop light, mobile dark and tool-row captures. The selected-
  route build omits the existing metadata `/icon.svg` route, so its static-only header
  icon is absent in these scoped export captures; the dev header loads it normally.
  No icon code or asset was changed. This is not a full-export asset-completeness check.
- `git diff --check`: passed.
