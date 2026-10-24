# Screenshot automation investigation

## What changed

This was an investigation and a deliberately small proof of concept, not a screenshot
pipeline.

- Added Playwright 1.63.0 as a development dependency of `web/`.
- Added `web/scripts/capture-screenshot.mjs` and the `npm run screenshot:poc`
  command.
- Captured one 1440x1000 viewport of the Bergen County page to
  `agent-handoffs/artifacts/screenshot-automation-poc.png`.
- Verified, without committing a second image, that the same script works at a
  375x812 mobile viewport.
- Did not add `.github/`, change the GitHub ruleset, modify any canonical document,
  or implement orchestration, PR creation, deployment, or a multi-page capture set.

### Conclusion

Desktop and mobile capture are both feasible. The browser work is cheap. The blocking
cost is making this repository's data-backed build reproducible on a fresh CI runner.

For now, choose **(d): do not automate screenshots on every push to `main`**. Keep the
small capture command for intentional/manual refreshes. If deployment later becomes
automated, **(c) is the best target**: capture the completed static export and publish
the images with the deployed site. If screenshots must remain committed for review and
history, use **(a), a bot-opened PR**, after supplying CI with a maintained database
snapshot. Do not use **(b), a ruleset bypass**, for README images.

## Files/modules affected

- `web/package.json`
  - Adds `screenshot:poc` and the `playwright` development dependency.
- `web/package-lock.json`
  - Locks `playwright` and `playwright-core` at 1.63.0.
- `web/scripts/capture-screenshot.mjs`
  - Opens `http://localhost:3000/regions/8` by default.
  - Uses a fixed light theme, reduced motion, a 1x device scale, and a 1440x1000
    viewport.
  - Waits for network idle, local fonts, and the expected `Bergen County` heading.
  - Disables animation and transition effects before capturing the viewport.
  - Accepts `SCREENSHOT_URL`, `SCREENSHOT_OUTPUT`, `SCREENSHOT_WIDTH`, and
    `SCREENSHOT_HEIGHT` overrides.
- `agent-handoffs/artifacts/screenshot-automation-poc.png`
  - The 126 KB proof image; it is not one of the README's production screenshots.
- `agent-handoffs/screenshot-automation.md`
  - This investigation.

No canonical files were changed.

## Architectural or implementation decisions

### Verified repository state

- `.github/` is absent and no CI workflow is tracked.
- `web/package.json` previously contained Next 16.3.0, React 19.2.8,
  TypeScript 7.0.2, and Vitest 3.2.7, with no browser automation package.
- The eight files in `screenshots/` total 2.2 MB. Git history shows them entering as
  binary-only additions in the 2026-08-14 `Add screenshots` and
  `Add screenshots and publish reports` commits; no generator is present.
- `make api` runs FastAPI on port 8000 and `make web` runs Next on port 3000.
  The page fetch layer defaults to `http://localhost:8000` during server rendering.
- `make publish` starts FastAPI for the Next static export, then stops it. The browser
  does not need FastAPI after the export has been written.
- The current export is large in storage but quick to render on this machine:
  5,918 data artifacts / 109 MB plus 13,659 site files / 653 MB.
- The repository is public. Its active `protect main` ruleset targets the default
  branch, requires a pull request, blocks deletion, and blocks non-fast-forward pushes.
  The public ruleset API currently reports `bypass_actors: null`. It requires zero
  approving reviews and has no required status-check rule.

### The data prerequisite is the real CI constraint

A clean checkout does not contain enough state to run a meaningful local API:

- `data/` is ignored and is 3.2 GB in this checkout.
- The local analytical DuckDB file is 77 MB, but FastAPI defaults to PostgreSQL rather
  than reading that DuckDB file.
- The running PostGIS image is 853 MB and the populated Docker volume is 879 MB.
- There is no tracked database dump, remote restore step, or CI seed fixture.
- Running the complete acquisition pipeline on every push is not credible: it needs
  external API credentials and multiple source downloads; the documented NJ parcel
  acquisition alone takes about 32 minutes.

Therefore a workflow cannot simply run `make api && make web` on a fresh runner. It
would first need one of the following, none of which exists today:

1. A versioned, compressed PostgreSQL snapshot stored outside Git, with restore and
   freshness procedures.
2. A small, deterministic screenshot fixture database that is explicitly accepted as
   representative rather than current production data.
3. A deployment-complete event and permission to capture the already-deployed site.

Pointing the Next server directly at the public artifact bucket is not a drop-in
replacement. The application fetches API-shaped paths and query strings, while the
published object tree uses `.json` files and pre-expanded keys. Capturing the public
site itself works, but it captures the deployed revision, not necessarily the `main`
commit that triggered the run.

### Proof-of-concept design

The spike uses the `playwright` library directly instead of adopting the larger
Playwright Test configuration and report surface. It assumes the services are already
running; startup, retries, workflow triggers, multiple routes, and PR creation are
intentionally out of scope.

Local usage:

```text
# terminal 1, repository root
make api

# terminal 2, repository root
make web

# once per machine, from web/
npx playwright install chromium --only-shell

# from web/
npm run screenshot:poc
```

