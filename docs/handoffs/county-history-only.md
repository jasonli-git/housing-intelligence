# County history only on county place pages

## What changed

Removed the inline county market-history graph from the Princeton municipal pilot, including its extra parent-county persistence fetch and unused history story record. Other towns already omit this county-only exhibit. County pages retain their existing How unusual is today's market exhibit. Updated the local-story regression harness to expect no inline county history on Princeton.

## Files/modules affected

- `web/app/[state]/[place]/page.tsx`
- `web/scripts/check-place-stories.mjs`

## Architectural or implementation decisions

Place-page history is county-only, using the existing county persistence loading gate. Shared story/history components and the standalone history story remain available; no data or analytical semantics changed.

## Assumptions

The request concerns town/municipal place pages, not removing county data from the standalone Visual story's place selector. Other local stories, including explicitly scoped county health/migration context, are unchanged.

## New TODOs / limitations

CountyHistoryContext remains preserved as unused prototype code. No push/deploy or canonical-doc changes.

## Verification

- Typecheck and focused history component/summary tests run.
- Browser verification at 390/1440px: Princeton and Hoboken omit county history; Mercer County retains its visible history exhibit when expanded. Princeton retains all 13 other story cards.
- No full suite/build rerun for this removal.
