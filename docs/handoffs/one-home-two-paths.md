# One home, two paths

## What changed
- Interactive rent/buy experience within the buyer’s guide’s existing Rent or buy slide. Price, down payment, rate and upkeep controls share existing guide state; a 1–30-year scrubber reveals cumulative costs and separate cash concepts.
- Two paths use the current guide's owning-then-selling net cost versus rent paid. Readouts separate money spent, repaid principal, assumed price change, sale proceeds and the down payment not tied up in a purchase.
- Flat growth is the existing default; remembered growth scenarios remain explicit and can be reset to zero with Try no growth. No investment-return model or automatic prediction.

## Files/modules affected
- `web/components/TwoPaths.tsx` and tests; `web/lib/twoPaths.ts` and tests.
- `web/components/DecisionGuide.tsx`, `web/lib/guide.ts`: pass through the exact existing engine inputs, share controls and maintain whole-year selection.
- `web/app/learning-exhibits.css`: responsive path stage, distinguishable solid/dashed curves and readouts.
- `web/app/guide/page.tsx`, `web/scripts/serve-accessibility.mjs`: explicit local-only guide artifact override and narrowly whitelisted read-only API adapter; production artifact defaults unchanged.
- `web/scripts/check-two-paths.mjs`: reproducible browser diagnostic.

## Architectural or implementation decisions
- Reuses `eachMonth` and `overYears`, including existing closing/selling costs, mortgage insurance and incomplete-cost handling. No new backend methodology or sources.
- Money spent equals the engine's net cost with assumed price change removed; financed FHA premiums remain costs. Principal paid down is not added to profit.
- Rent-side available down payment is not a savings balance or investment gain. Rental deposits/moving and use of that cash are explicitly not modelled.
- Both chart curves use the same dollar scale with zero included, supporting negative net owning costs under explicit growth scenarios. Exact selected amounts remain in readable text; keyboard slider and numeric fields are the primary controls.
- Guide cost horizon is whole years, clamped to 1–30. Existing assumptions and other guide answers update together rather than a competing calculator.
- No animation/autoplay of financial values. No changes to printable reports or place-page cost calculation.

## Assumptions
- Existing housing-cost engine is the approved methodology. Growth settings are scenarios, never predictions; typical rental and single-family purchase are not equivalent properties.

## New TODOs / limitations
- Does not model investment returns, cash accumulation, rental deposits, tax deductions or household spending beyond existing costs.
- Existing detailed assumptions/citations remain below the experience; all missing recurring costs remain disclosed.
- The chart spans 30 years, not an optimised recommended holding period.

## Verification
- `npm run typecheck`: passed.
- `npm test`: 636 tests passed in 97 files, including engine equivalence, growth/spending separation, financed FHA premiums, accessible controls and negative sale equity.
- Normal `npm run build`: passed, 2,386 static outputs, 2,366 aliases and 16,695 exported files.
- Local preview initially could not fetch production JSON (browser requests failed). Preview adapter verified HTTP 200 with actual local warehouse packet; no financial mock data.
- Local preview command: `GUIDE_PREVIEW_ARTIFACT_URL=http://localhost:3002/preview-guide npm run build`, with API on port 8000 and `node scripts/serve-accessibility.mjs` on 3002. Do not use that preview override for deployment.
- Preview build passed. `node scripts/check-two-paths.mjs` passed at 320/390/1280px in both themes using Princeton's actual packet: year scrub and keyboard, purchase price changes, FHA down payment, growth reset, no horizontal overflow and scoped axe accessibility. Initial selector for the down-payment menu was too strict; corrected and rerun successfully.
- Mobile dark-mode screenshot inspected; `git diff --check` passed. Backend tests not run (no backend changes); no configured frontend lint command.
