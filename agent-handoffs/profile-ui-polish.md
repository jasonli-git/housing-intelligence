# Profile UI polish

## What changed

- Compressed the always-visible non-commercial notice into a slimmer line while keeping its native, keyboard-accessible details disclosure and full terms.
- Increased the state and local profile conveyor speed by exactly 5%. Local profile ranks now sit in a separate low-profile chin beneath each metric's value, label, and plain-language context. The rank still names its peer cohort and retains its full screen-reader wording.
- Kept population cards and their text within the page. On narrow county pages, the title clears the corner card; on medium phone widths, the title's first line stays beside it.
- Let long uncertainty-range rankings wrap within the narrow “Where … stands out” cards.
- Grouped the freshness and revision links in one Source history card in the footer, with one dividing rule between the links rather than separate cards.

## Files/modules affected

- `web/components/StateProfileTicker.tsx` — conveyor timing and rank placement.
- `web/components/SourceFooter.tsx` — shared source-history navigation.
- `web/app/redesign.css` — notice, population, profile chin, county title, and footer styles.
- `web/app/globals.css` — standout rank wrapping.

## Architectural or implementation decisions

- Interpreted “chin” as a shallow, full-width bottom band on each ranked profile metric. Statewide metrics have no peer rank, so their banner retains its existing metric layout.
- Used the existing typed rank and `RankText` component; the visual rank adds a small “Rank” label, while the full “Rank N of M counties/municipalities” wording remains available to assistive technology.
- Kept the population estimate, change, and sampling-error text visible. The width and text wrapping were corrected in CSS without changing the underlying data claim.
- Kept both footer destinations outside the Sources disclosure so either remains directly reachable.

## Assumptions

- This work covers the interactive state, county, municipality, and ZIP page shell. The separate printable report layout is unchanged.
- A compact disclosure line is preferable to moving the commercial-use warning into the navigation, where its terms could be less clear or harder to print.

## New TODOs / limitations

- None introduced. The build's existing `NEXT_PUBLIC_ARTIFACT_URL` warning remains: report Markdown links point to localhost when the deployment origin is not configured.

## Verification

- `cd web && npm run typecheck` — passed.
- `cd web && npm test -- --run` — 32 files, 276 tests passed.
- `cd web && CHECK_URL=http://localhost:3000 CHECK_LABEL=ui-fixes node scripts/check-nj-redesign.mjs` — passed; no browser errors or horizontal overflow at 375, 768, or 1440 px. The first run against `127.0.0.1` timed out before assertions because Next dev blocked that origin's hot-reload resource; `localhost`, the configured dev origin, passed.
- Focused headless measurements of the state, Somerset County, and Aberdeen municipality pages at 375, 768, and 1440 px — population text, standout ranks, rank chin, footer card, and page width all fit. The state ticker duration was 40 s versus 42 s before; local duration was 80 s versus 84 s before.
- Thirty county title/card checks across Somerset, Burlington, Gloucester, Cumberland, and Atlantic at 375, 400, 480, 520, 700, and 701 px — passed with no title/card overlap or page overflow.
- `cd web && npm run build` — passed, 2,278 static pages. The first sandboxed attempt could not reach the local API; the authorized run with the API and database available passed.
- `git diff --check` — passed.
- Visually inspected light-mode phone screenshots of the population corner, profile chin, and unified footer card. The existing broad browser check also exercised dark mode.
