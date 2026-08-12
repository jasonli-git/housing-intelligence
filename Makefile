# Housing Intelligence Platform.
# Every target is run from the repo root. `make` on its own lists what is available.

.DEFAULT_GOAL := help
.PHONY: help setup venv-fix db-up db-down db-logs migrate pipeline api web test lint \
        format check-config dbt-debug clean

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
	mkdir -p data/raw data/parquet data/duckdb data/packets reports/validation
	cd web && npm install
	@test -f .env || (cp .env.example .env && echo "Created .env from .env.example")

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

pipeline:  ## Full pipeline: acquire -> land -> stage -> geocode -> validate -> load -> analyze
	@# Each stage persists before the next begins, so any one can be re-run alone.
	@# `validate` is a gate: a non-zero exit here stops the load, and make stops with it.
	uv run hip acquire
	uv run hip land
	uv run hip stage
	uv run hip geocode
	uv run hip validate
	uv run hip load
	uv run hip analyze

api:  ## Run the API on http://localhost:8000 (docs at /docs)
	uv run uvicorn hip.api.main:app --reload --port 8000

web:  ## Run the dashboard on http://localhost:3000
	cd web && npm run dev

test:  ## Run the Python test suite
	uv run pytest

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

clean:  ## Remove build artifacts and caches (leaves data/ alone)
	rm -rf .pytest_cache .mypy_cache .ruff_cache dbt/target dbt/logs web/.next
	find . -type d -name __pycache__ -not -path './.venv/*' -exec rm -rf {} +
