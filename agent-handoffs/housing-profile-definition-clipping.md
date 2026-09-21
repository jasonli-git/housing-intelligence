# Housing profile definition clipping

## What changed

- Moved The housing here definitions into the existing page-layer tooltip used by the
  region stand-out shelves.
- Preserved the housing profile's presentation-specific definition wording and omitted
  the extra Why it matters line that belongs to stand-out cards.
- Removed the obsolete in-banner tooltip positioning rule.

## Files/modules affected

- `web/components/FloatingMetricTerm.tsx`
- `web/components/HousingBand.tsx`
- `web/app/globals.css`

## Architectural or implementation decisions

- The fixed-height housing banner keeps `overflow: hidden`; it is needed to clip the teal
  wash, progress treatment, and rounded frame cleanly.
- Housing definitions now use `FloatingMetricTerm`, which portals the tooltip under
  `document.body` and positions it within the viewport. This is the same established path
  used by the horizontally scrolling stand-out cards.
- `FloatingMetricTerm` accepts optional presentation-specific definition and why text.
  Existing stand-out callers still use the shared metric dictionary unchanged.

## Assumptions

- The housing banner should keep its fixed height and visual clipping rather than growing
  to contain an open definition.
- Housing profile definitions should retain their existing wording and content.

## New TODOs / limitations

- The project does not currently have a browser-component test harness for focus, hover,
  portal placement, or clipping. The interaction is verified in the browser.

## Verification

- `cd web && npm run typecheck`
  - Passed.
- `cd web && npm test -- --run`
  - 24 files passed; 204 tests passed.
- `cd web && npm run build`
  - Production static export passed; 2,276 pages generated.
  - The existing warning that `NEXT_PUBLIC_ARTIFACT_URL` was unset remained.
- Browser checks on Somerset County `/regions/12`:
  - Before the fix, the 146px definition extended 109px below the 108px banner and was
    visibly cut at the banner edge because its computed overflow was `hidden`.
  - After the fix at 1280px, the definition rendered as a 288px by 92px body-layer tooltip,
    fully within the viewport and outside the banner subtree.
  - At a 375px viewport, the tooltip remained fully visible below the 112px banner. The
    document kept equal 360px client and scroll widths, so the portal added no overflow.
  - Escape closed the focused tooltip and returned the page to zero floating tooltips.
