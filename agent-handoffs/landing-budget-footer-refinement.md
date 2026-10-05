# Landing budget and footer refinement

## What changed

- The national landing page budget entry reads Find within my budget (My budget on mobile), with no NJ suffix or arrow, and is a native disabled button rather than a link.
- Masthead now honours its existing disabled availability configuration; supported pages retain the statewide budget link. Disabled entries expose the configured reason through their accessible label/title.
- Publisher notices are a plain, neutral two-column ledger on desktop and one column on mobile. Removed the filled background, rounded card treatment, accent heading and monospace body treatment. Sources and Source history retain their cards.

## Files/modules affected

- `web/app/page.tsx`: neutral landing label.
- `web/components/Masthead.tsx`: disabled control versus navigable link.
- `web/app/budget-explorer.css`: disabled appearance and unboxed publisher notices.
- `web/lib/mastheadBudget.test.ts`: disabled/supported navigation tests.

## Architectural or implementation decisions

- Required notice text, publisher names, links, deduplication and ordering are unchanged. Notices remain visible before data provenance, not hidden behind a disclosure.
- Styling is presentation-only; no licensing interpretations or data-source changes.
- No canonical documentation or backend changes. Continues on experiment/state-navigation-refinement and PR #94.

## Assumptions

- Disabled means the landing page provides no budget navigation; readers choose a covered state first.
- Existing disabled availability on other pages should also be honoured rather than silently ignored by Masthead.

## New TODOs / limitations

- Full notices still require vertical space, particularly on mobile; this pass reduces visual competition rather than hiding or abbreviating them.
- Headless Chromium checks are not physical-device or assistive-technology audits.
- No frontend lint script is configured; backend tests not run for this frontend-only follow-up.
- Local build retains the existing unset NEXT_PUBLIC_ARTIFACT_URL warning. No deployment.

## Verification

- `cd web && npm test`: 447 tests passed in 56 files, including existing publisher-notice rendering tests and two new Masthead availability tests. Initial new-test rendering failed because an async licence component needed mocking; corrected the test isolation and reran successfully.
- `cd web && npm run typecheck`: passed.
- `cd web && npm run build`: passed, 2,379 static pages generated, existing artifact-origin warning.
- `git diff --check`: passed.
- Temporary headless Chromium at 1440px desktop and 390px mobile: landing budget is disabled with no NJ label; supported NJ budget remains a link; all 11 notices remain rendered; notice background transparent and border radius zero; no mobile horizontal overflow. Desktop/mobile screenshots visually inspected.
