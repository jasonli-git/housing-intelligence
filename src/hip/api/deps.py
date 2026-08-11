"""FastAPI dependencies.

The only database access the API has is a read-only session. Nothing here can write,
and this package may not import any pipeline stage other than `warehouse` and `packets`
(ARCHITECTURE #6, enforced by tests/test_module_boundaries.py).
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from hip.warehouse.db import session_scope


def get_session() -> Iterator[Session]:
    yield from session_scope()


SessionDep = Annotated[Session, Depends(get_session)]