Mobile feasibility uses the same code:

```text
SCREENSHOT_WIDTH=375 SCREENSHOT_HEIGHT=812 \
SCREENSHOT_OUTPUT=/tmp/housing-screenshot-mobile.png \
npm run screenshot:poc
```

The production-export variant was also tested successfully:

```text
npm run build
python3 -m http.server 3001 --bind 127.0.0.1 --directory out
SCREENSHOT_URL=http://127.0.0.1:3001/regions/8.html npm run screenshot:poc
```

The static-export capture and the development-server capture were byte-identical in
this environment.

### Alternatives and costs

All estimates below are per run on a standard Linux GitHub-hosted runner. They are
ranges, not measured GitHub Actions billing records. This public repository receives
standard hosted-runner usage without a direct minutes charge, but runner time and
network transfer remain real operational costs.

| Option | Workable? | Expected runner time | Extra state / dependencies | Risk and maintenance |
|---|---|---:|---|---|
| **(a) CI opens a screenshot PR** | Yes, after solving data provisioning. It naturally satisfies the current ruleset because the bot pushes a non-protected branch and opens a PR. | **1-3 min** if it captures an already-deployed URL; approximately **5-15 min** for a true checkout build with a maintained DB snapshot. A full acquisition pipeline would be much longer and should not run per push. | `contents: write` and `pull-requests: write`; repository setting allowing Actions to create PRs; Playwright; Chromium; for a local build, a PostgreSQL snapshot plus PostGIS. | **Medium.** PR noise and binary churn; a fixed automation branch, concurrency guard, and no-diff exit are needed. PRs created with `GITHUB_TOKEN` have special follow-on workflow behavior, so required checks must be tested or triggered with a GitHub App token. Best choice if images must remain reviewed Git objects. |
| **(b) CI bypasses the ruleset** | Technically, but not as configured: there is no bypass actor. An eligible GitHub App or privileged user identity must be added. | Same compute as (a). | App/PAT credentials, bypass configuration, secret rotation, and a loop guard so the bot's screenshot commit does not trigger itself forever. | **High. Not recommended.** It removes the PR review/audit boundary for an image-refresh job. If ever used, split the pull-request rule from deletion/non-fast-forward rules so the app cannot bypass all three protections together. |
| **(c) Generate at build/deploy time, never commit** | Yes, and technically the cleanest. Capture `web/out` after the successful static export and publish images at stable site or object-storage URLs. It does not conflict with the ruleset. | On the prepared local machine, the current Next export was **13.71 s** and one capture was **3.52 s**. On a fresh runner, add dependency/browser download and whatever time provisions the API/database. | Same browser dependency; stable hosting paths and cache headers. The README would need a one-time future change from relative Git paths to remote image URLs. | **Low-medium after deployment is automated.** No Git churn and the picture matches deployed bytes. Today there is no push-triggered deploy, so it would update only when the existing manual publish/deploy path runs. Remote URL/CDN caching and deploy ordering must be explicit. |
| **(d) Do not automate** | Yes; this is the recommendation now. Use the POC command only when a visual change or data release warrants it. | No CI minutes. About **4 s per viewport** after the local services are ready. | Playwright and a local browser if the spike is retained. | **Low operational cost, medium staleness risk.** A human must notice when screenshots no longer represent the product. |

### Common browser cost

- `playwright` plus `playwright-core`: 18,547,881 unpacked bytes (about 18.5 MB).
- Current Linux Chromium headless-shell download: 119,809,080 bytes.
- Current Linux FFmpeg helper download: 2,376,500 bytes.
- Total fresh browser download: about 122.2 MB. Playwright recommends installing
  Chromium alone for this use and does not generally recommend caching browser binaries,
  because restore time is comparable to download time.
- The extracted macOS headless shell measured about 200 MB; Linux will differ.
- The measured desktop PNG is 126 KB and the uncommitted mobile PNG is 63 KB. Two
  viewports add seconds, not minutes, once Chromium and the page server are ready.

At 20 `main` pushes per month, the capture-existing-site variant would consume roughly
20-60 runner minutes. A snapshot-backed local build at the rough 5-15 minute range would
consume roughly 100-300 runner minutes. The public repository would not currently incur
a standard-runner minutes bill, but the latter still spends far more compute and moves
roughly gigabyte-scale database/container state unless optimized.

### Flakiness assessment

- **Same-environment determinism:** low risk. Two consecutive desktop captures were
  byte-identical, and the static-export capture matched them exactly.
- **Desktop and mobile:** both feasible with one Chromium process and two contexts or
  pages; mobile does not require a different browser binary.
- **Cross-platform rendering:** medium risk. Chromium versions, operating systems, and
  font rasterization can change pixels. Generate and maintain all committed baselines in
  one pinned Linux environment; do not mix local macOS and CI Linux output.
- **Service readiness:** medium risk if using development servers. Wait explicitly for
  API health and the web URL; a process merely listening is not enough.
- **Client-rendered visuals:** medium risk for the home-page map. It needs a semantic
  ready condition after hydration, not an arbitrary sleep. The region-page POC avoids
  inventing that condition for a full pipeline that was out of scope.
