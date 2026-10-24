# NJ Find your fit link colour

## What changed
- New Jersey’s Find your fit shortcut now uses the destination budget tool’s accent (light #a44e34 / dark #edb09b), rather than the default page text colour.
- Supporting “Across New Jersey” text remains secondary.

## Files/modules affected
- `web/app/ui-refinement.css`

## Architectural or implementation decisions
- Matched the existing `--budget-accent` values from budget-explorer.css; no routing or layout changes.

## Assumptions
- “Match” means match the destination tool’s colour, consistent with earlier internal-link conventions.

## New TODOs / limitations
- Values mirror the destination token; update both if that palette changes.
- No canonical documentation changes.

## Verification
- Computed-colour checks in both themes passed against the destination accent values. Checks caught generic internal-link and accessibility rules overriding the simple class; added a scoped NJ selector.
- Final production computed-colour check passed for light and dark.
- `npm test`: 587 tests passed.
- `npm run build`: passed, including TypeScript checking.
- `git diff --check`: passed.
