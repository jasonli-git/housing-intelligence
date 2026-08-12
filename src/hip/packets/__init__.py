"""Analysis packets: the compact, versioned contract the analytics layer emits.

The last stage of the pipeline (ARCHITECTURE #12). A packet is small enough to hand to a
model, fully computed before it is written, and validated against the schema published
in `schemas/packet-v1.json`.

Nothing in Version 1 sends a packet to an LLM — that runtime is deliberately unchosen
until the Milestone 8 evaluation (#11). The report renderer and the dashboard's report
page are the first consumers, which is the point: the contract gets exercised by real
readers before a model shapes it.
"""

from hip.packets.assemble import (
    PacketUnavailable,
    build_packet,
    display_label,
    regions_for_level,
)
from hip.packets.caveats import caveats_for
from hip.packets.report import format_change, format_value, render_markdown
from hip.packets.schema import (
    PACKET_VERSION,
    SCHEMA_PATH,
    Packet,
    published_schema,
    schema_text,
)

__all__ = [
    "PACKET_VERSION",
    "SCHEMA_PATH",
    "Packet",
    "PacketUnavailable",
    "build_packet",
    "caveats_for",
    "display_label",
    "format_change",
    "format_value",
    "published_schema",
    "regions_for_level",
    "render_markdown",
    "schema_text",
]
