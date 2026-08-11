# Housing Intelligence Platform.
# Every target is run from the repo root. `make` on its own lists what is available.

.DEFAULT_GOAL := help
.PHONY: help setup db-up db-down db-logs migrate api web test lint format \
        check-config dbt-debug clean

help:  ## List available targets
	@grep -hE '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) \
		| awk -F':.*## ' '{printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

setup:  ## Install Python and Node dependencies, create local data dirs
	uv sync --group dev --group dbt
	mkdir -p data/raw data/parquet data/duckdb data/packets reports/validation
	cd web && npm install
	@test -f .env || (cp .env.example .env && echo "Created .env from .env.example")

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
