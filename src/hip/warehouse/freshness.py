"""How fresh each source is, for a public page (Milestone 27).

Built from `source_discoveries` (`load_discoveries`, this module's write side),
`source_releases` (when it was acquired) and `config/sources.yml` (what to do the day
it stops answering) — because the whole reason this page exists is that *checked
today* must never read as *measured today*, and inventing a number to fill a gap would
be exactly that.

**Four statuses, not the six once sketched, and why the other two are not here.**
`current`, `pending` and `unreachable` come straight from the discovery row's
`outcome` and `pending`. `not_tracked` is no row at all, which is the honest answer
for three different reasons this page cannot tell apart without more than
`source_discoveries` records: a source Milestone 26 never gave a `discover()` — most
of them are `current`-vintage (Zillow, FRED, FHFA), fresh-checked every refresh by
*revalidation* (ARCHITECTURE #188 — "has this exact file changed", a different
question from discovery's "does something newer exist") rather than discovery, and
whose check timestamp is not durably recorded anywhere this page reads from yet; a
source pinned on purpose, like `census_tiger` (#206); or a source never fetched at
all, like `njgin_parcels` (its own `fallback` says so). None of the three means
neglect, so `not_tracked` says "no discovery record", not "not checked" — a claim
this page cannot back for the first case.

*Delayed* would need a per-source expected-release calendar this platform does not
keep — MOD-IV's own history (2019, 2021, 2022, 2023, 2024, 2025, no fixed month) is
exactly the case where guessing one would read as more precision than exists.
*Superseded* would need this page to join `fact_revision`, which is the "what changed"
page's job, not this one's. Both are recorded here as what they need, not faked to
fill out a list.

**"Next expected" is the discovery row's own `pending_from`, or nothing.** A source
with a pending release already states its own next date; a source without one gets no
invented schedule, for the same reason `nj_modiv`'s real next-publication date —
known only from a private email — stays out of this file entirely and out of every
public page. `config/sources.yml`'s `notes` field is never read here.
"""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
from typing import Literal

from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from hip import __version__
from hip.config import REPO_ROOT, Source

Status = Literal["current", "pending", "unreachable", "not_tracked"]


class SourceFreshness(BaseModel):
    source_id: str
    name: str
    publisher: str
    cadence: str
    fallback: str
    status: Status
    # The newest period actually loaded into the warehouse, not merely discovered — a
    # refresh can find a newer release and not yet have processed it.
    period_observed_start: str | None = None
    period_observed_end: str | None = None
    # What the publisher itself said, read at acquisition (`source_discoveries`).
    published: str | None = None
    checked_at: datetime | None = None
    pending: str | None = None
    pending_from: str | None = None
    # When this source's data was last downloaded, from `source_releases`.
    acquired_at: datetime | None = None


class FreshnessReport(BaseModel):
    site_version: str
    generated_at: datetime
    sources: list[SourceFreshness]


def _status(discovery: dict[str, object] | None) -> Status:
    if discovery is None:
        return "not_tracked"
    if discovery["outcome"] == "unreachable":
        return "unreachable"
    if discovery["pending"]:
        return "pending"
    return "current"


def _changelog_version(changelog_path: Path) -> str:
    """The newest `## [X.Y.Z]` heading in CHANGELOG.md, the site's own version record.

    `hip.__version__` reads installed package metadata, which this project has never
    bumped alongside a release (`pyproject.toml` stays at a dev placeholder) — the
    changelog is the one file a version actually gets written to.
    """
    if changelog_path.exists():
        for line in changelog_path.read_text().splitlines():
            if line.startswith("## ["):
                return line[4 : line.index("]")]
    return __version__


def build_report(
    session: Session,
    sources: dict[str, Source],
    changelog_path: Path | None = None,
) -> FreshnessReport:
    changelog_path = (
        changelog_path if changelog_path is not None else REPO_ROOT / "CHANGELOG.md"
    )

    discoveries = {
        row["source_id"]: dict(row)
        for row in session.execute(
            text(
                """
                SELECT source_id, outcome, published, checked_at, pending, pending_from
                FROM source_discoveries
                """
            )
        ).mappings()
    }
    observed = {
        row["source_id"]: (row["start"], row["end"])
        for row in session.execute(
            text(
                """
                SELECT m.source_id,
                       min(f.period_start)::text AS start,
                       max(f.period_end)::text AS "end"
                FROM fact_metric_observation f
                JOIN metrics m ON m.metric_id = f.metric_id
                GROUP BY m.source_id
                """
            )
        ).mappings()
    }
    acquired = {
        row["source_id"]: row["fetched_at"]
        for row in session.execute(
            text(
                """
                SELECT source_id, max(fetched_at) AS fetched_at
                FROM source_releases
                GROUP BY source_id
                """
            )
        ).mappings()
    }

    rows = []
    for source_id, source in sorted(sources.items()):
        discovery = discoveries.get(source_id)
        start, end = observed.get(source_id, (None, None))
        rows.append(
            SourceFreshness(
                source_id=source_id,
                name=source.name,
                publisher=source.publisher,
                cadence=source.cadence,
                fallback=source.fallback,
                status=_status(discovery),
                period_observed_start=start,
                period_observed_end=end,
                published=discovery["published"] if discovery else None,
                checked_at=discovery["checked_at"] if discovery else None,
                pending=discovery["pending"] if discovery else None,
                pending_from=(
                    discovery["pending_from"].isoformat()
                    if discovery and discovery["pending_from"]
                    else None
                ),
                acquired_at=acquired.get(source_id),
            )
        )

    return FreshnessReport(
        site_version=_changelog_version(changelog_path),
        generated_at=datetime.now(UTC),
        sources=rows,
    )
