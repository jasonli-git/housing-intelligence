# Place context link colors

## What changed
- Same-page commute/service and public-safety links now follow municipality teal and ZIP purple. County links retain green.
- Tax-tool and external-source links are unchanged.

## Files/modules affected
- web/app/ui-refinement.css
- web/scripts/check-place-link-colors.mjs

## Architectural or implementation decisions
- Scoped link colors to the existing geographic accent, avoiding a hardcoded county color on other place types.

## Assumptions
- Continue the current branch and PR, no merge or deployment.

## New TODOs / limitations
- Local artifact build configuration must not be deployed.

## Verification
- npm run typecheck: passed.
- npm test: 575 tests across 85 files passed.
- NEXT_PUBLIC_ARTIFACT_URL=http://localhost:8001 npm run build: passed, 2,386 exported pages.
- node scripts/check-place-link-colors.mjs: exact colors and scoped axe WCAG A/AA checks passed on county 12, municipality 224, ZIP 2842 in light and dark themes at 390px.
- git diff --check: passed.
