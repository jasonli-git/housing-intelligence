"""The analysis packet, and the report rendered from it.

Both endpoints assemble from Postgres on request rather than serving the files
`hip pack` writes. The two would drift the moment the pipeline ran without a re-pack,
and a stale packet served as current is exactly the failure the provenance fields exist
to prevent. `hip pack` produces durable artifacts for consumers that need files —
fixtures, the Milestone 8 evaluation, anything offline; the API answers for the
warehouse as it stands.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import PlainTextResponse

from hip.api.deps import SessionDep
from hip.api.params import Window
from hip.packets import Packet, PacketUnavailable, build_packet, render_markdown

router = APIRouter(tags=["packets"])


@router.get(
    "/regions/{region_id}/packet",
    response_model=Packet,
    summary="Analysis packet for a region",
)
def packet(
    region_id: int,
    session: SessionDep,
    window: Annotated[Window, Query()] = "5y",
) -> Packet:
    """Every computed figure for one region, with its ranks, caveats, and sources.

    The schema is published at `schemas/packet-v1.json` and versioned by
    `packet_version`.
    """
    try:
        return build_packet(session, region_id, window)
    except PacketUnavailable as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get(
    "/regions/{region_id}/report",
    response_class=PlainTextResponse,
    summary="Markdown report for a region",
    responses={200: {"content": {"text/markdown": {}}}},
)
def report(
    region_id: int,
    session: SessionDep,
    window: Annotated[Window, Query()] = "5y",
) -> PlainTextResponse:
    """The same packet rendered as a Markdown document, ready to save or print."""
    try:
        rendered = render_markdown(build_packet(session, region_id, window))
    except PacketUnavailable as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return PlainTextResponse(rendered, media_type="text/markdown; charset=utf-8")
