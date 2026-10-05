# Milestone 43 — Accessibility audit

## Local picture bubble-card refinement

Owner requested stronger rounding: the existing local-picture surface now has 32px
corners on desktop and 26px on mobile, with slightly more mobile padding. Green left
accent, content, citations and stale warning unchanged. No overflow clipping added.
Only accessibility CSS changed. TypeScript and `git diff --check` passed; localhost
browser confirmed both radii and no 390px horizontal overflow; desktop screenshot
inspected. Full tests/static export not rerun for this CSS-only radius change.

## Latest owner direction — remove illustration control

Removed the illustration pause/play control and its CSS at the owner's explicit
request. The loop and reduced-motion static alternative remain. This supersedes
the pause-control description below. Updated the browser regression to assert
control absence instead of pause/resume. Limitation: there is no longer an on-page
way to stop the continuous animation; reduced motion alone should not be treated
as proof of WCAG pause/stop/hide conformance.

Verification for removal: TypeScript and 466 tests passed; static export built 2,379
pages (existing artifact-origin warning). Diff whitespace and browser-script syntax
checks passed. Browser interaction suite was updated but not rerun for this removal.

## Latest illustration refinement — continuous motion

At the owner's request, the one-time entrance described below is now a repeating
9-second architectural draw/hold/dissolve cycle. Foundation, walls and windows are
staggered; measurement guides fade in and a soft backdrop gently breathes. No flashing,
JavaScript animation loop or new dependency. A native checkbox styled as a small
pause/play control freezes/resumes all SVG animations, including without JavaScript.
Reduced motion disables all motion and hides the redundant pause control; print hides
it too. Files: landing page, accessibility CSS, browser interaction regression script.

Verification: TypeScript passed; 466 tests/59 files passed; 2,379-page static export
passed (existing local artifact-origin warning). Browser suite confirms infinite
iteration, a visible finished drawing during the second cycle, pause/resume and static
reduced motion, along with existing map/definition/mobile reflow checks. Full reports,
data and canonical documents remain unchanged.

## Owner-requested follow-up — computed moving checks and presentation

- Replaced the consumer `before_moving` answer on region profiles with `HomeChecks`.
  Three deterministic checks cover property tax, purchase price and comparable rent.
  Rules inspect finite packet inputs, prefer Zillow over a transaction median, retain
  the input's period, and explicitly disclose missing data. No numeric calculation,
  local risk inference, model call or regeneration is involved. These are informational
  prompts, not a property assessment. Flood, water, utility and tax tools remain alongside.
- Kept the AI-written local picture, its citations and stale-data warning. Added a
  restrained modern surface, rounded border, soft shadow and green left accent.
- Restored report-action text to the foreground color instead of inheriting the broad
  blue accessibility link override.
- Both maps now accept physical arrow keys while their SVG surface is focused, with
  default scrolling suppressed only for those keys on that surface. Nested controls
  retain their own behavior. Added a visible focus outline and keyboard hint.
- Landing architectural illustration draws once on entry; reduced motion is static.

### Follow-up files and decisions

`web/lib/homeChecks.ts` and its tests, `web/components/HomeChecks.tsx`, region page,
both map components, accessibility styles and the browser interaction check.
Server-rendered rules require no added runtime dependency. No canonical document or
stored model output changed. Full reports and generation prompts still retain their
existing answers; retiring generation of the unused profile answer is a separate
backend/publication-format decision for Claude. The three priorities are deliberately
fixed, not a claim to a personalized or exhaustive checklist.

### Follow-up verification

- `npm run typecheck`: passed.
- `npm test`: 464 tests across 58 files passed, including 3 new rule tests.
- `npm run build`: 2,379 pages exported. Initial sandboxed run could not reach the
  local API; rerun with local-network access passed. Existing artifact-origin warning
  remains; this is a local preview, not a deployment configuration.
- Static-build `check:a11y:interactions`: passed, including physical arrow-key panning
  without page scroll, 12 routes at 320px, open-definition axe checks, and no-JS report.
