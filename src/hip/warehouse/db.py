"""PostgreSQL engine, sessions, and a connectivity probe.

The warehouse is the only thing the API reads (ARCHITECTURE #6). Nothing here creates
schema — that is Alembic's job, so a probe against an empty database succeeds at the
connection level and reports no loads, rather than failing.
"""

from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass
from datetime import datetime
from functools import lru_cache

from sqlalchemy import Engine, create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

from hip.config import get_settings


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    """Process-wide engine. Short connect timeout so /health fails fast, not hangs.

    The pool is sized explicitly rather than left at SQLAlchemy's default of 5 with 10
    overflow. That default was never chosen — it was simply never hit, because until
    2026-09-02 the only client was a dashboard serving one reader at a time. The first
    genuinely concurrent workload, a static export rendering 2,273 pages across six
    worker processes, exhausted it in minutes: requests queued the full 30-second pool
    timeout, page renders passed their own 60-second deadline, Next retried them, and
    the added load kept the pool empty. The API stopped answering entirely, including
    `/health`.

    40 connections against PostgreSQL's default `max_connections` of 100 leaves room for
    psql, dbt, and a second process, while covering a build that fans out much wider
    than any human ever will. Read-only sessions hold a connection only for the length
    of one query (#6), so this is headroom for concurrency, not for leaks.
    """
    return create_engine(
        get_settings().database_url,
        pool_pre_ping=True,
        pool_size=20,
        max_overflow=20,
        # Fail a starved request in 10s rather than 30. A caller that cannot get a
        # connection should learn quickly enough to retry inside its own deadline.
        pool_timeout=10,
        connect_args={"connect_timeout": 3},
    )


@lru_cache(maxsize=1)
def _session_factory() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), expire_on_commit=False)


def session_scope() -> Iterator[Session]:
    """Yield a session and always close it. The API binds this as a dependency."""
    session = _session_factory()()
    try:
        yield session
    finally:
        session.close()


@dataclass(frozen=True)
class DatabaseStatus:
    """What /health reports about the warehouse."""

    connected: bool
    error: str | None = None
    last_load_at: datetime | None = None
    migrated: bool = False


def probe() -> DatabaseStatus:
    """Check connectivity and the most recent load, degrading instead of raising.

    Three distinct states a reader cares about, and they are not the same thing:
    unreachable (no Postgres), reachable but unmigrated (no tables yet), and migrated
    but empty (schema exists, nothing loaded).
    """
    try:
        with get_engine().connect() as conn:
            conn.execute(text("SELECT 1"))
            try:
                result = conn.execute(
                    text("SELECT max(fetched_at) FROM source_releases")
                ).scalar_one_or_none()
            except SQLAlchemyError:
                # Expected until Milestone 1 creates the table.
                return DatabaseStatus(connected=True, migrated=False)
            return DatabaseStatus(connected=True, migrated=True, last_load_at=result)
    except SQLAlchemyError as exc:
        return DatabaseStatus(connected=False, error=type(exc).__name__)
