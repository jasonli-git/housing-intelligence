# UI density, discoverability and shared identity

Branch: `experiment/ui-density-discoverability`. Frontend experiment, not a milestone. No merge or deployment.

## What changed

- A restrained spacing/type pass across the landing page, New Jersey, county/municipality/ZIP profiles, budget finder, buyer’s guide, property tax lookup, source-history pages, legal pages and screen reports. Keep the existing editorial/artful direction, geography colours and data abstractions.
- Compact disclosures keep their supporting content available. The home-check summary names flood, schools, internet and tax so readers know what they can uncover. Shorter guide/revision introductions put explanatory detail in native disclosures rather than delete it.
- “Jump to section” follows document order, includes household tools/housing help/migration, opens disclosure ancestors, transfers keyboard focus and clears the sticky navigation. Add the same control to guide, budget, freshness, revisions, legal and screen-report pages. Freshness groups and revision dates are direct destinations. Conditional destinations appear as content arrives.
- A new charcoal/ivory/green roofline-and-bars mark replaces the small masthead dot and generic favicon. Regenerate SVG-derived browser/iOS icons and a cream editorial 1200×630 share card. Metadata names `/housing-preview.png`; `/og-image.png` remains available with the new artwork for old links.
- A designed 404 recovery page offers one place search and routes into New Jersey or the landing page. Preserve Next’s not-found/noindex behavior.
- Preserve comfortable footer tap targets, improve landing map-label contrast and keep narrow navigation from squeezing the GitHub control.
- US-page follow-up: soften the tagline colour without changing its size, and shorten the free-use badge to “Free · No fees, subscriptions or ads.” Use editorial serif headings for the bottom cards, distinct from the publisher notices. Align the Notice shield with its heading and group its policy links separately from the legal/source paragraph.
- Subsequent placement/accent adjustment: put the free-use badge directly after the tagline, before the place search, and restore the shared Notice shield to the existing yellow warning token (`--notice-text`) in both themes. Keep the new icon alignment and footer structure.
- Replace only the Notice heading's font-dependent ↗ glyph with a decorative 13px SVG external-link icon. The yellow shield, heading font, link destination and other links remain unchanged.
- Match the Notice heading to the yellow shield. Make the large New Jersey title in the coverage preview an internal link with a small right arrow; remove the separate right-side “Explore New Jersey” button. Keep the map's other navigation links intact.
- Approved national home-price follow-up: see `agent-handoffs/national-home-price-benchmark.md`. That bounded addition introduces a monthly national series and corrects FHFA attribution/cadence; the frontend-only/no-new-figures statements below describe the earlier UI pass, not this subsequent work.
- Subsequent landing experiment combines place search and map in a search-first area; see `agent-handoffs/search-first-landing.md`. It supersedes the separate upper search and earlier free-badge-before-search adjacency without changing the badge's position below the tagline.
- Landing hierarchy follow-up: reduce the tagline to a responsive 22–30px and soften its colour while retaining comfortable contrast. Strengthen the unchanged free-use badge with primary-colour text, a green check and faint green border/background. Keep its size and one-line mobile wording. The subsequently approved shared metric strip and actual-data trends are documented in `agent-handoffs/national-backdrop.md`.

## Files/modules affected

- `web/app/ui-refinement.css`, imported last by `web/app/layout.tsx`: screen-only presentation overrides; mobile/narrow-screen adjustments. Existing print styling remains in charge.
- `web/components/SectionJump.tsx`, `SectionJump.test.tsx`: destination discovery, cached scroll tracking, reveal/focus behavior and regression tests.
- `web/components/QuietCounty.tsx`: explicit title/copy spans for disclosure layout. `web/components/Masthead.tsx`: shared brand mark.
- Page markup: home, not-found, regions and their reports, guide, afford, freshness, changes, terms and privacy. No changes to legal-policy text or published figures.
- `web/app/icon.svg`, favicon, apple icon, both public preview PNGs; `web/scripts/make-site-images.mjs`; `web/lib/meta.ts` and metadata tests.
- `web/scripts/check-ui-refinement.mjs` and its package script: reproducible checks for the new shortcuts, share assets, 404 and screenshots.
- `web/components/SourceFooter.tsx` and `web/lib/sourceFooter.test.ts`: shared footer structure and regression checks preserving policy links, source-code access and the data-relicensing caveat.
- `web/components/NationalCoverageMap.tsx`: consolidate the coverage preview's New Jersey title and call to action into one title link.