- **Data churn:** expected rather than flaky. A fresh data release can legitimately
  change text and geometry even when no frontend code changed.
- **External/deployed capture:** medium-high risk until deploy ordering is defined;
  CDN propagation, a stale deployment, or transient network failure can create the
  wrong PR.

### Recommended future sequence

1. Decide whether README images should represent **reviewed source history** or the
   **currently deployed product**.
2. If deployed product is the answer, automate deployment first, then implement (c):
   capture the finished export, publish desktop and mobile images under stable URLs,
   and update the README once in a separately approved documentation task.
3. If reviewed source history is the answer, define a portable data snapshot first,
   then implement (a) with a fixed bot branch, no-diff exit, concurrency cancellation,
   least-privilege token permissions, and human review.
4. Do not add a bypass for this purpose.

### External references checked (2026-09-19)

- GitHub ruleset bypass eligibility and PR-only bypass mode:
  <https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository>
- GitHub Actions workflow permissions and the repository opt-in for bot-created PRs:
  <https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository>
- `GITHUB_TOKEN` follow-on event behavior:
  <https://docs.github.com/en/actions/concepts/security/github_token>
- GitHub Actions billing for public repositories:
  <https://docs.github.com/en/billing/concepts/product-billing/github-actions>
- Playwright CI installation and caching guidance:
  <https://playwright.dev/docs/ci>
- Playwright screenshot environment variability:
  <https://playwright.dev/docs/test-snapshots>

## Assumptions

- The desired screenshots are documentation images, not pixel-diff test baselines.
- A screenshot created after a deployment may be preferable to one created from an
  unmerged or not-yet-deployed commit, but product ownership must confirm that choice.
- A future automation may add a stable, access-controlled PostgreSQL snapshot; this
  investigation did not create, upload, or choose a storage location for one.
- CI would use a standard Linux GitHub-hosted runner and install only Chromium's
  headless shell.
- The existing production domains and Cloudflare deployment remain the likely host for
  option (c), but no Cloudflare configuration was changed or authenticated in this task.

## New TODOs / limitations

- Decide between source-history screenshots (option a) and deployed-state screenshots
  (option c).
- Do not schedule per-push capture until CI has either a portable DB snapshot or an
  authoritative deployment-complete trigger.
- If adopting option (a), verify the repository's current
  `Allow GitHub Actions to create and approve pull requests` setting while authenticated;
  public read access cannot reveal that setting.
- If adopting option (a), decide whether `GITHUB_TOKEN`'s approval-gated follow-on runs
  are acceptable. Use a narrowly scoped GitHub App rather than a personal access token
  if ordinary PR workflow triggering is required.
- If adopting option (c), choose stable public asset URLs and cache policy, and obtain
  separate approval before changing `README.md`.
- Define semantic ready conditions for any future map, chart, disclosure, dark-mode, or
  print captures. Do not replace them with fixed sleeps.
- Pin the CI operating system, Node major, Playwright version, viewport, device scale,
  color scheme, and locale before treating image diffs as meaningful.
- The POC hard-codes Bergen County as its success assertion and is intentionally not a
  general capture manifest.
- `npm audit` reports four advisories in the existing Next/Vitest dependency tree
  (two moderate, one high, one critical). The lockfile diff adds only Playwright and
  Playwright Core; neither appears in the audit findings. Dependency remediation was
  outside this investigation.

## Verification

- Commands run:
  - `git branch --show-current`
  - `git status --short`
  - repository/file/dependency searches with `rg`
  - Git history inspection for `screenshots/`
  - public GitHub ruleset page and API inspection
  - `make api` / `curl http://127.0.0.1:8000/health`
  - `make web`
  - `npx playwright install chromium --only-shell --dry-run`
  - `npx playwright install chromium --only-shell`
  - `npm run screenshot:poc`
  - mobile capture with 375x812 environment overrides
  - repeat desktop capture followed by `cmp`
  - static-export capture followed by `cmp`
  - `node --check scripts/capture-screenshot.mjs`
  - `npm run typecheck`
  - `npm test -- --run`
  - `npm run build`
  - `npm audit --json`
  - `git diff --check`
- Results:
  - Local API health: connected and migrated; existing server was already using port
    8000, so a second `make api` correctly failed with `Address already in use`.
  - Next development server: ready in 203 ms on the warm local install.
  - Desktop capture: 1440x1000, 126 KB, completed in 3.52 s.
  - Mobile capture: 375x812, 63 KB, rendered correctly; not committed.
  - Repeated desktop capture: byte-identical SHA-256
    `719605cf3afe8e17d5535c9b37c1236493e94ab34e685e41f259a32954748ead`.
  - Static-export capture: the same byte-identical SHA-256.
  - TypeScript: passed.
  - Vitest: 23 files and 198 tests passed.
  - Production Next export: 2,274 pages generated successfully in 13.71 s. The expected
    local-only warning noted that `NEXT_PUBLIC_ARTIFACT_URL` was unset; no deploy ran.
  - `npm audit`: exited non-zero with four pre-existing, non-Playwright advisories as
    described above.
  - `git diff --check`: passed.
