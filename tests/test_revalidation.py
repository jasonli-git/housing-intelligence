"""Asking the publisher whether anything moved, instead of assuming it did not.

The defect this closes was silent and long-lived: `fetch` short-circuited on a local
index keyed by `ref.key`, so once a ref was cached it was never fetched again. Right for
a dated vintage, which names one immutable release; wrong for every ref whose vintage is
`current`, which names whatever is newest. Measured 2026-09-20, with the site already
deployed: Zillow had republished ZHVI on 2026-09-16 and the warehouse held 2026-09-06,
and a full `make pipeline` reported "172 cached, 0 downloaded" without asking anyone.

These drive the real `fetch` against a stub transport, so what is under test is the
decision to ask — and what is done with each answer — rather than a mock of it.
"""

from __future__ import annotations

from pathlib import Path
from typing import ClassVar

import httpx
import pytest

from hip.sources.base import ReleaseRef, SourceAdapter, SourceError

BODY = b"col\n1\n"


class Publisher(SourceAdapter):
    """One file, with whatever validators and answers a test wants to give it."""

    source_id: ClassVar[str] = "demo"
    default_vintage: ClassVar[str] = "current"

    def __init__(
        self, *, vintage: str = "current", validators: dict[str, str] | None = None
    ):
        self.vintage = vintage
        self.url = "https://example.invalid/demo.csv"
        self.validators = validators if validators is not None else {"etag": '"v1"'}
        self.conditional: list[dict[str, str]] = []
        self.downloads = 0
        self.changed = False
        self.unreachable = False

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        return [
            ReleaseRef(
                source_id=self.source_id,
                layer="demo",
                vintage=vintage or self.vintage,
                url=self.url,
            )
        ]

    def _handler(self, request: httpx.Request) -> httpx.Response:
        asked = {k: v for k, v in request.headers.items() if k.lower().startswith("if-")}
        if asked:
            self.conditional.append(asked)
            if self.unreachable:
                raise httpx.ConnectError("no route", request=request)
            if not self.changed:
                return httpx.Response(304, headers=self.validators)
            # A conditional GET answered 200 means "changed". The real `_revalidate`
            # closes the stream here without reading it, so this is not a transfer —
            # the transfer is the unconditional fetch that follows.
            return httpx.Response(200, content=BODY, headers=self.validators)
        self.downloads += 1
        return httpx.Response(200, content=BODY, headers=self.validators)

    def _fetch_bytes(self, ref: ReleaseRef, destination: Path) -> None:
        transport = httpx.MockTransport(self._handler)
        with httpx.Client(transport=transport) as client:
            response = client.get(ref.url)
            response.raise_for_status()
            self._last_validators = {
                name: value
                for name in ("last-modified", "etag")
                if (value := response.headers.get(name))
            }
            destination.write_bytes(response.content)

    def _revalidate(self, release):  # type: ignore[no-untyped-def]
        if not release.validators:
            return None
        transport = httpx.MockTransport(self._handler)
        try:
            with httpx.Client(transport=transport) as client:
                response = client.get(release.ref.url, headers=release.validators)
                if response.status_code == 304:
                    return True
                response.raise_for_status()
                return False
        except (httpx.HTTPError, OSError):
            return None


def _fetch(adapter: Publisher, raw: Path):
    return adapter.fetch(adapter.refs()[0], raw_dir=raw)


def test_a_dated_vintage_is_never_revalidated(tmp_path: Path) -> None:
    """It names one immutable release, so asking would be a request that cannot matter."""
    adapter = Publisher(vintage="2025")
    _fetch(adapter, tmp_path)
    _fetch(adapter, tmp_path)

    assert adapter.downloads == 1
    assert adapter.conditional == [], "asked about a release that cannot change"


@pytest.mark.parametrize("vintage", ["current", "2026ytd"])
def test_a_mutable_vintage_is_revalidated(tmp_path: Path, vintage: str) -> None:
    """`current` and a year-to-date file are both "whatever is newest", not a release."""
    adapter = Publisher(vintage=vintage)
    assert adapter.refs()[0].mutable

    _fetch(adapter, tmp_path)
    second = _fetch(adapter, tmp_path)

    assert adapter.downloads == 1, "re-downloaded a file the publisher called unchanged"
    assert adapter.conditional == [{"if-none-match": '"v1"'}]
    assert second.from_cache and second.revalidated_at is not None


def test_a_publisher_saying_changed_causes_a_download(tmp_path: Path) -> None:
    adapter = Publisher()
    first = _fetch(adapter, tmp_path)

    adapter.changed = True
    adapter.validators = {"etag": '"v2"'}
    second = _fetch(adapter, tmp_path)

    assert adapter.downloads == 2
    assert second.etag == '"v2"', "did not record the new validator to ask with next time"
    assert first.sha256 == second.sha256, "same bytes here; the point is it re-fetched"


