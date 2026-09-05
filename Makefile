# Housing Intelligence Platform.
# Every target is run from the repo root. `make` on its own lists what is available.

.DEFAULT_GOAL := help
.PHONY: help setup setup-eval venv-fix data-dirs db-up db-down db-logs migrate pipeline publish \
        check-dist deploy api web \
        test test-py test-web lint format check-config dbt-debug eval clean

SITE_PACKAGES = $(wildcard .venv/lib/python*/site-packages)

# Every recipe below runs with src/ on the import path, so nothing depends on the
# editable install's .pth file. uv sets macOS's UF_HIDDEN flag on .pth files and
# CPython's site.py skips hidden .pth files, which silently breaks `import hip` after
# any sync (ARCHITECTURE #24). PYTHONPATH is immune to that and portable.
export PYTHONPATH := $(CURDIR)/src

help:  ## List available targets
	@grep -hE '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) \
		| awk -F':.*## ' '{printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

setup:  ## Install Python and Node dependencies, create local data dirs
	uv sync --group dev --group dbt
	$(MAKE) venv-fix
	@# Asks the config where the tiers are rather than assuming ./data, so a setup run
	@# with HIP_DATA_DIR set does not leave an unused data/ in the repo. Every write
	@# path creates its own parents anyway; this just makes a fresh tree visible.
	$(MAKE) data-dirs
	cd web && npm install
	@test -f .env || (cp .env.example .env && echo "Created .env from .env.example")

setup-eval:  ## Also install the optional mlx + eval groups (Milestone 8, Apple silicon)
	@# `uv sync` makes the environment match exactly the groups named, so syncing
	@# without these REMOVES them — plain `make setup` uninstalls mlx-lm and anthropic.
	@# Run this instead whenever the evaluation harness is needed (ARCHITECTURE #56).
	uv sync --group dev --group dbt --group mlx --group eval
	$(MAKE) venv-fix

eval:  ## Full evaluation: scenarios -> run -> judge -> report (hours; judging costs money)
	@# Split into four commands rather than one because the stages have very different
	@# costs: generation is hours of local inference and resumable, judging is billed.
	uv run hip eval scenarios
	uv run hip eval run
	uv run hip eval judge
	uv run hip eval report

data-dirs:  ## Create the storage tiers wherever the config points them
	@.venv/bin/python -c "\
from pathlib import Path; from hip.config import get_settings; s = get_settings(); \
dirs = [s.raw_dir, s.parquet_dir, s.duckdb_path.parent, s.packets_dir, s.reports_dir / 'validation']; \
[d.mkdir(parents=True, exist_ok=True) for d in dirs]; \
print('\n'.join(str(d) for d in dirs))"

