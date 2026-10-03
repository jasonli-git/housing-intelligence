"""EPA's Safe Drinking Water Information System: health-based violations by New Jersey
water systems (Milestone 40).

States report every public water system's violations to EPA, which publishes them
through Envirofacts. A *health-based* violation is a contaminant over its legal limit
(MCL or MRDL) or a required treatment not done (TT); missed monitoring and late
reports are not. 2,891 for New Jersey on 2026-10-02, across every system type; the
site uses community systems, the ones that serve homes year-round.

Violations carry codes, and EPA names them in `SDWA_REF_CODE_VALUES.csv`, inside ECHO's
424MB SDWA download. Only that 125KB file is read, by HTTP range requests against the
zip's central directory, so the names are EPA's own rather than a table kept here.

**What it does not hold.** Violations of standards New Jersey sets beyond EPA's — its
PFOA, PFOS and PFNA limits came first — reach SDWIS only where the state reports them,
and none of the 2021–2026 records carries a PFAS code. The site says so and links
NJDEP's Drinking Water Watch, which does. Federal government work, public domain.
"""

from __future__ import annotations

import csv
import io
import json
import struct
import zlib
from datetime import timedelta
from pathlib import Path
from typing import ClassVar

import httpx

from hip.sources.base import ReleaseRef, SourceAdapter, SourceError

ENVIROFACTS = "https://data.epa.gov/efservice"
VIOLATIONS_URL = f"{ENVIROFACTS}/VIOLATION/PRIMACY_AGENCY_CODE/NJ/IS_HEALTH_BASED_IND/Y"
ECHO_ZIP = "https://echo.epa.gov/files/echodownloads/SDWA_latest_downloads.zip"
CODES_MEMBER = "SDWA_REF_CODE_VALUES.csv"
# The code types a violation is named by.
CODE_TYPES = frozenset({"CONTAMINANT_CODE", "RULE_FAMILY_CODE"})

VIOLATION_FIELDS = (
    "pwsid",
    "violation_id",
    "pws_type_code",
    "violation_category_code",
    "contaminant_code",
    "rule_family_code",
    "compl_per_begin_date",
    "compl_per_end_date",
    "rtc_date",
)

_PAGE = 5000


def zip_member(client: httpx.Client, url: str, member: str) -> bytes:
    """One file out of a remote zip, read by range: the central directory from the end
    of the archive, then the member's own bytes."""
    size = int(client.head(url).headers["content-length"])

    def ranged(start: int, end: int) -> bytes:
        response = client.get(url, headers={"Range": f"bytes={start}-{end}"})
        response.raise_for_status()
        if response.status_code != 206:
            raise SourceError(f"{url}: the server ignored a byte range")
        return response.content

    tail = ranged(max(0, size - 65_536), size - 1)
    end = tail.rfind(b"PK\x05\x06")
    if end < 0:
        raise SourceError(f"{url}: no zip directory found")
    directory_size, directory_at = struct.unpack("<II", tail[end + 12 : end + 20])
    directory = ranged(directory_at, directory_at + directory_size - 1)
    at = 0
    while at < len(directory):
        fields = struct.unpack("<IHHHHHHIIIHHHHHII", directory[at : at + 46])
        method, compressed = fields[4], fields[8]
        name_length, extra_length, comment_length, offset = (
            fields[10],
            fields[11],
            fields[12],
            fields[16],
        )
        name = directory[at + 46 : at + 46 + name_length].decode()
        at += 46 + name_length + extra_length + comment_length
        if name != member:
            continue
        local = ranged(offset, offset + 29)
        local_name, local_extra = struct.unpack("<HH", local[26:30])
        start = offset + 30 + local_name + local_extra
        data = ranged(start, start + compressed - 1)
        return zlib.decompress(data, -15) if method == 8 else data
    raise SourceError(f"{url}: no {member} in the archive")


class SdwisAdapter(SourceAdapter):
    """Two layers: `violations` from Envirofacts, `codes` from ECHO's reference file."""

    source_id: ClassVar[str] = "epa_sdwis"
    default_vintage: ClassVar[str] = "current"
    landing_format: ClassVar[str] = "ndjson"
    # EPA refreshes SDWIS quarterly; a month is well inside that.
    revalidate_after: ClassVar[timedelta] = timedelta(days=30)

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        vintage = vintage or self.default_vintage
        return [
            ReleaseRef(self.source_id, "violations", vintage, f"{VIOLATIONS_URL}/JSON"),
            ReleaseRef(self.source_id, "codes", vintage, f"{ECHO_ZIP}#{CODES_MEMBER}"),
        ]

    @classmethod
    def filename(cls, ref: ReleaseRef) -> str:
        return f"{ref.layer}.ndjson"

    def _client(self) -> httpx.Client:
        return httpx.Client(
            timeout=httpx.Timeout(30.0, read=180.0),
            headers=self.headers,
            follow_redirects=True,
        )

    def _fetch_bytes(self, ref: ReleaseRef, destination: Path) -> None:
        with self._client() as client:
            rows = (
                self._violations(client)
                if ref.layer == "violations"
                else self._codes(client)
            )
        with destination.open("w", encoding="utf-8") as out:
            for row in rows:
                out.write(json.dumps(row) + "\n")
        self._last_validators = {}

    def _violations(self, client: httpx.Client) -> list[dict[str, object]]:
        count = client.get(f"{VIOLATIONS_URL}/COUNT/JSON")
        count.raise_for_status()
        total = int(count.json()[0]["TOTALQUERYRESULTS"])
        rows: list[dict[str, object]] = []
        for start in range(0, total, _PAGE):
            page = client.get(f"{VIOLATIONS_URL}/rows/{start}:{start + _PAGE - 1}/JSON")
            page.raise_for_status()
            rows += [{k: r.get(k) for k in VIOLATION_FIELDS} for r in page.json()]
        if len(rows) != total or total < 1000:
            raise SourceError(f"epa_sdwis/violations: read {len(rows)} of {total}")
        return rows

    def _codes(self, client: httpx.Client) -> list[dict[str, object]]:
        text = zip_member(client, ECHO_ZIP, CODES_MEMBER).decode("utf-8", "replace")
        rows = [
            {
                "value_type": r["VALUE_TYPE"],
                "value_code": r["VALUE_CODE"],
                "value_description": r["VALUE_DESCRIPTION"],
            }
            for r in csv.DictReader(io.StringIO(text))
            if r.get("VALUE_TYPE") in CODE_TYPES
        ]
        if len(rows) < 100:
            raise SourceError(f"epa_sdwis/codes: read {len(rows)} codes")
        return rows
