"""`NOTICE`'s list of sources, generated from `config/sources.yml`.

The file's opening — the code's licence, the data's terms, the non-commercial
restriction — is written by hand and kept as it is. Everything from `## Sources` on is
this module's: one entry per source the platform fetches, so a source added to the
registry is listed the next time `hip notice` runs, and `tests/test_notice.py` fails
until it has. Before this existed the file said it was generated and listed 12 of 37
sources (found 2026-10-06).
"""

from __future__ import annotations

from hip.config import Source

SOURCES_HEADING = "## Sources"

# The platform's own computed figures are not a third party to credit.
_NOT_LISTED = {"hip_derived"}

FOOTER = """---

Everything from `## Sources` on is generated from `config/sources.yml`, the single
registry the pipeline, the API, the packets and the website footer all read, by
`hip notice`. Re-run it rather than hand-editing when a source is added.
"""


def sources_section(sources: dict[str, Source], planned: set[str]) -> str:
    """`## Sources` and the footer: each fetched source by name, its publisher, terms
    and the page a person should read."""
    listed = sorted(
        (s for sid, s in sources.items() if sid not in _NOT_LISTED | planned),
        key=lambda s: s.name.lower(),
    )
    parts = [SOURCES_HEADING, ""]
    for s in listed:
        parts += [
            f"### {s.name}",
            "",
            f"- Publisher: {s.publisher}",
            f"- Terms: {s.license}",
            f"- {s.homepage or s.url}",
            "",
        ]
    return "\n".join(parts) + "\n" + FOOTER


def render(current: str, sources: dict[str, Source], planned: set[str]) -> str:
    """`NOTICE` with its hand-written opening kept and its source list regenerated."""
    head, _, _ = current.partition(SOURCES_HEADING)
    return head + sources_section(sources, planned)
