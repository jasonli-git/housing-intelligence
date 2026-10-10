# Tool navigation and slate budget workspace

## What changed

- Follow-up: removed the decorative arrow from Find your fit in both desktop navigation and mobile Tools; link behavior unchanged.
- Find your fit now has pale slate-blue / midnight-slate surfaces rather than the default neutral background. Warm budget result accents remain.
- Shared desktop navigation: brand/code link, search, Find your fit, Buyer's guide, Property tax, theme.
- At widths up to 1000px: brand/theme row, then search beside a compact native Tools disclosure. Existing unavailable/hidden budget states remain intact.
- Shortened the default budget navigation label to Find your fit; New Jersey scope remains in the tool and accessible link label.

## Files/modules affected

- `web/components/Masthead.tsx`
- `web/app/ui-refinement.css`
- `web/lib/mastheadBudget.test.ts`
- `web/scripts/check-tool-navigation.mjs`

## Architectural or implementation decisions

- Shared link JSX supplies desktop and mobile presentations; CSS removes the inactive presentation from layout and accessibility tree. Native disclosure works without hydration.
- No changes to calculations, data sources, search behavior, or geographic colour assignments.

## Assumptions

- User approved palette and navigation on the existing experimental task branch, updating PR #141.

## New TODOs / limitations

- Native menu closes by toggling Tools or navigating; no custom outside-click/Escape dismissal implemented.
- Existing hidden budget entry on the national landing page stays hidden because coverage is New Jersey-only.
- Local export still uses the temporary artifact proxy on port 8001; never deploy this local artifact URL. No production configuration edits.

## Verification

- Arrow-removal follow-up: typecheck, three targeted masthead tests (including no-arrow regression), 2,386-page static build and `git diff --check` passed.
- `npm run typecheck`: passed.
- `npm test`: 565 tests / 81 files passed; budget regression checks updated for approved label/order.
- `NEXT_PUBLIC_ARTIFACT_URL=http://localhost:8001 npm run build`: passed, 2,386 static pages. Initial sandbox build could not access local API; reran outside sandbox. One overlapping build attempt was rejected; reran after previous build completed.
- `A11Y_ORIGIN=http://localhost:3002 node scripts/check-tool-navigation.mjs`: eight width/theme combinations passed (1280, 768, 390, 320px; light/dark), checking link order, active page, native keyboard opening/focus/closing, reflow and WCAG tags. Reviewed 390px dark and 1280px light screenshots.
- No separate frontend lint task; no backend tests for CSS/navigation-only changes. No canonical documentation edits or deployment.
- Shared-navigation WCAG audit on `/`, `/guide`, `/tax`: all 24 desktop/mobile light/dark default/expanded states passed. `git diff --check` passed.