## Architectural or implementation decisions

- Native select/details controls, not an additional navigation framework or overlay. New destinations are scoped to main content; the footer does not accidentally become part of the menu.
- Scroll handling uses cached destinations and a requestAnimationFrame. It does not repeat full DOM discovery/style inspection for every scroll event. Rediscover on content insertion, disclosure toggle, resize or menu focus.
- Existing figures, margins, freshness warnings, methods, source links and publisher notices remain intact. The local AI reading is not regenerated; its stale warning remains visible.
- Screen reports gain navigation but retain their full content and static/print definitions. The shortcut disappears in print.
- Icons/share assets are generated from repo-native SVG and the existing image script. No new package, remote font, image service, API, analytics or tracker.
- Branding bars are symbolic artwork, not plotted measurements. Page-specific share titles/descriptions/canonical URLs remain unchanged.
- Footer follow-up uses the existing Georgia serif and text font, not a new font dependency. Preserve the full existing Notice paragraph and all required publisher notices. The footer presentation is shared across pages; the tagline and free-use wording changes apply only to the US landing page. The badge fits one line at 320px without forcing nowrap or reducing its font size.

## Assumptions

- Approval covered this experimental frontend pass and the new shared identity. This is refinement of the current design, not replacement of calculations or introduction of new housing advice.
- Keep retired state maps retired; preserve existing national-map interactions. Do not restore past map-first layouts based on older design notes.
- The useful evidence stays available even when closed. Tightening spacing must not clip definitions, cut off figures or remove uncertainty warnings.

## New TODOs / limitations

- Share crawlers may cache cards/icons. The fresh preview URL helps, but these asset changes do **not** resolve Cloudflare bot blocking. No Cloudflare settings changed or production crawler access verified.
- Publisher notices are still fully shown because they are conditions of upstream data use. They continue to occupy space; this pass does not conceal required attribution.
- Automated accessibility checks supplement, not replace, reader review. There is no claim of a specific scrolling reduction or exhaustive device/screen-reader coverage.
- Development/static local previews are not deployment. The static-preview helper serves `/404.html` explicitly rather than emulate the host’s unknown-route fallback.
- Canonical documentation and Director Notes were not modified. Claude can reconcile any documentation references to the preview artwork if needed.
- National-metric follow-up: annual FHFA US home-price change is now implemented with explicit user approval; see the separate benchmark handoff. Census HVS rental vacancy remains only a possible future addition, not implemented or acquired.

## Verification

