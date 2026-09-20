# Live deployment check

## What changed

- Added `make check-live`, a standalone post-deploy check that first runs `check-dist` and
  then opens both production origins in headless Chromium.
- The artifact check requires the deployed `manifest.json` to be deeply equal to the
  local `dist/artifacts/manifest.json`, including every artifact digest and region mapping.
- The site check verifies the root page plus one county, municipality, ZIP, and county
  report. Samples come from the current `dist/site/search.json`, so the checker does not
  hard-code surrogate region IDs.
- Each sampled page must return HTTP 200, have the expected heading and metadata, and
  have the same normalized text under `<main>` as the local static page. The full-text
  digest makes refreshed figures part of the assertion without hard-coding a figure that
  will become stale at the next refresh.
- Added `SITE_URL` beside the existing deployment settings. `SITE_URL`, `ARTIFACT_URL`,
  `CHECK_LIVE_DIST`, and `CHECK_LIVE_TIMEOUT_MS` can be overridden for another deployment
  or a slower environment.

## Files/modules affected

- `Makefile`
- `web/scripts/check-live.mjs`
- `agent-handoffs/live-deploy-check.md`

## Architectural or implementation decisions

- Playwright is used instead of `curl`. Both production origins deliberately challenge
  script-like HTTP clients (ARCHITECTURE decision 94), while the already-installed
  Playwright browser reaches both successfully.
- The local publish tree is the expected state. This turns freshness into an exact
  local-versus-live comparison and follows future data refreshes automatically.
- Artifact verification is exhaustive at the manifest level. Site verification is
  sampled by page type because downloading and comparing all 2,000-plus pages would make
  a routine post-deploy check unnecessarily expensive.
- Site comparison hashes normalized `<main>` text rather than raw HTML. Cloudflare adds
  challenge and beacon scripts to the response, so the served HTML bytes differ even
  when all application content is identical.
- `check-live` remains separate from `deploy`. Deployment propagation and external
  availability can take time; a failed observation should not obscure whether the upload
  command itself succeeded.
- No dependency was added. The script uses Node built-ins and the Playwright dependency
  introduced by the screenshot-automation spike.

## Assumptions

- `make publish` produced the retained `dist/` tree and that exact tree was uploaded.
- Chromium has been installed for Playwright. A launch failure tells the operator to run
  `cd web && npx playwright install chromium`.
- The deployed pages retain one `<main>` and one `<h1>`. Region and report pages also
  retain their current metadata line; the root page is allowed not to have one.
- The default production origins remain `https://housing.jasonli.app` and
  `https://housing-data.jasonli.app`.

## New TODOs / limitations

- The check makes one attempt with a 45-second timeout. A transient network or Cloudflare
  failure can fail the command; rerun it after confirming the deployment has propagated.
- Only one rendered page per region level and one report are sampled. Exact manifest
  equality covers the entire artifact tree, but the entire HTML tree is not downloaded.
- This is not yet called automatically by `make deploy` or CI. That integration can be
  considered when deployment itself is automated.

## Verification

- `make check-live`
  - Passed against both production origins.
  - Artifact manifest: 5,925 entries from `2026-09-19T23:36:02+00:00`, exactly matching
    the local manifest.
  - Site samples passed: `/`, `/regions/5`, `/regions/415`, `/regions/2842`, and
    `/regions/5/report`.
- `make test`
  - 477 Python tests passed.
  - 23 web test files passed, 198 tests total.
- `make lint`
  - Ruff checks passed.
  - Ruff formatting check passed for 148 files.
  - mypy passed for 88 source files.
- `cd web && npm run typecheck`
  - Passed.
- `node --check web/scripts/check-live.mjs`
  - Passed.
- `git diff --check`
  - Passed.
- `make help`
  - Lists `check-live` with its post-deploy description.
