"""Source adapters: ref construction and the shared download/cache machinery.

Nothing here touches the network. The adapter's HTTP call is the one thing stubbed;
caching, content addressing, and manifest writing are exercised for real.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

import pytest

from hip.config import ConfigError
from hip.sources.base import Release, ReleaseRef, SourceAdapter, SourceError, redact
from hip.sources.tiger import TigerAdapter, shapefile_member

PAYLOAD = b"tiger-bytes"


class FakeAdapter(SourceAdapter):
    """Writes fixed bytes instead of downloading, and counts how often it is asked."""

    source_id = "fake_source"
    default_vintage = "2025"

    def __init__(self, payload: bytes = PAYLOAD) -> None:
        self.payload = payload
        self.downloads = 0

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        return [
            ReleaseRef(
                source_id=self.source_id,
                layer="demo",
                vintage=vintage or self.default_vintage,
                url="https://example.invalid/demo.zip",
            )
        ]

    def _fetch_bytes(self, ref: ReleaseRef, destination: Path) -> None:
        self.downloads += 1
        destination.write_bytes(self.payload)


def test_tiger_builds_one_ref_per_layer_and_state() -> None:
    refs = TigerAdapter(states=["NJ"]).refs()

    assert {r.layer for r in refs} == {"state", "county", "cousub", "tract", "zcta"}
    # National layers carry no scope; per-state layers do.
    assert {r.scope for r in refs} == {None, "NJ"}
    assert all("TIGER2025" in r.url for r in refs)


def test_tiger_uses_state_fips_not_the_state_code() -> None:
    cousub = next(r for r in TigerAdapter(states=["NJ"]).refs() if r.layer == "cousub")

    assert cousub.url.endswith("tl_2025_34_cousub.zip")
    assert shapefile_member(cousub) == "tl_2025_34_cousub.shp"


def test_tiger_scales_to_more_states_without_code_change() -> None:
    refs = TigerAdapter(states=["NJ", "NY"]).refs()

    per_state = [r for r in refs if r.scope is not None]
    assert len(per_state) == 4  # cousub + tract, times two states
    assert {r.scope for r in per_state} == {"NJ", "NY"}
    assert sum("tl_2025_36_" in r.url for r in refs) == 2  # NY is FIPS 36


def test_unknown_state_names_the_offending_value() -> None:
    with pytest.raises(ConfigError) as exc:
        TigerAdapter(states=["ZZ"]).refs()

    assert "ZZ" in str(exc.value)


def test_ref_cache_keys_are_unique_per_state() -> None:
    refs = TigerAdapter(states=["NJ", "NY"]).refs()

    assert len({r.key for r in refs}) == len(refs)


def test_fetch_is_content_addressed_and_writes_a_manifest(tmp_path: Path) -> None:
    adapter = FakeAdapter()
    ref = adapter.refs()[0]

    release = adapter.fetch(ref, raw_dir=tmp_path)

    assert release.path.read_bytes() == PAYLOAD
    assert release.sha256[:16] in str(release.path)
    manifest = release.dir / "manifest.json"
    assert manifest.exists()
    assert release.sha256 in manifest.read_text()


def test_second_fetch_uses_the_cache_without_downloading(tmp_path: Path) -> None:
    adapter = FakeAdapter()
    ref = adapter.refs()[0]

    first = adapter.fetch(ref, raw_dir=tmp_path)
    second = adapter.fetch(ref, raw_dir=tmp_path)

    assert adapter.downloads == 1
    assert second.from_cache is True
    assert second.sha256 == first.sha256


def test_force_redownloads_but_reuses_the_same_directory(tmp_path: Path) -> None:
    """Identical upstream bytes must not create a second release (ARCHITECTURE #10)."""
    adapter = FakeAdapter()
    ref = adapter.refs()[0]

    first = adapter.fetch(ref, raw_dir=tmp_path)
    second = adapter.fetch(ref, raw_dir=tmp_path, force=True)

    assert adapter.downloads == 2
    assert second.path == first.path


def test_changed_upstream_bytes_produce_a_new_release(tmp_path: Path) -> None:
    adapter = FakeAdapter()
    ref = adapter.refs()[0]
    first = adapter.fetch(ref, raw_dir=tmp_path)

    adapter.payload = b"revised-tiger-bytes"
    second = adapter.fetch(ref, raw_dir=tmp_path, force=True)

    assert second.sha256 != first.sha256
    assert second.dir != first.dir
    assert first.path.exists(), "previous release must remain; raw data is immutable"


def test_missing_cached_file_falls_back_to_downloading(tmp_path: Path) -> None:
    adapter = FakeAdapter()
    ref = adapter.refs()[0]
    release = adapter.fetch(ref, raw_dir=tmp_path)
    release.path.unlink()

    recovered = adapter.fetch(ref, raw_dir=tmp_path)

    assert adapter.downloads == 2
    assert recovered.path.exists()


class BrokenAdapter(FakeAdapter):
    """Fails a configurable number of times before succeeding."""

    def __init__(self, failures: int) -> None:
        super().__init__()
        self.remaining_failures = failures

    def _fetch_bytes(self, ref: ReleaseRef, destination: Path) -> None:
        self.downloads += 1
        if self.remaining_failures > 0:
            self.remaining_failures -= 1
            raise OSError("connection reset")
        destination.write_bytes(self.payload)


def test_download_failure_names_the_source_and_layer(tmp_path: Path) -> None:
    adapter = BrokenAdapter(failures=99)

    with pytest.raises(SourceError) as exc:
        adapter.fetch(adapter.refs()[0], raw_dir=tmp_path)

    assert "fake_source" in str(exc.value)
    assert "demo" in str(exc.value)


def test_a_transient_failure_is_retried(tmp_path: Path) -> None:
    """Retry lives in the base class, so every adapter gets it without opting in."""
    adapter = BrokenAdapter(failures=2)

    release = adapter.fetch(adapter.refs()[0], raw_dir=tmp_path)

    assert adapter.downloads == 3
    assert release.path.read_bytes() == PAYLOAD


# --- credentials never reach disk (#76) --------------------------------------------


class KeyedAdapter(FakeAdapter):
    """A source that authenticates by query parameter, as Census and FRED both do."""

    source_id = "keyed_source"

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        return [
            ReleaseRef(
                source_id=self.source_id,
                layer="demo",
                vintage=vintage or self.default_vintage,
                url="https://api.example.invalid/data/acs5?get=NAME&key=SUPERSECRET",
            )
        ]


@pytest.mark.parametrize(
    "url",
    [
        "https://x.invalid/a?key=SUPERSECRET",
        "https://x.invalid/a?api_key=SUPERSECRET",
        "https://x.invalid/a?apikey=SUPERSECRET",
        "https://x.invalid/a?registrationkey=SUPERSECRET&startyear=2006",
        "https://x.invalid/a?token=SUPERSECRET",
        "Server error for url 'https://x.invalid/a?key=SUPERSECRET'",
    ],
)
def test_every_credential_parameter_is_redacted(url: str) -> None:
    assert "SUPERSECRET" not in redact(url)


def test_redaction_keeps_the_rest_of_the_url_readable() -> None:
    """Which endpoint a release came from is provenance; the key is not."""
    out = redact("https://api.example.invalid/data/2023/acs5?get=NAME&key=SECRET")

    assert out == "https://api.example.invalid/data/2023/acs5?get=NAME&key=***"


def test_a_key_never_becomes_part_of_a_filename(tmp_path: Path) -> None:
    """The failure this prevents: files literally named `...?key=<live key>`."""
    adapter = KeyedAdapter()

    release = adapter.fetch(adapter.refs()[0], raw_dir=tmp_path)

    assert release.path.name == "acs5"
    assert not any("SUPERSECRET" in path.name for path in tmp_path.rglob("*"))


def test_the_manifest_records_a_redacted_url(tmp_path: Path) -> None:
    adapter = KeyedAdapter()
    adapter.fetch(adapter.refs()[0], raw_dir=tmp_path)

    manifests = list(tmp_path.rglob("manifest.json"))
    assert manifests, "no manifest written"
    for manifest in manifests:
        text = manifest.read_text()
        assert "SUPERSECRET" not in text
        assert "key=***" in text


def test_a_download_failure_does_not_echo_the_key(tmp_path: Path) -> None:
    """httpx renders the failing URL into its message; a keyed source's URL has a key."""

    class FailingKeyed(KeyedAdapter):
        def _fetch_bytes(self, ref: ReleaseRef, destination: Path) -> None:
            raise OSError(f"connection reset for {ref.url}")

    adapter = FailingKeyed()

    with pytest.raises(SourceError) as exc:
        adapter.fetch(adapter.refs()[0], raw_dir=tmp_path)

    assert "SUPERSECRET" not in str(exc.value)
    # The diagnosis survives the redaction.
    assert "OSError" in str(exc.value)
    assert "keyed_source" in str(exc.value)


def test_a_plain_file_url_still_names_the_file(tmp_path: Path) -> None:
    """Dropping the query string must not change the name of an ordinary download."""
    adapter = FakeAdapter()

    release = adapter.fetch(adapter.refs()[0], raw_dir=tmp_path)

    assert release.path.name == "demo.zip"


# --- Milestone 21: New Jersey depth -----------------------------------------------


def _hud(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("HUD_API_TOKEN", "hud-test")


def test_fmr_is_one_release_per_state_and_fiscal_year(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """`statedata` answers every county at once: ten calls, not 210."""
    from hip.sources.hud import FMR_FLOOR, FMR_YEAR_COUNT, HudFmrAdapter

    _hud(monkeypatch)
    refs = HudFmrAdapter(states=["NJ"]).refs()

    expected = range(FMR_FLOOR, FMR_FLOOR - FMR_YEAR_COUNT, -1)
    assert [r.vintage for r in refs] == [str(y) for y in expected]
    assert refs[0].url.endswith("/fmr/statedata/NJ?year=2026")
    assert len({r.key for r in refs}) == len(refs)
    assert "2016" not in {r.vintage for r in refs}, "the API refuses FY2016"


def test_fmr_asks_for_zip_level_rents_only_where_hud_sets_them(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """Milestone 35: the statewide file marks the counties HUD prices ZIP by ZIP; each
    of those, and only those, is asked for its Small Area FMRs."""
    from hip.sources.hud import HudFmrAdapter

    _hud(monkeypatch)
    path = tmp_path / "statedata"
    path.write_text(
        json.dumps(
            {
                "data": {
                    "counties": [
                        {"fips_code": "3401799999", "smallarea_status": "1"},
                        {"fips_code": "3402199999", "smallarea_status": "0"},
                    ]
                }
            }
        )
    )
    ref = ReleaseRef("hud_fmr", "fmr", "2027", "https://x", scope="NJ")
    release = Release(
        ref=ref, path=path, sha256="0" * 64, size_bytes=1, fetched_at=datetime.now(UTC)
    )
    [child] = HudFmrAdapter(states=["NJ"]).child_refs(release)
    assert child.layer == "safmr_34017" and child.vintage == "2027"
    assert child.url.endswith("/fmr/data/3401799999?year=2027")


def test_safmr_records_are_zips_and_never_the_metro_row() -> None:
    from hip.sources.hud import HudFmrAdapter

    ref = ReleaseRef("hud_fmr", "safmr_34017", "2027", "https://x")
    payload = {
        "data": {
            "basicdata": [
                {"zip_code": "MSA level", "Two-Bedroom": 2763},
                {"zip_code": "07030", "Efficiency": 3200, "Two-Bedroom": 4190},
            ]
        }
    }
    [row] = HudFmrAdapter.to_records(payload, ref)
    assert row["zip_code"] == "07030" and row["county_fips"] == "34017"
    assert row["two_bedroom"] == 4190 and row["efficiency"] == 3200
    assert row["fiscal_year"] == "2027"


def test_income_limits_keep_every_band_and_household_size() -> None:
    """Milestone 35: the income check needs HUD's 24 lines a county-year, not the one
    four-person 80% figure the metric reads."""
    from hip.sources.hud import HudAdapter

    ref = ReleaseRef("hud", "il_34017", "2026", "https://x")
    payload = {
        "data": {
            "median_income": 110100,
            "extremely_low": {f"il30_p{n}": 30000 + n for n in range(1, 9)},
            "very_low": {f"il50_p{n}": 50000 + n for n in range(1, 9)},
            "low": {f"il80_p{n}": 80000 + n for n in range(1, 9)},
        }
    }
    [row] = HudAdapter.to_records(payload, ref)
    assert row["income_limit_80"] == row["il80_p4"] == 80004
    assert (row["il30_p1"], row["il50_p8"]) == (30001, 50008)
    assert sum(1 for key in row if key.startswith("il") and "_p" in key) == 24


def test_fmr_records_keep_every_county_and_the_area_it_belongs_to() -> None:
    from hip.sources.hud import HudFmrAdapter

    ref = ReleaseRef("hud_fmr", "fmr", "2026", "https://x", scope="NJ")
    payload = {
        "data": {
            "year": "2026",
            "metroareas": [{"code": "ignored"}],
            "counties": [
                {
                    "fips_code": "3402199999",
                    "county_name": "Mercer County",
                    "metro_name": "Trenton-Princeton, NJ MSA",
                    "smallarea_status": "0",
                    "FMR Percentile": 40,
                    "Two-Bedroom": 1950,
                }
            ],
        }
    }

    [row] = HudFmrAdapter.to_records(payload, ref)
    assert row["fips_code"] == "3402199999"
    assert row["two_bedroom"] == 1950
    assert row["fmr_area"] == "Trenton-Princeton, NJ MSA"
    assert row["fiscal_year"] == "2026"
    with pytest.raises(ValueError, match="data.counties"):
        HudFmrAdapter.to_records({"data": {}}, ref)


def test_chas_refs_are_each_county_and_each_state_directory(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """HUD's entity ids drop leading zeros: Mercer is 21, not 021, which answers []."""
    from hip.sources.hud import CHAS_VINTAGE, HudChasAdapter

    _hud(monkeypatch)
    refs = HudChasAdapter(states=["NJ"], county_fips=["34001", "34021"]).refs()

    counties = [r for r in refs if r.layer.startswith("county_")]
    assert [r.layer for r in counties] == ["county_34001", "county_34021"]
    assert counties[1].url.endswith(
        f"/chas?type=3&year={CHAS_VINTAGE}&stateId=34&entityId=21"
    )
    [directory] = [r for r in refs if r.layer == "mcds"]
    assert directory.url.endswith("/chas/listMCDs/34")
    assert directory.vintage == "current"


class _ChasFake:
    """HUD's directory and one CHAS row per entity, with a download counter."""

    def __init__(self) -> None:
        self.downloads = 0

    def __call__(self, ref: ReleaseRef, destination: Path) -> None:
        import json

        self.downloads += 1
        if "listMCDs" in ref.url:
            body: object = [
                {"statecode": "34", "entityId": "70", "mcdname": "Aberdeen township"},
                {"statecode": "36", "entityId": "70", "mcdname": "another state"},
                {
                    "statecode": "34",
                    "entityId": "0",
                    "mcdname": "County subdivisions not defined",
                },
            ]
        else:
            body = [{"geoname": "x", "year": "2018-2022", "A17": "100.0", "D8": "25.0"}]
        destination.write_text(json.dumps(body))


def test_municipal_chas_refs_come_from_the_cached_directory(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The MCD list is HUD's, so it is fetched as a release — and a re-run, including
    `hip load` rebuilding provenance, derives the same refs from the cache offline."""
    from hip.sources.hud import HudChasAdapter

    _hud(monkeypatch)
    adapter = HudChasAdapter(states=["NJ"], county_fips=["34021"])
    fake = _ChasFake()
    monkeypatch.setattr(adapter, "_fetch_bytes", fake)

    first = [r.ref.layer for r in adapter.fetch_all(raw_dir=tmp_path)]
    assert first == ["county_34021", "mcds", "mcd_3400070"], (
        "other states, and code 0 — water, not a municipality — are dropped"
    )
    assert fake.downloads == 3

    again = list(adapter.fetch_all(raw_dir=tmp_path))
    assert [r.ref.layer for r in again] == first
    assert all(r.from_cache for r in again)
    assert fake.downloads == 3


def test_chas_records_carry_the_key_their_request_was_made_with() -> None:
    """A CHAS row names its geography only in prose; the key comes from the ref."""
    from hip.sources.hud import HudChasAdapter

    county = ReleaseRef("hud_chas", "county_34021", "2018-2022", "https://x")
    [row] = HudChasAdapter.to_records([{"year": "2018-2022", "A17": "51915.0"}], county)
    assert (row["level"], row["geo_key"], row["chas_year"]) == (
        "county",
        "34021",
        "2018-2022",
    )
    assert row["A17"] == "51915.0"

    municipal = ReleaseRef("hud_chas", "mcd_3400070", "2018-2022", "https://x")
    assert HudChasAdapter.to_records([], municipal) == [
        {"level": "mcd", "geo_key": "3400070", "chas_year": None}
    ], "an empty answer lands as one keyed row rather than failing the landing"


def test_acs_housing_tables_are_their_own_layers(monkeypatch: pytest.MonkeyPatch) -> None:
    """The raw cache keys on (layer, scope, vintage), not the URL: widening the existing
    request would have been answered from cached files that lack the new columns."""
    from hip.sources.census_acs import HOUSING_VARIABLES, AcsAdapter

    monkeypatch.setenv("CENSUS_API_KEY", "census-test")
    refs = AcsAdapter(states=["NJ"], end_year=2024).refs(vintage="2023")

    by_layer = {r.layer: r for r in refs}
    assert {"county", "cousub", "housing_county", "housing_cousub"} <= set(by_layer)
    assert "B25002" not in by_layer["county"].url, "the cached request is unchanged"
    assert all(v in by_layer["housing_cousub"].url for v in HOUSING_VARIABLES)


def test_acs_cost_tables_are_asked_only_of_editions_that_carry_them(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Milestone 33: B25141 begins with the 2023 edition and the utility bills with
    2021, and the API refuses a variable an edition lacks, so an older edition is not
    asked for them."""
    from hip.sources.census_acs import AcsAdapter

    monkeypatch.setenv("CENSUS_API_KEY", "census-test")
    refs = AcsAdapter(states=["NJ"], end_year=2024).refs()
    years = {
        layer: sorted({int(r.vintage) for r in refs if r.layer == layer})
        for layer in ("insurance_county", "utilities_cousub", "county")
    }
    assert years["insurance_county"] == [2023, 2024]
    assert years["utilities_cousub"] == [2021, 2022, 2023, 2024]
    assert years["county"] == [2019, 2020, 2021, 2022, 2023, 2024]


def test_acs_asks_for_every_estimate_with_its_margin_of_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Milestone 28: each `E` beside its `M`, in the same request, so an estimate and
    its margin can never come from different files."""
    from hip.sources.census_acs import (
        BURDEN_PARTS,
        HOUSING_VARIABLES,
        VARIABLES,
        AcsAdapter,
    )

    monkeypatch.setenv("CENSUS_API_KEY", "census-test")
    by_layer = {
        r.layer: r.url for r in AcsAdapter(states=["NJ"], end_year=2024).refs("2023")
    }

    for layer, estimates in (
        ("cousub", [*VARIABLES, *BURDEN_PARTS]),
        ("housing_county", HOUSING_VARIABLES),
    ):
        asked = by_layer[layer].split("get=")[1].split("&")[0].split(",")
        for estimate in estimates:
            assert estimate in asked and estimate[:-1] + "M" in asked
    # The renters whose burden was not computed, which leave the denominator.
    assert "B25070_011E" in by_layer["county"] and "B25070_011M" in by_layer["county"]


def test_acs_depth_layers_fit_the_api_limit_with_every_margin(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Milestone 34: the Census API refuses more than 50 variables a request, and every
    estimate brings its margin, so each layer is checked against the limit it must fit."""
    from hip.sources.census_acs import DEPTH_LAYERS, AcsAdapter

    monkeypatch.setenv("CENSUS_API_KEY", "census-test")
    requests = AcsAdapter.requests()
    for prefix, estimates in DEPTH_LAYERS.items():
        asked = requests[prefix][1].split(",")
        assert len(asked) <= 50, prefix
        for estimate in estimates:
            assert estimate in asked and estimate[:-1] + "M" in asked
    assert all(len(spec[1].split(",")) <= 50 for spec in requests.values())


def _zcta_directory(tmp_path: Path, codes: list[str]) -> Release:
    """A fetched 2020 Census directory naming `codes`, as the API returns it."""
    path = tmp_path / "dhc"
    rows = [["NAME", "state", "zip code tabulation area (or part)"]]
    rows += [[f"ZCTA5 {c}, New Jersey", "34", c] for c in codes]
    path.write_text(json.dumps(rows))
    ref = ReleaseRef(
        source_id="census_acs",
        layer="zctas",
        vintage="2020",
        scope="NJ",
        url="https://api.census.gov/data/2020/dec/dhc",
    )
    return Release(
        ref=ref, path=path, sha256="0" * 64, size_bytes=1, fetched_at=datetime.now(UTC)
    )


def test_acs_asks_for_new_jerseys_zctas_by_code_from_2020(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """Milestone 34: no edition from 2020 nests ZCTAs in a state, so the 2020 Census's
    list names them and each layer asks for exactly those. The 2019 edition is never
    asked: it is drawn on the 2010 ZCTAs, a different shape under the same code."""
    from hip.sources.census_acs import AcsAdapter

    monkeypatch.setenv("CENSUS_API_KEY", "census-test")
    adapter = AcsAdapter(states=["NJ"], end_year=2024)
    directory = [r for r in adapter.refs() if r.layer == "zctas"]
    assert len(directory) == 1 and "dec/dhc" in directory[0].url
    assert "in=state:34" in directory[0].url

    release = _zcta_directory(tmp_path, ["08012", "07001"])
    children = adapter.child_refs(release)
    assert {int(r.vintage) for r in children} == {2020, 2021, 2022, 2023, 2024}
    assert all("zip%20code%20tabulation%20area:07001,08012&" in r.url for r in children)
    assert all("in=state" not in r.url for r in children)
    layers = {r.layer for r in children if r.vintage == "2024"}
    assert {"zcta", "housing_zcta", "rent_zcta", "insurance_zcta"} <= layers
    # Insurance begins with the 2023 edition at every level, ZCTAs included.
    assert "insurance_zcta" not in {r.layer for r in children if r.vintage == "2022"}
    # A single edition asks only for that edition, and 2019 asks for no ZCTAs at all.
    assert {r.vintage for r in adapter.child_refs(release, "2022")} == {"2022"}
    assert not [r for r in adapter.refs("2019") if r.layer == "zctas"]


def test_acs_vintages_follow_the_bump_constant_not_a_hard_coded_list() -> None:
    """Milestone 24. The vintage list was hard-coded in the adapter from Milestone 3,
    so a new ACS release needed an edit inside the source rather than a bump beside
    `BLS_END_YEAR`. The window is derived; only the end year is a decision."""
    from hip.sources.census_acs import VINTAGE_COUNT, vintages

    assert vintages(2024) == (2024, 2023, 2022, 2021, 2020, 2019)
    assert len(vintages(2024)) == VINTAGE_COUNT
    # The pair the default five-year change compares, whose samples do not overlap, are
    # both fetched: a clean rebuild would otherwise have no five-year change at all.
    assert vintages(2024)[0] - vintages(2024)[-1] == 5
    # Consecutive 5-year vintages overlap by four, so six of them span ten years.
    assert max(vintages(2030)) - min(vintages(2030)) + 5 == 10


def test_acs_end_year_is_injected_so_a_rerun_fetches_what_the_first_run_recorded(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The reason `BlsAdapter` takes `end_year` rather than reading the clock: a
    release has to be reproducible. ACS gets the same treatment in Milestone 24."""
    from hip.sources.census_acs import AcsAdapter

    monkeypatch.setenv("CENSUS_API_KEY", "census-test")
    refs = AcsAdapter(states=["NJ"], end_year=2024).refs()

    fetched = {r.vintage for r in refs}
    assert fetched == {"2024", "2023", "2022", "2021", "2020", "2019"}
    # The ZCTA directory is the 2020 Census, not an ACS edition (Milestone 34).
    surveys = [r for r in refs if r.layer != "zctas"]
    assert all(f"/{r.vintage}/acs/acs5" in r.url for r in surveys), (
        "vintage reaches the URL"
    )
    # An older adapter still fetches the older window, whatever the constant now says.
    assert {r.vintage for r in AcsAdapter(states=["NJ"], end_year=2023).refs()} == {
        "2023",
        "2022",
        "2021",
        "2020",
        "2019",
        "2018",
    }


def test_the_registry_is_where_vintages_are_bumped() -> None:
    """Both bump constants live together, so someone refreshing a year finds them in
    one place rather than inside two adapters."""
    from hip.sources import registry

    assert registry.ACS_END_YEAR == 2024
    assert isinstance(registry.BLS_END_YEAR, int)


def test_pep_fetches_one_national_county_file_and_one_sub_county_file_per_state() -> None:
    """Census publishes the county totals nationally and the sub-county totals per
    state, so the ref set is not symmetric and is not a bug."""
    from hip.sources.census_pep import PepAdapter

    refs = PepAdapter(states=["NJ"]).refs()

    by_layer = {r.layer: r for r in refs}
    assert set(by_layer) == {"county", "cousub"}
    assert by_layer["county"].scope is None, "the county file is national"
    assert by_layer["cousub"].scope == "NJ"
    assert by_layer["county"].url.endswith("co-est2025-alldata.csv")
    assert by_layer["cousub"].url.endswith("sub-est2025_34.csv")
    # The directory encodes the span the vintage covers, from the decennial census.
    assert all("/2020-2025/" in r.url for r in refs)


def test_pep_vintage_is_dated_so_it_does_not_inherit_the_current_ref_defect() -> None:
    """A PEP vintage is immutable once published — the 2025 vintage is superseded by
    2026 rather than rewritten — so the content-addressed cache is right to answer from
    disk. Sources whose vintage is literally `current` have the opposite problem, which
    is the open conditional-request item in TODO.md."""
    from hip.sources.census_pep import PepAdapter

    assert PepAdapter.default_vintage == "2025"
    assert all(r.vintage == "2025" for r in PepAdapter(states=["NJ"]).refs())
    older = PepAdapter(states=["NJ"]).refs(vintage="2024")
    assert all(r.vintage == "2024" for r in older)
    assert all("/2020-2024/" in r.url for r in older)


def test_pep_needs_no_api_key() -> None:
    """Both files are plain CSV over HTTPS. ACS needs a key and fails loudly without
    one; PEP must not acquire that dependency by accident."""
    from hip.sources.census_pep import PepAdapter

    refs = PepAdapter(states=["NJ"]).refs()
    assert all("key=" not in r.url for r in refs)


def test_acs_stays_the_denominator_and_pep_feeds_no_computed_ratio() -> None:
    """The milestone's one rule. A ratio mixing a five-year survey average with a
    point-in-time estimate would be neither, so `pep_population` is a headline figure
    and nothing else. Pinned here rather than left to a comment."""
    from pathlib import Path

    root = Path(__file__).resolve().parents[1]
    compute = root / "src" / "hip" / "analytics" / "compute.py"
    body = compute.read_text()
    assert "acs_population" in body or "acs_median_hh_income" in body, (
        "the ACS inputs moved; this test is asserting against the wrong file"
    )
    assert "pep_population" not in body, (
        "pep_population reached the derived-metric computation. It is a point-in-time "
        "estimate and ACS is a five-year average; a ratio over both is neither."
    )


def test_permits_add_the_region_place_file_for_every_year() -> None:
    from hip.sources.census_permits import YEARS, PermitsAdapter

    refs = PermitsAdapter(states=["NJ"]).refs()

    places = [r for r in refs if r.layer == "place"]
    assert len(places) == YEARS == len(refs) - len(places)
    assert places[0].url.endswith("/Place/Northeast%20Region/ne2412y.txt")
    assert places[0].scope == "ne"


def test_permits_refuse_a_state_with_no_mapped_place_region() -> None:
    """A guessed folder would fail as a 404 inside a run; refusing names the fix."""
    from hip.sources.census_permits import PermitsAdapter

    with pytest.raises(ConfigError, match="PLACE_REGIONS"):
        PermitsAdapter(states=["CA"]).refs()


def test_the_new_hud_sources_are_registered_as_metric_sources(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from hip.config import load_geography
    from hip.sources.hud import HudChasAdapter, HudFmrAdapter
    from hip.sources.registry import IMPLEMENTED, METRIC_SOURCES, build_adapter

    _hud(monkeypatch)
    scope = load_geography()
    assert isinstance(build_adapter("hud_fmr", scope), HudFmrAdapter)
    assert isinstance(build_adapter("hud_chas", scope), HudChasAdapter)
    assert {"hud_fmr", "hud_chas"} <= set(IMPLEMENTED) & set(METRIC_SOURCES)


def test_an_adapter_with_a_request_interval_waits_between_downloads(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """HUD User allows 60 requests a minute; the first CHAS run hit 429 at release 101."""
    import time

    clock = {"now": 100.0}
    slept: list[float] = []
    monkeypatch.setattr(time, "monotonic", lambda: clock["now"])
    monkeypatch.setattr(time, "sleep", lambda s: slept.append(s))

    class Paced(FakeAdapter):
        request_interval_s = 1.1

        def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
            return [
                ReleaseRef(self.source_id, f"layer{i}", "2025", "https://x/f")
                for i in range(2)
            ]

    list(Paced().fetch_all(raw_dir=tmp_path))
    assert slept == [pytest.approx(1.1)]

    slept.clear()
    list(Paced().fetch_all(raw_dir=tmp_path))
    assert slept == [], "a cached release makes no request, so it waits for none"


def test_a_rate_limited_download_waits_before_retrying(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """An instant retry after 429 only spends the attempts inside the same window."""
    import time

    import httpx

    slept: list[float] = []
    monkeypatch.setattr(time, "sleep", lambda s: slept.append(s))

    class Limited(FakeAdapter):
        def _fetch_bytes(self, ref: ReleaseRef, destination: Path) -> None:
            self.downloads += 1
            if self.downloads == 1:
                request = httpx.Request("GET", ref.url)
                raise httpx.HTTPStatusError(
                    "429",
                    request=request,
                    response=httpx.Response(429, request=request),
                )
            destination.write_bytes(self.payload)

    adapter = Limited()
    adapter.fetch(adapter.refs()[0], raw_dir=tmp_path)

    assert adapter.downloads == 2
    assert slept == [60.0], "no Retry-After, so the whole minute"


def test_fred_asks_for_the_weekly_benchmark_and_the_monthly_history(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Two windows of one series: the week that prices today, the months behind it."""
    from hip.sources.fred import FredAdapter

    monkeypatch.setenv("FRED_API_KEY", "k")
    refs = {r.layer: r.url for r in FredAdapter().refs()}

    assert "frequency=m" in refs["MORTGAGE30US"], "history stays monthly"
    assert "frequency" not in refs["MORTGAGE30US_weekly"], "the series' own, weekly"
    assert all("series_id=MORTGAGE30US&" in url for url in refs.values())