venv-fix:  ## Un-hide .pth files so bare `uv run hip` works (see ARCHITECTURE #24)
	@# Only needed outside make: every make target already exports PYTHONPATH. uv
	@# re-hides these on each sync, so re-run this whenever `uv run hip` starts failing
	@# with ModuleNotFoundError.
	@-chflags nohidden $(SITE_PACKAGES)/*.pth 2>/dev/null || true
	@.venv/bin/python -c "import hip" 2>/dev/null \
		&& echo "venv OK: bare 'uv run hip' works" \
		|| echo "still broken outside make; use make targets, which set PYTHONPATH"

db-up:  ## Start Postgres + PostGIS (requires Docker)
	docker compose up -d
	@echo "Waiting for Postgres to report healthy..."
	@until [ "$$(docker inspect -f '{{.State.Health.Status}}' hip-postgres)" = healthy ]; \
		do sleep 1; done
	@echo "Postgres ready."

db-down:  ## Stop Postgres (data volume is preserved)
	docker compose down

db-logs:  ## Tail Postgres logs
	docker compose logs -f postgres

migrate:  ## Apply Alembic migrations to the warehouse
	uv run alembic upgrade head

pipeline:  ## Full pipeline: acquire -> land -> stage -> geocode -> validate -> load -> analyze -> pack
	@# Each stage persists before the next begins, so any one can be re-run alone.
	@# `validate` is a gate: a non-zero exit here stops the load, and make stops with it.
	uv run hip acquire
	uv run hip land
	uv run hip stage
	uv run hip geocode
	uv run hip validate
	uv run hip load
	uv run hip analyze
	uv run hip pack --report

api:  ## Run the API on http://localhost:8000 (docs at /docs)
	uv run uvicorn hip.api.main:app --reload --port 8000

web:  ## Run the dashboard on http://localhost:3000
	cd web && npm run dev

test:  ## Run both test suites — Python, then the dashboard
	uv run pytest
	@# The dashboard suite covers the pure chart arithmetic. Skipped rather than failed
	@# when node_modules is absent, so `make test` still works before `make setup`.
	@test -d web/node_modules \
		&& (cd web && npm test --silent) \
		|| echo "web/node_modules missing — skipping dashboard tests (run make setup)"

test-py:  ## Run the Python test suite alone
	uv run pytest

test-web:  ## Run the dashboard test suite alone
	cd web && npm test

lint:  ## Lint and type-check
	uv run ruff check .
	uv run ruff format --check .
	uv run mypy

format:  ## Auto-format and apply safe lint fixes
	uv run ruff check --fix .
	uv run ruff format .

check-config:  ## Validate config/*.yml and cross-check them
	uv run hip check-config

dbt-debug:  ## Verify dbt can reach both targets
	uv run dbt debug --project-dir dbt --profiles-dir dbt --target duckdb
	uv run dbt debug --project-dir dbt --profiles-dir dbt --target postgres

# Deployment configuration. In the Makefile rather than in .env on purpose: none of it
# is secret — the artifact URL is embedded in 1,135 public pages — and .env is both
# gitignored and documented as "secrets and paths only, never product configuration".
# Keeping it here means a fresh clone builds correctly instead of silently baking in
# localhost, and one file states where this project deploys. Override per-invocation
# with `make publish ARTIFACT_URL=...` when testing against somewhere else.
#
# The names are fixed rather than passed in because the failure they prevent is a
# mistyped path: `rclone sync` deletes destination files absent from the source, so the
# wrong bucket does not merely upload badly, it erases whatever was there.
R2_BUCKET     ?= housing-artifacts
R2_REMOTE     ?= r2
PAGES_PROJECT ?= housing-intelligence
ARTIFACT_URL  ?= https://housing-data.jasonli.app

publish:  ## Build both halves of the deployable site into dist/
	@# Two directories on purpose, not one merged tree (ARCHITECTURE #68). They go to
	@# different hosts: the HTML to a static page host, which caps files per deployment,
	@# and the JSON/Markdown artifacts to object storage, which does not. Merging them
	@# would fit New Jersey and break at the Northeast.
	@#
	@# The API has to be running: a static export fetches its data at build time. It is
	@# started here and stopped again, so `make publish` is one command rather than two
	@# terminals.
	@echo "Artifact origin: $(ARTIFACT_URL)"
	rm -rf dist
	uv run hip publish --out dist/artifacts
	@echo "Starting the API for the export..."
	@uv run uvicorn hip.api.main:app --port 8000 > /tmp/hip-publish-api.log 2>&1 & \
	  echo $$! > /tmp/hip-publish-api.pid; \
	  until curl -sf http://localhost:8000/health > /dev/null; do sleep 1; done; \
	  echo "API ready."
	@cd web && NEXT_PUBLIC_ARTIFACT_URL=$(ARTIFACT_URL) npm run build; status=$$?; \
	  kill $$(cat /tmp/hip-publish-api.pid) 2>/dev/null; rm -f /tmp/hip-publish-api.pid; \
	  exit $$status
	mkdir -p dist/site && cp -R web/out/. dist/site/
	@echo
	@echo "dist/artifacts  $$(find dist/artifacts -type f | wc -l | tr -d ' ') files, $$(du -sh dist/artifacts | cut -f1)  -> object storage (R2)"
	@echo "dist/site       $$(find dist/site -type f | wc -l | tr -d ' ') files, $$(du -sh dist/site | cut -f1)  -> static host (Pages)"

check-dist:  ## Verify dist/ is complete and was built for production
	@test -f dist/artifacts/manifest.json || { \
	  echo "dist/artifacts/manifest.json missing — run 'make publish' first"; exit 1; }
	@test -f dist/site/index.html || { \
	  echo "dist/site/index.html missing — run 'make publish' first"; exit 1; }
	@# A static export bakes the artifact origin into every page, so localhost in the
	@# output means the whole site would ship with dead download links. Caught here
	@# rather than by a reader clicking one.
	@if grep -rl "localhost:8000" dist/site --include="*.html" | head -1 | grep -q .; then \
	  echo "dist/site contains localhost links — rebuild with:"; \
	  echo "  NEXT_PUBLIC_ARTIFACT_URL=$(ARTIFACT_URL) make publish"; exit 1; fi
	@echo "dist OK: $$(find dist/artifacts -type f | wc -l | tr -d ' ') artifacts, \
$$(find dist/site -type f | wc -l | tr -d ' ') site files"

deploy: check-dist  ## Upload artifacts to R2 and the site to Pages
	rclone sync dist/artifacts $(R2_REMOTE):$(R2_BUCKET) --progress --checksum
	wrangler pages deploy dist/site --project-name=$(PAGES_PROJECT)

clean:  ## Remove build artifacts and caches (leaves data/ alone)
	rm -rf .pytest_cache .mypy_cache .ruff_cache dbt/target dbt/logs web/.next web/out dist
	find . -type d -name __pycache__ -not -path './.venv/*' -exec rm -rf {} +
