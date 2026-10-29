# Cohesive About this place frame

## What changed

Princeton's About this place now has one subtle enclosing surface, thin border and modest rounded corners. Its heading sits inside the frame. The comparison tiles have transparent backgrounds/borders at rest, retaining hover/focus affordances, so the current-value strip introduces the richer local-story carousel beneath it. Both rails use matching focus insets and aligned outer edges. The practical school check and guide link remain outside, directly below.

## Files/modules affected

- `web/app/[state]/[place]/page.tsx`
- `web/app/place-overview.module.css`
- `web/components/PlaceComparisons.module.css`
- `web/scripts/check-place-comparisons.mjs`

## Architectural or implementation decisions

Use the existing QuietAnchor conditional wrapper for the pilot frame; nonpilot pages receive a fragment and keep their original hierarchy/styles. Preserve existing local-picture interpretation inside the frame when available, before the two rails. Retain the five primary section boundaries, existing IDs/navigation, all five comparison measures, 13 stories, sources/dates/uncertainty/revision labels and carousel behavior. No new animation or interaction mode.

## Assumptions

Approval covers the proposed shared frame and quieter comparison treatment. Both carousels remain separate because they serve quick comparison and deeper exploration respectively. Existing Princeton-only/local-only scope, no push/deploy or canonical-doc changes.

## New TODOs / limitations

No changes to data, ranking algorithms, matching rules or AI readings. The school check remains within the overall About this place section for navigation, but outside its exploration frame. This does not roll the pilot out to other places.

## Verification

- TypeScript passed.
- All 849 web tests in 145 files passed.
- `node scripts/check-place-comparisons.mjs` passed at 320/390/768/1440px in light/dark: shared-frame containment, school outside frame, heading parity, uniform outer spacing, rail controls/keyboard, comparison/back navigation, no overflow and scoped axe. Nonpilot Hoboken retains its previous presentation.
- Additional 390/1440px light/dark checks passed exact alignment of both rail edges and all 13 stories present.
- Visually reviewed desktop light and narrow mobile dark frame captures.
- Scoped production export passed (1,188 routes).
- `git diff --check` passed. No backend/warehouse work needed or run.
