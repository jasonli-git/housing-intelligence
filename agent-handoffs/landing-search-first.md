# Search-first landing experiment

## What changed
- Desktop placement/control follow-up: US artwork moves into the former right-hand portrait position on wide screens while retaining mobile placement. NJ emits two staggered outward radial rings; reduced motion shows a static ring. Removed NJ coverage shortcut. Map/search controls now use rounded icon-and-label buttons (map outline / back arrow).
- Geographic centerpiece follow-up: removed house portrait; promoted US drawing, added restrained NJ blue halo and available-state trace highlights driven by destination registry. Same SVG is retained when switching to interactive exploration, with height/position/opacity transitions rather than artwork replacement. Mobile uses a tighter map canvas; reduced motion removes breathing/transition effects.
- Lean/artful follow-up: shortened intro to “Housing costs. Local context. Clear sources.” Free assurance now reads “Free · No fees or ads,” with subscription assurance in an expandable definition. Removed Find a place label, Princeton example, duplicate NJ link and About the data title/extra place-count sentence.
- Restored the animated US outline/travelling lines behind search, decorative/inert in search mode. One Explore map action replaces two visible tabs; Back to search appears in map mode. NJ coverage itself links to the state page.
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
- Follow-up restores decorative search-mode outlines; they depict geographic coverage, not local housing values. Interactive map remains a deliberate exploration mode.

## Verification
- Desktop portrait-position follow-up: typecheck, 655 tests and static build passed. Added 1024px checks; first run found overflow there, corrected desktop scale to fit the portrait space. Radial motion checks replace breathing-animation assertions. Final responsive rebuild/recheck below.
- Final rebuild and all ten width/theme cases passed, including actual zoom/reset, radial/reduced motion, axe and horizontal overflow. Inspected 1024px desktop screenshot; `git diff --check` passed.
- Geographic centerpiece: typecheck, 655 tests and static build passed. Browser run caught tablet overflow; confined SVG motion to map window, then all eight cases passed. Verified same SVG retained across modes, NJ breathing animation with normal motion and none with reduced motion. Visual inspection prompted mobile controls positioning below region bar; final build/check below.
- Final build and eight responsive/theme cases passed, including actual zoom/reset clicks, axe and overflow checks. `git diff --check` passed. Blue available-state trace styling follows destination registry; the current pulse is NJ-specific and needs centroid placement for additional states.
- Lean/artful follow-up: typecheck, 655 tests and build passed. Eight interaction/theme/width cases passed, including normal-motion `atlas-travel` animation and free-assurance expansion; six exact-count cases passed. Screenshots inspected. Removed reserved space for hidden map controls in decorative mode; final rebuild/recheck below.
- Final tighter build and all eight interaction/accessibility cases passed; light desktop screenshot inspected. `git diff --check` passed.
- `npm run typecheck`: passed. `npm test`: 655 tests in 104 files passed.
- Initial build failed because local API was stopped; restarted read-only API on 8000 and static preview on 3002, then build passed (2,386 pages / 16,695 exported files). Preview guide adapter is local-only.
- `node scripts/check-search-first.mjs`: eight width/theme cases passed (320/390/768/1280, light/dark): first-screen search, Princeton results, map/search switching, restriction disclosure, axe and horizontal overflow.
- `node scripts/check-data-scale.mjs`: six width/theme cases passed; supporting counts, exact disclosure, reduced motion and footer preserved.
- Inspected dark mobile and light desktop screenshots; refined desktop search alignment and removed mobile portrait overlap. Final rebuild/recheck recorded below.
- No backend changes/tests. Canonical documents and proposed Director Note remain untouched.
- Final refined build passed; all eight interaction/accessibility cases and six data-scale cases passed again. Final mobile screenshot inspected. `git diff --check` passed.
