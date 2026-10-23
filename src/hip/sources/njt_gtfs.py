"""NJ Transit's timetables, as GTFS, downloaded by hand (the visual stories, 2026-10-23).

NJ Transit publishes its rail and bus schedules as two GTFS zips behind a free developer
registration (developer.njtransit.com), whose agreement the owner accepted. The owner
downloads both into `data/manual/njt_gtfs/` (the manual-source path, ARCHITECTURE #272);
acquisition copies each in, and landing unpacks the five tables a travel time needs
(`hip.landing.gtfs`).

The agreement forbids modifying the feed or presenting it as accurate, complete or
timely; nothing here republishes the feed. The story publishes scheduled times derived
from it, says they are scheduled rather than real, and credits NJ Transit as the
source, which the agreement allows, without its logo or any suggestion that NJ Transit
endorses the site.
"""

from __future__ import annotations

import shutil
from datetime import timedelta
from pathlib import Path
from typing import ClassVar

from hip.sources.base import ReleaseRef, SourceAdapter, SourceError

PATTERNS = {"rail": "*rail*.zip", "bus": "*bus*.zip"}


class NjtGtfsAdapter(SourceAdapter):
    source_id: ClassVar[str] = "njt_gtfs"
    default_vintage: ClassVar[str] = "current"
    landing_format: ClassVar[str] = "gtfs"
    manual: ClassVar[bool] = True
    manual_from: ClassVar[str | None] = "https://developer.njtransit.com/"
    states: ClassVar[tuple[str, ...] | None] = ("NJ",)
    # Republished with each schedule change, several times a year.
    revalidate_after: ClassVar[timedelta] = timedelta(days=30)

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        return [
            ReleaseRef(
                source_id=self.source_id,
                layer=layer,
                vintage=vintage or self.default_vintage,
                url=self.manual_from or "",
            )
            for layer in PATTERNS
        ]

    @classmethod
    def filename(cls, ref: ReleaseRef) -> str:
        return f"{ref.layer}.zip"

    def manual_path(self, ref: ReleaseRef, raw_dir: Path) -> Path:
        folder = raw_dir.parent / "manual" / ref.source_id
        found = sorted(folder.glob(PATTERNS[ref.layer])) if folder.exists() else []
        return found[-1] if found else folder / f"{ref.layer}_data.zip"

    def _fetch_bytes(self, ref: ReleaseRef, destination: Path) -> None:
        if self._manual_dir is None:
            raise SourceError(f"{ref.source_id}: no downloaded file was found")
        found = sorted(self._manual_dir.glob(PATTERNS[ref.layer]))
        if not found:
            raise SourceError(f"{ref.source_id}: nothing matching {PATTERNS[ref.layer]}")
        shutil.copyfile(found[-1], destination)
        self._last_validators = {}