- `node scripts/make-site-images.mjs`: passed; regenerated the four raster outputs from the SVG.
- `npm run typecheck`: passed.
- `npm test`: 553 tests passed across 77 files, including five new section-jump cases and the existing closed-disclosure accessibility test.
- `npm run build`: passed; 2,386 static pages. Final build includes the narrow navigation, map contrast and guide-spacing fixes. API running locally; no source acquisition or model regeneration.
- `A11Y_ORIGIN=http://localhost:3002 npm run check:a11y:interactions`: passed. Keyboard search/navigation, theme/reduced motion, national-map controls, NJ county exploration, mobile definitions, evidence focus, 12 routes at 320px expanded, unique IDs, and no-script report definitions.
- `npm run check:ui-refinement`: passed. Nested/closed-section navigation, freshness/legal/report destinations, print exclusion, production metadata URL, five served identity assets and image dimensions, 404 noindex/single search, light/dark mobile 404 axe/reflow and county mobile reflow. Screenshots written to `/tmp/housing-ui-refinement/`.
- `curl -I http://localhost:3000/ui-refinement-missing`: HTTP 404 from Next development server.
- `A11Y_ORIGIN=http://localhost:3002 A11Y_PATHS='/,/states/new-jersey,/regions/12,/regions/224,/regions/3091,/afford?income=120000,/guide,/tax,/freshness,/changes,/regions/12/report,/terms,/privacy' A11Y_OUTPUT=/tmp/ui-density-final-a11y.json npm run check:a11y`: passed. 104 states (13 routes × 1440/390px × light/dark × closed/expanded), no axe violations, application errors or horizontal page overflow. Axe’s separate incomplete/manual-review results are not claimed as automated passes.
- `git diff --check`: passed. No separate frontend linter is configured; Python tests/lint and warehouse rebuild are not run for this frontend-only change.
- Final tagline/free-badge hierarchy revision: typecheck, 556 frontend tests/78 files, 2,386-page static build and focused UI checks passed. Badge remains one line at 1280/390/320px in both themes; new heading screenshots reviewed. `A11Y_ORIGIN=http://localhost:3002 A11Y_PATHS='/' A11Y_OUTPUT=/tmp/landing-hierarchy-a11y.json npm run check:a11y` passed all eight landing states with no automated axe violations, application errors or overflow. Manual/incomplete checks remain manual. No national metric layout/data changes were made in this revision.

Earlier exploratory audits caught and led to fixes for footer target size, the narrow GitHub target and low-contrast national-map helper text. A dev-server audit was interrupted by live reloads; final verification uses the stable static export instead.

### US landing/footer follow-up verification (October 9, 2026)

- `npm run typecheck` and `npm test`: passed; 553 tests across 77 files, including the expanded footer assertions.
- `npm run build`: passed; 2,386 static pages. An initial sandboxed build could not reach the local API; the retry with local-network access completed successfully.
- `npm run check:ui-refinement`: passed against the fresh export at port 3002. Added one-line badge, centred Notice shield, three policy links and page-reflow checks at 1280/390/320px in both light and dark themes. Existing navigation/assets/404 checks also pass. Visually inspected the generated mobile landing, desktop footer and mobile Notice screenshots in `/tmp/housing-ui-refinement/`.
- `A11Y_ORIGIN=http://localhost:3002 A11Y_PATHS='/,/regions/12,/regions/224,/regions/3091,/tax,/freshness,/changes' A11Y_OUTPUT=/tmp/us-footer-a11y.json npm run check:a11y`: passed; 56 states (seven routes, 1440/390px, light/dark, closed/expanded), no automated axe violations, application errors or horizontal page overflow. Manual/incomplete findings remain separate from automated passes.
- `git diff --check`: passed. No acquisition, model regeneration, canonical-document edits, deployment or merge.
- Badge-placement/yellow-shield follow-up: reran typecheck (passed), all 553 tests (passed), static build (2,386 pages) and `check:ui-refinement` (passed). Added checks for the badge's position between tagline/search and the Notice shield's warning-token colour at all three widths in both themes. Inspected fresh mobile screenshots. The broader 56-state audit above predates these two small adjustments; it was not rerun for them.
- Notice external-link icon follow-up: typecheck, 553 tests, 2,386-page static build and `check:ui-refinement` passed again. Added fixed 13×13px icon checks at 1280/390/320px in both themes; inspected the updated mobile Notice screenshot. No broader accessibility-matrix rerun for this decorative-icon substitution.
- Yellow-title/state-link follow-up: typecheck, all 553 tests, 2,386-page build and `check:ui-refinement` passed. Added checks for the New Jersey title link's destination, removal of the redundant button and matching Notice title/shield colours at 1280/390/320px in both themes. Inspected fresh mobile state-link and Notice screenshots; no broader accessibility-matrix rerun for this adjustment.
