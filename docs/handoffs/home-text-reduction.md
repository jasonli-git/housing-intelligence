# Homepage text reduction

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
