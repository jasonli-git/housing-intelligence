# Five-section spacing

## What changed

Standardized the Princeton pilot's main boundaries: Overview/navigation → Market at a glance → Costs → About this place → Alternatives. One responsive gap token supplies 32px at small widths, growing smoothly to 48px on wide desktop screens. Removed accumulated outer margins and extra top padding that made the boundaries inconsistent. Internal card/rail spacing remains independently compact.

## Files/modules affected

- `web/app/[state]/[place]/page.tsx`: pilot-only spacing class.
- `web/app/place-overview.module.css`: scoped boundary spacing and margin containment.
- `web/scripts/check-place-comparisons.mjs`: actual geometry checks for all four gaps.

## Architectural or implementation decisions

The sticky section navigation is treated as the end of the Overview area. Use flow-root wrappers so child margins do not silently enlarge the next gap. Keep IDs, section order, navigation behavior and all contents. The spacing class is only applied to the existing Princeton pilot; other place layouts remain unchanged.

## Assumptions

Only consistent spacing is authorized for implementation in this request. Further finishing touches are recommendations, not changes.

## New TODOs / limitations

Recommended future review: remove the duplicated Housing, at a glance figures beside Costs now covered by the comparison rail; improve the smallest metadata/uncertainty text; make ranked-tile click affordances clearer; test the composition against missing-data places before rolling it out. None implemented here. No push/deploy, backend work or canonical-doc changes.

## Verification

- Before, measured outer gaps were 19.2/19.2/32/32px, with additional heading padding in the latter sections. After: all four gaps 32px at 390/768px, 48px at 1440px; heading top padding removed.
- TypeScript passed.
- All 847 tests in 144 files passed.
- `node scripts/check-place-comparisons.mjs`: passed at 320/390/768/1440px in both themes, including exact gap equality, heading parity, ranked-rail controls, comparison/back navigation, no overflow and scoped axe. Nonpilot Hoboken retains its original presentation.
- Scoped production export passed (1,188 routes).
- `git diff --check` passed.
- Initial file reads used repo-relative paths while the command was in web; corrected the paths. No implementation failure.
