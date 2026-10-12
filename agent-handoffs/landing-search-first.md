# Search-first landing experiment

## What changed
- Task-led introduction, immediate location search, explicit NJ coverage and a Princeton example link.
- Map now appears only when deliberately explored; retained zoom, navigation, keyboard search and map controls.
- Moved project scale into About the data after the opening; exact counts and methodology preserved.
- Landing-scoped typography, contrast, spacing and quieter usage/source-check treatments. Restriction wording unchanged.

## Files/modules affected
- Landing page, scoped landing-search-first CSS, NationalCoverageMap focused-entry option, browser diagnostic.

## Architectural or implementation decisions
- Opt-in map presentation; other callers retain their existing behavior.
- Preserve existing JL/Housing/portfolio/GitHub identity and theme controls, avoiding a shared navigation redesign in this prototype.
- Search still supports the actual state/town/county/ZIP catalogue; NJ detailed coverage stated before a result is chosen.

## Assumptions
- This is exploratory, not an approved universal design system.
- Director Note proposed in chat remains unwritten. No canonical document or terms changes.

## New TODOs / limitations
- Other pages remain unchanged. No broader national detailed coverage promised.
- Search-mode map art intentionally removed: map is an actual coverage explorer, not an implied data backdrop.

## Verification
- `npm run typecheck`: passed. `npm test`: 655 tests in 104 files passed.
- Initial build failed because local API was stopped; restarted read-only API on 8000 and static preview on 3002, then build passed (2,386 pages / 16,695 exported files). Preview guide adapter is local-only.
- `node scripts/check-search-first.mjs`: eight width/theme cases passed (320/390/768/1280, light/dark): first-screen search, Princeton results, map/search switching, restriction disclosure, axe and horizontal overflow.
- `node scripts/check-data-scale.mjs`: six width/theme cases passed; supporting counts, exact disclosure, reduced motion and footer preserved.
- Inspected dark mobile and light desktop screenshots; refined desktop search alignment and removed mobile portrait overlap. Final rebuild/recheck recorded below.
- No backend changes/tests. Canonical documents and proposed Director Note remain untouched.
- Final refined build passed; all eight interaction/accessibility cases and six data-scale cases passed again. Final mobile screenshot inspected. `git diff --check` passed.
