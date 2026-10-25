# Homepage hierarchy

## What changed

- Put a concise description, place search and clear New Jersey coverage at the start of the homepage. Provide direct budget and comparison links, plus example place links.
- Make all six tools visible in a responsive grid with existing light/dark screenshot previews and live text. Remove the horizontal tool carousel and its custom keyboard/scroll controls; ordinary Tab navigation reaches every tool.
- Keep the coverage map available in a native disclosure, including its zoom, pan, keyboard and New Jersey navigation behavior. Keep the `/` search shortcut independent of whether the map is open.
- Place the existing Visual stories gateway after tools, followed by the national market strip. Preserve every national figure, source link, definition, history, takeaway and qualification.
- Move project-scale figures into a supporting section with an explicit accessible group and an “About these figures” disclosure. Preserve the full definitions and provenance links.
- Replace five imported homepage presentation layers with a scoped CSS module. Keep the serif identity, use compact UI typography and quieter surfaces, and define the new homepage palette in the existing token file.

## Files/modules affected

- `web/app/page.tsx`: homepage composition, entry routes and section order.
- `web/app/homepage.module.css`: homepage layout, responsive presentation, focus and reduced-motion styles.
- `web/app/tokens.css`: homepage palette tokens; other pages do not opt into these surfaces.
- `web/components/HomeSearch.tsx`: existing place search plus the preserved `/` shortcut and example links.
- `web/components/HomeTools.tsx`: semantic grid of the six existing tools.
- `web/components/ToolRail.tsx`: removed, since the homepage was its only consumer.
- `web/components/DataScale.tsx`: optional disclosure heading and a group role for its named project-scale summary.
- `web/components/HomeTools.test.tsx`: preserve the link/content/theme-preview contract; remove the obsolete carousel test.
- `web/scripts/check-home-tool-previews.mjs`, `web/scripts/check-home-stories.mjs`: update browser acceptance checks for the grid, native keyboard order and new section order.

## Architectural or implementation decisions

- This is a homepage presentation and navigation change. Backend contracts, calculations, datasets, the tool pages and individual stories retain their behavior.
- The homepage uses the existing `PlaceSearch`, `NationalCoverageMap`, `HomeTools`, `HomeStories`, `NationalScoreboard` and data-scale components. No new dependencies or alternative data paths were introduced.
- The map is a supporting coverage view, so it starts closed. Its existing intersection observer defers geometry loading while the disclosure is hidden. A direct New Jersey link remains available without opening the map.
- Styles for shared components are nested under the module's local homepage class. Page surface variables apply only while the body contains `.home-page`, so navigating away does not retain the homepage palette.
- Generated screenshots continue to come from the existing artifact origin and deployment capture pipeline. Thumbnails preserve the complete screenshot with `object-fit: contain`; labels and descriptions remain real text.
- The optional `DataScale.heading` preserves the old default for other callers. The named summary now explicitly uses `role="group"`.
- Canonical project documents were not changed. Claude can reconcile the new homepage hierarchy and the superseded presentation decisions after reviewing the diff.

## Assumptions

- The owner approved building the proposed design direction, starting with the homepage, and approved `refactor/homepage-hierarchy`.
- New Jersey remains the detailed coverage area. Its label and route are read from the existing covered-states configuration.
- All six existing tools should remain available. The story gateway remains one collection link with the actual catalogue count and existing chart fragments.

## New TODOs / limitations

- This pass has no observed reader study or physical-device validation. Usability and interpretation testing remain useful follow-up work.
- Previous homepage CSS files remain in the repository but are no longer imported by this route. Broad removal and historical one-off browser-check cleanup are outside this bounded pass. Several old checks still describe superseded search/map layouts; use the updated homepage preview/story checks and the general accessibility audit for this design.
- Accessibility automation can flag decorative arrow contrast for manual review; automated audit results are not a WCAG certification.
- Previewing generated tool/story pictures requires the published artifact origin, or the existing capture pipeline's local artifact routing. The development API does not serve these generated pictures. The development preview used `NEXT_PUBLIC_ARTIFACT_URL=https://housing-data.jasonli.app`.
- The site has no configured frontend lint command. TypeScript, Vitest, the color-token guard, browser acceptance checks, the accessibility audit and a production export were used instead.

## Verification

- `cd web && npm run typecheck`: passed.
- `cd web && npm test -- --reporter=dot`: 129 files, 767 tests passed. The retired carousel test accounts for the change from 768 tests on the previous layout.
- `cd web && npm run build`: passed; generated 2,430 static pages, 598 legacy aliases and 15,193 exported files, under the 20,000-file cap.
- `node --check web/scripts/check-home-tool-previews.mjs` and `node --check web/scripts/check-home-stories.mjs`: passed.
- `cd web && SITE_URL=http://localhost:3002 node scripts/check-home-tool-previews.mjs`: passed at 1440, 768, 390 and 320 pixels in light and dark. Verified complete tool rows, thumbnail loading/themes, all six destinations and back navigation, native Tab order, national sources/histories/takeaways, reduced motion, print behavior and axe checks.
- `cd web && SITE_URL=http://localhost:3002 node scripts/check-home-stories.mjs`: passed at the same four widths in both themes. Verified one collection gateway, real chart fragments, count/scope, focus/hover parity, no autoplay, reduced motion, click-through, compact layout and axe checks.
- `cd web && A11Y_ORIGIN=http://localhost:3002 A11Y_PATHS=/ A11Y_WIDTHS=1440,768,390,320 A11Y_OUTPUT=/tmp/homepage-hierarchy-accessibility.json npm run check:a11y`: passed across 16 combinations of viewport, theme and default/expanded state; no automated violations, page errors or horizontal overflow.
- Browser inspection of the production export: reviewed the desktop and phone layouts, opened the coverage map, and verified keyboard search selection, place navigation, Back and `/` search focus.
- `git diff --check`: passed.
- Initial checks correctly rejected the obsolete carousel test and new colors outside tokens; both were corrected before the passing verification above. The accessibility review also prompted the explicit project-scale group role.

No merge or production deployment was performed.
