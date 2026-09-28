"""The reading cleanup query, without requiring a running warehouse."""

from __future__ import annotations

from typing import Any

from sqlalchemy.dialects import postgresql

from hip.eval.explain import prune


class _QuerySession:
    def __init__(self) -> None:
        self.query: Any = None

    def execute(self, query: Any) -> Any:
        self.query = query
        return _NoRows()


class _NoRows:
    def tuples(self) -> list[Any]:
        return []


def test_single_audience_cleanup_only_selects_that_audience() -> None:
    session = _QuerySession()

    assert prune(session, [11], "5y", {"consumer": {"preferred-model"}}) == {}  # type: ignore[arg-type]

    query = str(
        session.query.compile(
            dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}
        )
    )
    assert "region_explanations.audience IN ('consumer')" in query
    assert "('consumer', 'preferred-model')" in query
