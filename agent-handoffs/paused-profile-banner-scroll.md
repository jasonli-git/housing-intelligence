# Paused profile banner swipe and source status styling

## What changed

- Paused statewide and local profile banners now use native horizontal touch scrolling, so a mobile swipe works while the Pause control is active.
- Pausing keeps the currently visible metric in place; Play resumes the conveyor from the reader's swiped position. Mouse dragging still works on desktop.
- Kept offscreen loop copies out of the normal playback render and static export. Added extra copies only while manually paused, allowing a swipe in either direction from the pause point.
- Contained visually hidden rank text within the scroll window so the extra paused content cannot widen a mobile page.
- Added a focused headless browser regression check for touch, mouse drag, keyboard focus, and reduced motion.
- Restyled the global source-check/build-date link as a neutral metadata line instead of a blue badge, so it no longer resembles the New Jersey population badge.

## Files/modules affected

- `web/components/StateProfileTicker.tsx` — pause/play position handoff, native-touch behavior, and paused loop copies.
- `web/app/redesign.css` — paused touch scrolling and scroll containment.
- `web/scripts/check-paused-profile-swipe.mjs` — browser regression check.
- `web/components/SiteStatus.tsx` — separates the source-check label for quieter typography.

## Architectural or implementation decisions

- Let the browser own touch panning in the paused state; the custom pointer-drag path remains for desktop mouse dragging and moving playback. This avoids conflicting gesture handlers on touch devices.
- Capture the animated transform as a group-relative offset before pausing, then seed `scrollLeft` before paint. On Play, turn the final scroll offset back into the animation's negative delay.
- Render two metric groups during playback, as before, and four only during manual pause. The additional groups are visual repeats; the middle group exposes the interactive metric definitions to the accessibility tree.
- Keep the source schedule and build timestamp wording and `/freshness` navigation unchanged. Remove the status link's blue fill and rounded enclosure; a neutral rule and typographic hierarchy distinguish it from population data without implying that source checks succeeded.

## Assumptions

- "Scrolling" means swiping the paused banner horizontally on mobile, with the same shared component covering statewide, county, and municipality banners.
- Paused manual exploration may reach a finite end after several repeated groups; the automatic conveyor remains continuous during playback.
- The status follow-up is a presentation change only; it does not alter the Friday schedule, build timestamp, or freshness claims.

## New TODOs / limitations

- Native iOS Safari was not available for automated verification. The browser check uses headless Chromium mobile touch emulation.
- The broader `check-nj-redesign.mjs` script currently stops at an unrelated stale assertion for `.population-summary`; the live component is `.population-badge`. This task leaves that script unchanged.
- Visual duplicate groups use plain metric labels, as the pre-existing playback duplicate did; the central group retains interactive definitions.

## Verification

- `cd web && npm run typecheck` — passed.
- `cd web && npm test` — 33 files, 280 tests passed.
- `cd web && NEXT_PUBLIC_ARTIFACT_URL=https://housing-data.jasonli.app npm run build` — passed; 2,278 static pages generated.
- `cd web && node scripts/check-paused-profile-swipe.mjs` — passed at 320px and 390px for state and county touch swipes in both directions, resume position, no mobile page overflow; 1440px desktop drag, keyboard focus, and reduced-motion checks passed.
- `cd web && node scripts/check-nj-redesign.mjs` — stopped on the stale `.population-summary` assertion noted above, after its page-width and early ticker checks passed.
- Source-status visual QA via Playwright at 1440px, 390px, and 320px in light/dark mode — no horizontal page overflow; link still points to `/freshness`; neutral background and border confirmed.
- `git diff --check` — passed.