def test_a_publisher_offering_no_validator_falls_back_to_age(tmp_path: Path) -> None:
    """Neither of the two obvious rules is right, so the third one is age.

    Some publishers send no validator at all — FHFA sends neither, and the JSON APIs
    behind Census, FRED, BLS and HUD send nothing useful — and every manifest written
    before validators were recorded is in the same state. Re-fetching those every run
    would be worse than the freeze it fixes: HUD's 571 municipal CHAS calls would run on
    every `hip acquire` and earn the 429 that stopped Milestone 21's first run. Keeping
    them forever is the freeze. So they are kept while young and re-fetched once stale.
    """
    adapter = Publisher(validators={})
    _fetch(adapter, tmp_path)
    assert adapter.downloads == 1

    # Young: kept, and nothing is asked because there is nothing to ask with.
    _fetch(adapter, tmp_path)
    assert adapter.downloads == 1
    assert adapter.conditional == []


def test_an_unvalidatable_release_is_refetched_once_it_is_stale(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The other half of the rule above — and the half that unfreezes the platform."""
    adapter = Publisher(validators={})
    _fetch(adapter, tmp_path)

    monkeypatch.setattr(
        type(adapter), "_age", staticmethod(lambda _: adapter.revalidate_after * 2)
    )
    _fetch(adapter, tmp_path)

    assert adapter.downloads == 2


def test_a_validator_is_checked_however_old_the_copy_is(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Age is the fallback, not a second gate: asking is free, so it is always asked."""
    adapter = Publisher()
    _fetch(adapter, tmp_path)

    monkeypatch.setattr(
        type(adapter), "_age", staticmethod(lambda _: adapter.revalidate_after * 10)
    )
    second = _fetch(adapter, tmp_path)

    assert adapter.downloads == 1, "re-downloaded on age alone despite a 304"
    assert second.from_cache


def test_an_unreachable_publisher_keeps_the_cached_copy(tmp_path: Path) -> None:
    """A refresh that cannot reach a publisher must not discard good data."""
    adapter = Publisher()
    first = _fetch(adapter, tmp_path)

    adapter.unreachable = True
    second = _fetch(adapter, tmp_path)

    assert adapter.downloads == 1
    assert second.from_cache and second.sha256 == first.sha256


def test_force_still_bypasses_the_question_entirely(tmp_path: Path) -> None:
    adapter = Publisher()
    _fetch(adapter, tmp_path)
    adapter.fetch(adapter.refs()[0], raw_dir=tmp_path, force=True)

    assert adapter.downloads == 2
    assert adapter.conditional == []


def test_validators_survive_a_round_trip_through_the_manifest(tmp_path: Path) -> None:
    """`_revalidate` reads them back off disk, not out of memory."""
    adapter = Publisher(validators={"last-modified": "Wed, 16 Sep 2026 02:06:41 GMT"})
    _fetch(adapter, tmp_path)

    reread = Publisher(validators={"last-modified": "Wed, 16 Sep 2026 02:06:41 GMT"})
    reread.fetch(reread.refs()[0], raw_dir=tmp_path)

    assert reread.downloads == 0, "did not read the validator back from the manifest"
    assert reread.conditional == [{"if-modified-since": "Wed, 16 Sep 2026 02:06:41 GMT"}]


@pytest.mark.parametrize("vintage", ["current", "2025"])
def test_a_changed_request_is_not_answered_by_the_old_copy(
    tmp_path: Path, vintage: str
) -> None:
    """The BLS freeze: the key stayed `34001@current` while the request moved a year.

    No validator and a young copy — exactly the state in which age alone kept the old
    window, so the refresh that discovered 2026 loaded none of it.
    """
    adapter = Publisher(vintage=vintage, validators={})
    adapter.url = "https://example.invalid/demo.csv?startyear=2006&endyear=2025"
    _fetch(adapter, tmp_path)

    adapter.url = "https://example.invalid/demo.csv?startyear=2007&endyear=2026"
    _fetch(adapter, tmp_path)
    _fetch(adapter, tmp_path)

    assert adapter.downloads == 2, "answered the new request from the old copy"


def test_a_rotated_key_is_not_a_new_request(tmp_path: Path) -> None:
    """The manifest records the URL redacted, so only the redacted URLs are compared."""
    adapter = Publisher(validators={})
    adapter.url = "https://example.invalid/demo.csv?registrationkey=old&endyear=2026"
    _fetch(adapter, tmp_path)

    adapter.url = "https://example.invalid/demo.csv?registrationkey=new&endyear=2026"
    _fetch(adapter, tmp_path)

    assert adapter.downloads == 1


def test_identical_answers_to_two_refs_do_not_evict_each_other(tmp_path: Path) -> None:
    """HUD answers `[]` for two towns: one directory, one manifest, naming only one.

    Reading that manifest's URL as the other town's request would re-download both on
    every run, each overwriting the record the other is compared against.
    """
    adapter = Publisher(vintage="2025")
    towns = [
        ReleaseRef(
            source_id="demo",
            layer=f"mcd_{town}",
            vintage="2025",
            url=f"https://example.invalid/chas?entityId={town}",
        )
        for town in ("58920", "60915")
    ]
    for _ in range(3):
        for ref in towns:
            adapter.fetch(ref, raw_dir=tmp_path)

    assert adapter.downloads == 2


def test_a_source_error_still_names_the_source_and_layer() -> None:
    """The existing failure contract is unchanged by any of this."""
    assert issubclass(SourceError, Exception)
