# UI spacing refinements

## What changed

- Moved the global build date from the top schedule indicator into the source-history footer heading. Reduced the footer card's padding and removed its nested link cards.
- Made the Friday source-check link a compact, neutral indicator.
- Arranged region-page shortcuts into two columns on mobile while retaining their current visual treatment.
- Removed the moving-checklist divider and added space above its disclaimer. Removed the top and bottom borders around the cost-context section.
- Added more space between “What’s changing?” and the ranked-measures disclosure.
- Restored a faint green card beneath “Explore the evidence,” preserving the data disclosure, its remembered state, and shortcut behavior.

## Files/modules affected

- `web/components/SiteStatus.tsx`
- `web/components/SourceFooter.tsx`
- `web/components/MoreExpander.tsx`
- `web/app/redesign.css`
- `web/app/atlas-pages.css`

## Architectural or implementation decisions

- The existing build timestamp and relative-age component now render in the shared footer. The schedule remains a link to source freshness.
- A wrapper inside the existing native summary provides the green card while keeping its evidence label above it.
- The two-column shortcut layout applies to region pages at widths up to 700 pixels. A third shortcut naturally starts the next row.

## Assumptions

- These are presentation refinements; data calculations, reading content, and regeneration remain unchanged.
- Source-history links should retain their explanatory text while occupying less vertical space.

## New TODOs / limitations

- The local export uses localhost as its artifact origin; production publication must supply the existing deployment configuration.
- The UI experiment is available locally and in the PR; no deployment was performed.

## Verification

- `cd web && npm test -- --run` — 292 tests passed across 34 files.
- `cd web && npm run typecheck` — passed.
- `cd web && npm run build` — passed; 2,278 static pages generated against the local API.
- `git diff --check` — passed.
- Headless browser checks: Cumberland County at 320, 390, 768, and 1,440 pixels; Absecon municipality at 390 and 768 pixels. No page overflow. At 390 pixels, shortcuts share a row, the moving-checklist disclaimer has a 16-pixel gap, and the data shortcut opens the disclosure. The schedule indicator is about 22 pixels tall.
- Visual inspection of mobile header, cost context, evidence card, and source-history card captures.
- No separate frontend lint script is configured.