- Rendered Somerset: three rules checks, no old AI moving section; inspected the local
  picture screenshot. Existing stale-reading warning retained, not silently refreshed.
- `git diff --check`: passed. No backend tests rerun; no backend code changed.
- Full 80-scan matrix not rerun for this follow-up; real device/assistive-technology
  and manual visual/motion checks remain subject to the original audit limitations.

## What changed

### Additional owner-requested visual follow-up

- Local profile United States breadcrumbs now use the neutral foreground (white in
  dark mode), without changing NJ's state accent or national landing colors.
- Removed the rules tagline from moving checks. The tax check links to the existing
  lookup, with `town` preselected for municipalities; counties/ZIPs use general lookup.
- Increased landing illustration visibility; split its architecture into staged
  foundation, roof/walls, windows and measurement guides with a soft circular backdrop.
  Motion plays once and is disabled under reduced motion. Mobile places a compact
  illustration above the title rather than overlaying its text.
- TypeScript and 466 tests/59 files passed; 2,379-page static export passed. Browser
  checks confirmed county/municipal lookup destinations, neutral dark breadcrumb,
  reduced-motion static drawing and no 390px landing overflow. Desktop/mobile
  screenshots inspected; mobile title overlap found and corrected in final CSS.
  Existing local artifact-origin build warning remains. `git diff --check` passed.

