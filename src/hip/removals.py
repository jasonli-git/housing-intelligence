"""Addresses withdrawn from the property-tax lookup under Daniel's Law (Milestone 38).

N.J.S.A. 56:8-166.1 lets a covered person — a judge, prosecutor or law-enforcement
officer, or their household — require that their home address not be disclosed, which it
defines to include "making available or viewable within a searchable list or database".
A notice must be honoured within ten business days. The lookup carries no owner, but it
is a searchable list of addresses, so a notice is honoured by dropping the whole parcel:
blanking only the address would leave a block and lot the state's own parcel map turns
back into one.

Each entry is held twice — by block and lot, and by house number and normalised street —
and a parcel matching either is dropped, so renumbering a lot or respelling a street
cannot bring a withdrawn address back. The file lives in iCloud Drive beside the refresh
toggle (`Settings.removals_file`), outside the repository: synced and backed up, and
never committed, since a public list of protected addresses would itself be the
disclosure (ARCHITECTURE #295, #296).

**A missing list is an error, not an empty one.** An empty list would publish every
withdrawn address again, so the list's folder must exist and the file must be on disk,
not an iCloud placeholder still to download; `require` says which. Before the first
notice the folder exists and the file does not, which is the one state read as "none".
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path

from hip.addresses import parse


@dataclass(frozen=True)
class Removal:
    geoid: str
    block: str
    lot: str
    qualifier: str | None
    number: str | None
    street: str
    # The date the notice arrived, ISO 8601: the ten business days run from it.
    received: str


class RemovalListUnavailable(RuntimeError):
    """The removal list cannot be read, so publishing could put addresses back."""


def require(path: Path) -> None:
    """Refuse unless `path`'s folder is here and the list, if it exists, is downloaded."""
    if not path.parent.is_dir():
        raise RemovalListUnavailable(
            f"the Daniel's Law removal list's folder, {path.parent}, is not on this "
            "machine. Publishing without it would put withdrawn addresses back: sign in "
            "to iCloud Drive and let it sync, or set HIP_ADDRESS_REMOVALS."
        )
    placeholder = path.with_name(f".{path.name}.icloud")
    if placeholder.exists() and not path.exists():
        raise RemovalListUnavailable(
            f"{path.name} is in iCloud but not downloaded to this Mac yet. Open the "
            "folder in Finder to download it, then try again."
        )


def read(path: Path) -> list[Removal]:
    """The withdrawn parcels, after `require`; none before the first notice."""
    require(path)
    if not path.exists():
        return []
    return [Removal(**entry) for entry in json.loads(path.read_text())]


def write(path: Path, removals: list[Removal]) -> None:
    require(path)
    path.write_text(json.dumps([asdict(r) for r in removals], indent=2) + "\n")


class Filter:
    """Whether a parcel row is withdrawn, and which entries matched nothing."""

    def __init__(self, removals: list[Removal]) -> None:
        self._removals = removals
        self._by_lot = {(r.geoid, r.block, r.lot, r.qualifier): r for r in removals}
        self._by_address = {
            (r.geoid, r.number, r.street): r for r in removals if r.number is not None
        }
        self._matched: set[Removal] = set()

    def withdrawn(
        self, geoid: str, block: str, lot: str, qualifier: str | None, address: str | None
    ) -> bool:
        hit = self._by_lot.get((geoid, block, lot, qualifier))
        if hit is None and address:
            parsed = parse(address)
            if parsed.number is not None:
                hit = self._by_address.get((geoid, parsed.number, parsed.street))
        if hit is not None:
            self._matched.add(hit)
        return hit is not None

    def unmatched(self) -> list[Removal]:
        """Entries no parcel matched: a lot merged away, or a list that needs a look."""
        return [r for r in self._removals if r not in self._matched]
