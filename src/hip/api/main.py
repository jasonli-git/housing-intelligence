"""FastAPI application.

Read-only by construction (ARCHITECTURE #6): this package may import ``hip.warehouse``
and ``hip.packets`` and nothing else from the pipeline, which
``tests/test_module_boundaries.py`` enforces.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from hip import __version__
from hip.api.routers import health, regions

app = FastAPI(
    title="Housing Intelligence Platform API",
    version=__version__,
    summary="Read-only access to the NJ housing warehouse.",
)

# The dashboard is a separate origin (ARCHITECTURE #5). Dev origins only; a deployed
# frontend origin gets added when there is one.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(regions.router)
