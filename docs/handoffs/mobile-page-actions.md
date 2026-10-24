# Mobile page actions

## What changed
- County, town and ZIP page header actions share one mobile row.
- Report link retains its document icon, uses “Full report” on mobile and omits the subtitle/trailing arrow there.
- Jump control uses a concise static mobile label; the native dropdown retains its accessible name, destinations and focus/scroll behavior.
- Desktop labels and layout remain unchanged.

## Files/modules affected
- `web/app/[state]/[place]/page.tsx`
- `web/components/SectionJump.tsx`
- `web/app/ui-refinement.css`

## Architectural or implementation decisions
- Mobile grid gives remaining width to the dropdown and auto-sizes the report link.
- Visual mobile label is aria-hidden and pointer-transparent; the native select remains the control.
- Continued the assigned branch and existing PR.

## Assumptions
- Applies to local place pages, not unrelated state/tool controls.

## New TODOs / limitations
- No routing, data or canonical documentation changes.

## Verification
- `npm run typecheck` and `npm test`: passed, 587 tests.
- `npm run build`: passed; 2,384 pages, 2,366 compatibility aliases, 16,682 files.
- Targeted Playwright production checks passed across three places (Somerset County, Princeton, ZIP 07030), four widths (320/390/600/1280px), both themes: row alignment, tap height, report icon/labels, overflow and navigating to costs via native select.
- An initial diagnostic used the wrong option value; rerun using the actual option label passed.
- `git diff --check`: passed.
- Inspected 320px mobile screenshot; both controls fit with 44px minimum tap targets.
