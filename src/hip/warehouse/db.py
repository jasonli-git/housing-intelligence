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
    """Process-wide engine. Short connect timeout so /health fails fast, not hangs."""
    return create_engine(
        get_settings().database_url,
        pool_pre_ping=True,
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
