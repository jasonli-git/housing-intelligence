# Streamline place navigation

## What changed

Removed Sources from the shared place-page section-navigation entries, including mobile options and desktop links. The source section and its anchor remain available.

## Files/modules affected

- `web/app/[state]/[place]/page.tsx`

## Architectural or implementation decisions

Remove the navigation entry only; no change to source content or evidence links.

## Assumptions

The request applies to the place-page navigation bar. No other navigation changed.

## New TODOs / limitations

Local-only change; no push/deploy.

## Verification

- Typecheck passed.
- Browser checks at 390/1440px confirm the shortcut is absent and the source heading remains.
- No full suite/build rerun for this single entry removal.