Branch: `milestone/m43-accessibility-audit`, based on `4710a7b` (main, PR #94).
Authorized by the owner as the next official milestone. This is an engineering
audit and remediation pass, **not a WCAG conformance certification**. Human
assistive-technology and device validation remains open below. Claude retains
ownership of canonical milestone reconciliation.

- Added a first-in-tab-order “Skip to content” link, with a focusable destination
  on every page and its unavailable/not-found states.
- Unified ordinary and clipped-surface definitions behind a floating enhancement.
  Definitions remain in static HTML; after hydration they stay within the viewport,
  escape scrolling-table clips, allow the pointer to enter them, and dismiss with
  Escape **without discarding keyboard focus**. Arrow/Page/Home/End keys scroll a
  definition if its content exceeds the viewport. No dictionary wording changed.
- Added four directional buttons to each map as a single-pointer and keyboard
  alternative to dragging. Existing zoom, reset, map selection and tables remain.
- Added previous/next buttons to moving profile banners; stepping pauses motion.
  Added an explicit persistent Pause/Play control to each overflowing ranked-measure
  row, beyond the existing hover/focus pause. Reduced motion still disables autoplay.
- Corrected confirmed text contrast failures in breadcrumbs, secondary labels,
  source links, budget groups, interpretation runtime/citation labels and stale notices.
  The data palette and calculations did not change.
- Increased footnote-link targets; retained at least 24px targets on horizontally
  scrollable SVG rank marks. Made table/chart scroll areas keyboard reachable.
- Fixed 320px ZIP-page overflow with per-section scrolling values tables, not smaller
  text. Corrected named-container roles, report row-group header semantics, and empty
  “above budget” cells for assistive technology. Source links have a non-color cue.
- Added real React interaction tests and repeatable browser audit commands, plus a
  loopback-only preview for the actual static export.

No readings regenerated, model calls, data acquisition, warehouse mutation,
deployment, or canonical document changes. No new data sources or quantitative
methodology changes.

## Files/modules affected

- `web/app/layout.tsx`, page route components, `web/app/accessibility.css`: skip
  navigation, focus offsets, contrast and target fixes.
- `FloatingDefinition`, `FloatingMetricTerm`, `Definition`: shared progressive
  definitions; the dictionary remains in existing client modules. Reports remain
  static layouts, without interactive ranked-measure carousels.
- `GlobeMap`, `NationalCoverageMap`, `StateProfileTicker`, `RegionStandOuts`:
  non-drag controls and explicit motion control.
- `PlacePicker`: a reopened list starts on the first result with ArrowDown / last
  with ArrowUp; loading/no-match messages are status text, not invalid listbox children.
- `CurrentValues`, `Ledger`, `IndexedComparison`, report/region/state/history routes,
  `AffordExplorer`, `CountyExplorer`, `TownRanks`, `GroundAndWater`, `HomesAdded`,
  `ExplanationPanel`: labelled, focusable scrolling areas and table semantics.
- `CostToOwn`, `SourceFooter`: named groups now have supported roles.
- `web/components/accessibility.test.tsx`, `web/vitest.config.mts`, browser scripts,
  package manifests: regression coverage and dev-only test dependencies.
- `reports/completeness/2026-10-05.md`: generated standing check.

## Architectural or implementation decisions

1. Automated scanning and human review are separate. The audit retains axe's
   **incomplete / needs-review** results, not just failures. A zero-violation scan
   does not certify contrast on every gradient, every table association, or usability
   with a screen reader.
2. [WCAG 1.4.13](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html)
   drove hover persistence and Escape behavior. `FloatingDefinition` is a small client
   island with server-rendered adjacent fallback text. `Definition` still does not
   import the metric dictionary on the server. React `useId` avoids repeated-label
   ID collisions. The portal exists only while open.
3. [WCAG 2.5.7](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html)
   requires a non-drag single-pointer alternative, not merely a keyboard shortcut.
   Directional/step buttons satisfy both interaction paths while preserving gestures.
4. [WCAG 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
   motivated target fixes. Wide tables/plots stay individually scrollable rather than
   making the whole page scroll sideways or squeezing meaningful figures.
5. Motion controls preserve the reader's explicit pause, while focus/hover and reduced
   motion retain their existing safeguards. Static report standouts stay separate.
6. No full CI workflow was added. Component tests run through existing `npm test`;
   the browser gate requires a running preview. The commands below are ready for
   future CI integration but are not currently a protected-main enforcement mechanism.

## Assumptions

- English is the supported language. The Spanish go/no-go remains separate and
  unscheduled, as ROADMAP specifies; this work does not authorize translation.
- JavaScript is an accessibility-supported enhancement for the interactive site.
  Definition text and CSS hover/focus fallback remain available without JavaScript;
  viewport bounding and Escape enhancement require hydration. A no-script report
  fallback was exercised, not every no-script tooltip/scroll-container combination.
- The static preview uses local artifact links intentionally. Its build warning is
  **not** permission to deploy an export whose Markdown links point to localhost.
- Route sampling covers templates and important data states, not all 2,379 exported
  pages. API/service failures and every possible tax-property result are not exhaustive.

## New TODOs / limitations

### Actionable before calling this a fully validated accessibility milestone

- **Real screen-reader review:** VoiceOver + Safari and NVDA + Firefox/Chrome.
  Verify described-by definitions announce once, search result selection/status,
  budget radio groups, table row/column associations, disclosures and focus order.
  Screen-reader usability was not simulated by DOM tests.
- **Real iPhone:** paused banner swipes, button alternatives, tooltip taps/dismissal,
  map movement, portrait/landscape, larger text. Chromium touch checks cover
  definitions/buttons, not physical iPhone swipe physics; they do not close the
  existing iOS Safari TODO.
- **Browser accessibility settings:** true 200% text resizing, 400% zoom, WCAG text
  spacing overrides, forced colors/high contrast and sticky-header focus visibility.
  320px reflow was tested; it is not a substitute for all of those checks.
- **Safari/Firefox print:** long evidence disclosures, source footers, report
  pagination. The existing print TODO remains; no cross-browser print claim.
- Review the remaining axe needs-review output, particularly chart/gradient text and
  horizontally clipped table headers. Decorative glyphs trigger untestable contrast
  flags too; do not bulk suppress the entire contrast rule. No claim that every
  incomplete node passed manual review.

### Separate, immediately actionable maintenance finding

`npm audit --json` reports one **pre-existing critical Next.js advisory** on 16.3.5:
[GHSA-vcvr-r3jv-pc5j](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j), involving
`next/og ImageResponse`, with a fix available in 16.3.6. This branch did not silently
upgrade the framework. No `next/og` / `ImageResponse` use was found in application
source, and deployment is a static export, but that is not a blanket exploitability
assessment. Take the patch upgrade through an isolated dependency change and rebuild
before expanding server-side image features. The new dev dependencies were not the
reported vulnerable package.

### Related TODO / Director Note disposition

- The interactive frontend harness TODO is materially addressed: actual rendered
  components now cover definition persistence/Escape, keyboard combobox operation,
  no-match/loading states, autoplay/focus/reduced motion, paused ticker steps,
  decorative-copy focus isolation, report isolation and disclosure jumps.
- Paused swipe/device and cross-browser print TODOs remain open as above.
- The Director Note's ordinary-reader/trust direction informed retaining figures,
  uncertainty, provenance, descriptions and static report access—not hiding details
  for appearance. Forecasting, institutional inquiries and new sources are outside
  this accessibility branch. M42's institutional/source gaps are not resolved here;
  its handoff remains the detailed inventory of those gaps.
- Claude should reconcile ROADMAP/TODO/CHANGELOG after review. Do not promote this
  handoff to a certification or silently mark outstanding manual checks complete.

## Verification

Commands run from `web/` unless noted:

- `npm test`: **461 passed in 57 files** (14 new interaction tests).
- `npm run typecheck`: passed.
- `npm run build`: passed; **2,379 static pages**. Existing local artifact-origin
  warning retained. Final export generation took about 26 seconds on this Mac.
- `node --check` for the three new `.mjs` scripts: passed.
- `git diff --check`: passed.
- Initial default-page baseline: 36 scans, 21 with failures, 145 failing node
  instances across repeated layouts; contrast, target size and keyboard scrolling.
- Production preview browser gate: default + all native disclosures expanded,
  1440px/390px, light/dark, 10 routes = **80 scans**. Final counts are recorded in
  the adjacent results JSON: **0 violations, 0 page errors, 0 page overflows**.
  Needs-review output remains: 13,054 contrast node instances and 24 table-header
  instances across repeated layouts. Unsupported-container labels and the source-link
  flags were cleared by remediation; the remaining table flags concern clipped
  headers, whose actual period/source cells exist in the rendered tables. These are
  not claimed as manual screen-reader passes. The interaction command additionally covers 320px,
  transaction-price and suppressed-price towns, a county-scoped budget, keyboard
  search/navigation, map buttons, theme switching, table/profile definition bounds,
  Escape/focus, unique IDs, and the report definition fallback without JavaScript.
- Root: `PYTHONPATH=src .venv/bin/hip completeness` and `... completeness --write`
  succeeded. Snapshot: 137 metrics; 113 reach municipalities, 74 at least 95% coverage;
  34 sources (17 current, 16 not tracked, 1 unreachable); 11/17 fixed questions answered.
  This is a usability/accessibility change, not new measured data coverage.
- `npm audit --json`: **failed**, one existing critical Next.js advisory as above.
- Backend tests/lint/mypy not rerun: no backend/config/schema changes. No real
  VoiceOver/NVDA, iPhone, Safari/Firefox print, forced-colors or full text-spacing pass.

### Repeat the browser checks

Build while the local API is available, then start the static preview in one terminal:

```sh
cd web
npm run build
npm run check:a11y:serve
```

In another terminal, also under `web/`:

```sh
A11Y_ORIGIN=http://localhost:3002 npm run check:a11y
A11Y_ORIGIN=http://localhost:3002 npm run check:a11y:interactions
```

The audit defaults to `/tmp/hip-accessibility.json`; `A11Y_OUTPUT` changes its destination.
`A11Y_PATHS`, `A11Y_WIDTHS` and `A11Y_THEMES` support targeted diagnosis. Both commands
exit nonzero on detected failures; needs-review findings remain in the JSON for human
triage. Chromium must be installed (`npx playwright install chromium` if absent).
The preview binds only to `127.0.0.1`, not the LAN. Three direct dev dependencies were
added: axe's Playwright integration, React Testing Library and jsdom. No new production
dependency, paid service, model usage or scheduled pipeline was added.
