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

**Nor may it shrink unnoticed** (#359). A list deleted inside iCloud, or an entry lost to
an edit, looks like the state before the first notice. So each publish records which
entries it honoured in a ledger beside the list — a short hash of each, never the
address — and the next publish refuses if any of them is gone, unless lifting one was
meant (`HIP_ALLOW_REMOVAL_SHRINK=1`). The same ledger lets a rollback refuse to restore
a build that predates a removal (`hip.rollback`).
"""

from __future__ import annotations

import hashlib
import json
import os
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


class RemovalListShrank(RuntimeError):
    """Entries an earlier publish honoured are missing from the list."""


# Builds remembered in the ledger: enough to roll back past several deploys.
LEDGER_KEEP = 20


def ledger_path(path: Path) -> Path:
    """The ledger of what each publish honoured, beside the list in its private folder."""
    return path.with_name(f"{path.stem}.published.json")


def _key(removal: Removal) -> str:
    """A short hash of one entry's parcel and address: enough to tell entries apart,
    not to read an address back from the ledger."""
    identity = [
        removal.geoid,
        removal.block,
        removal.lot,
        removal.qualifier,
        removal.number,
        removal.street,
    ]
    return hashlib.sha256(json.dumps(identity).encode()).hexdigest()[:16]


def fingerprint(removals: list[Removal]) -> str:
    """One hash for the whole list, the same whatever order its entries are in."""
    keys = ",".join(sorted(_key(r) for r in removals))
    return hashlib.sha256(keys.encode()).hexdigest()


def _ledger(path: Path) -> list[dict[str, object]]:
    ledger = ledger_path(path)
    if not ledger.exists():
        return []
    entries = json.loads(ledger.read_text())
    if not isinstance(entries, list):
        raise RemovalListUnavailable(f"{ledger.name} is not a list of publishes")
    return entries


def check_not_shrunk(path: Path, removals: list[Removal]) -> None:
    """Refuse if any entry the last publish honoured is missing from `removals`."""
    entries = _ledger(path)
    if not entries:
        return
    keys = entries[-1].get("keys")
    if not isinstance(keys, list):
        raise RemovalListUnavailable(f"{ledger_path(path).name} has no keys to check")
    honoured = {str(k) for k in keys}
    missing = honoured - {_key(r) for r in removals}
    if missing and os.environ.get("HIP_ALLOW_REMOVAL_SHRINK") != "1":
        one = len(missing) == 1
        raise RemovalListShrank(
            f"{len(missing)} entr{'y' if one else 'ies'} the last publish "
            f"({entries[-1]['built']}) withdrew {'is' if one else 'are'} no "
            f"longer in {path.name}. Publishing would put those addresses back. If the "
            "file was deleted or overwritten, restore it from iCloud Drive's Recently "
            "Deleted or a backup; if a removal was lifted on purpose, publish with "
            "HIP_ALLOW_REMOVAL_SHRINK=1."
        )


def record(path: Path, removals: list[Removal], built: str) -> None:
    """Note that the build stamped `built` honoured exactly `removals`."""
    entries = _ledger(path)
    entries.append(
        {
            "built": built,
            "count": len(removals),
            "fingerprint": fingerprint(removals),
            "keys": sorted(_key(r) for r in removals),
        }
    )
    ledger_path(path).write_text(json.dumps(entries[-LEDGER_KEEP:], indent=2) + "\n")


def honoured_by(path: Path, built: str) -> str | None:
    """The fingerprint of the list the build stamped `built` honoured, if recorded."""
    for entry in reversed(_ledger(path)):
        if entry["built"] == built:
            return str(entry["fingerprint"])
    return None


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
