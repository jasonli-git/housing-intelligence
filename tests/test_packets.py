"""The analysis packet: its published schema, its caveats, and its report.

Split deliberately. The pure half runs anywhere and covers the contract, the caveat
rules, and the renderer. The warehouse half runs only against a loaded, analyzed
database and checks that a packet's numbers are the warehouse's numbers.
"""

from __future__ import annotations

import json
from datetime import UTC, date, datetime

import jsonschema
import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from hip.packets import (
    PACKET_VERSION,
    SCHEMA_PATH,
    Packet,
    PacketUnavailable,
    build_packet,
    caveats_for,
    display_label,
    published_schema,
    regions_for_level,
    render_markdown,
    schema_text,
)
from hip.packets.report import format_change, format_value
from hip.packets.schema import (
    PacketComparisons,
    PacketLevel,
    PacketMetric,
    PacketRegion,
    PacketSource,
    PacketWindow,
)
from hip.warehouse.db import get_engine, probe


def _packet(**overrides: object) -> Packet:
    """A minimal valid packet, so a test can vary one thing and hold the rest."""
    fields: dict[str, object] = {
        "packet_version": PACKET_VERSION,
        "region": PacketRegion(
            region_id=11,
            geoid="34021",
            level="county",
            name="Mercer",
            label="Mercer County, NJ",
            state_code="NJ",
        ),
        "window": PacketWindow(
            label="5y", start=date(2020, 6, 30), end=date(2025, 6, 30)
        ),
        "metrics": [
            PacketMetric(
                metric_id="zhvi_sfr",
                label="Home value index, single-family",
                unit="usd",
                direction="neutral",
                window_start=date(2020, 6, 30),
                window_end=date(2025, 6, 30),
                start_value=329222.0,
                end_value=453317.0,
                pct_change=37.69,
                cagr=6.6,
                rank=9,
                of=21,
                percentile=60.0,
                release_id=41,
                source_id="zillow_zhvi",
                match_method="fips",
            )
        ],
        "comparisons": PacketComparisons(
            peer_level="county", peer_scope="NJ", peer_count=21
        ),
        "levels": [
            PacketLevel(
                metric_id="modiv_median_assessed_value",
                label="Median assessed value, residential parcels",
                unit="usd",
                direction="neutral",
                value=351000.0,
                period_start=date(2023, 10, 3),
                period_end=date(2023, 10, 3),
                rank=12,
                of=21,
                percentile=45.0,
                release_id=41,
                source_id="nj_modiv",
                match_method="nj_cd_code",
            )
        ],
        "highlights": [],
        "caveats": [],
        "sources": [
            PacketSource(
                source_id="zillow_zhvi",
                name="Zillow Home Value Index",
                publisher="Zillow Research",
                license="Free for non-commercial use with attribution",
                url="https://www.zillow.com/research/data/",
                vintage="current",
                fetched_at=datetime(2026, 8, 11, 12, 0, tzinfo=UTC),
                release_ids=[41],
            )
        ],
    }
    return Packet(**{**fields, **overrides})  # type: ignore[arg-type]


# --- the published contract -------------------------------------------------------


def test_committed_schema_matches_the_models() -> None:
    """`schemas/packet-v1.json` is generated, not maintained by hand.

    A consumer in another language validates against the file, so the file drifting
    from the models would let a packet be emitted that the published contract rejects.
    Regenerate with `hip schema --write`.
    """
    assert SCHEMA_PATH.read_text() == schema_text(), (
        "schemas/packet-v1.json is stale — run `uv run hip schema --write`"
    )


def test_published_schema_accepts_a_real_packet() -> None:
    """The file itself must work as a validator, not merely exist."""
    jsonschema.validate(
        json.loads(_packet().model_dump_json()), json.loads(SCHEMA_PATH.read_text())
    )


def test_published_schema_rejects_a_malformed_packet() -> None:
    """A schema that accepts everything is decoration."""
    body = json.loads(_packet().model_dump_json())
    body["metrics"][0]["pct_change"] = "a lot"

    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(body, json.loads(SCHEMA_PATH.read_text()))


def test_schema_forbids_unknown_fields() -> None:
    """`extra="forbid"` is what makes the published contract mean what it says."""
    schema = published_schema()
    assert schema["additionalProperties"] is False

    body = json.loads(_packet().model_dump_json())
    body["surprise"] = 1
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(body, json.loads(SCHEMA_PATH.read_text()))


def test_packet_carries_no_wall_clock_field() -> None:
    """Two packets built from an unchanged warehouse must be byte-identical.

    A `generated_at` would make every regeneration differ and turn `diff` from "what
    changed in the data" into noise. When the data was gathered lives on the sources.
    """
    assert _packet().model_dump_json() == _packet().model_dump_json()
    assert "generated_at" not in published_schema()["properties"]


# --- caveats ----------------------------------------------------------------------


def test_acs_metrics_carry_the_overlap_caveat() -> None:
    caveats = caveats_for(level="county", metric_ids=["acs_median_hh_income"])

    assert any("overlap" in c for c in caveats)


def test_a_zip_names_the_weights_behind_its_allocation() -> None:
    """Area and HUD weights encode different assumptions (ARCHITECTURE #37)."""
    caveats = caveats_for(
        level="zip", metric_ids=["zhvi_sfr"], crosswalk_methods=["hud_res_ratio", "area"]
    )

    assert any("allocated" in c and "area, hud_res_ratio" in c for c in caveats)


def test_name_matched_values_say_so() -> None:
    caveats = caveats_for(
        level="municipality",
        metric_ids=["zhvi_sfr"],
        match_methods=["fips", "name_county"],
    )

    assert any("name and county" in c for c in caveats)
    assert not caveats_for(
        level="municipality", metric_ids=["zhvi_sfr"], match_methods=["fips"]
    )


def test_multi_vintage_sources_are_named_not_hinted_at() -> None:
    """The collapsed-vintage defect (#43) must reach the reader concretely."""
    caveats = caveats_for(
        level="county",
        metric_ids=["acs_population"],
        multi_vintage_sources=["census_acs", "hud"],
    )

    assert any("census_acs, hud" in c for c in caveats)


def test_caveat_order_is_stable() -> None:
    """Packets are diffed; a set-ordered caveat list would churn between runs."""
    args = {
        "level": "zip",
        "metric_ids": ["acs_population", "zori_all", "price_to_ami"],
        "match_methods": ["name_county"],
        "crosswalk_methods": ["area"],
        "thin_cohort": True,
    }
    assert caveats_for(**args) == caveats_for(**args)  # type: ignore[arg-type]


# --- labels and rendering ---------------------------------------------------------


@pytest.mark.parametrize(
    ("name", "level", "expected"),
    [
        ("Mercer", "county", "Mercer County, NJ"),
        ("Mercer County", "county", "Mercer County, NJ"),
        ("Princeton", "municipality", "Princeton, NJ"),
        ("08540", "zip", "ZIP 08540, NJ"),
        ("New Jersey", "state", "New Jersey"),
        ("United States", "nation", "United States"),
    ],
)
def test_display_label(name: str, level: str, expected: str) -> None:
    assert display_label(name, level, "NJ") == expected


@pytest.mark.parametrize(
    ("value", "unit", "expected"),
    [
        (453317.4, "usd", "$453,317"),
        (2622.0, "usd_month", "$2,622"),
        (4.5, "percent", "4.5%"),
        (4.1523, "ratio", "4.15"),
        (383286.0, "count", "383,286"),
        (233.46, "index", "233.5"),
        # An index lands on a whole number often enough that ".0" would read as noise.
        (233.0, "index", "233"),
    ],
)
def test_format_value_matches_the_dashboard(
    value: float, unit: str, expected: str
) -> None:
    assert format_value(value, unit) == expected


def test_format_change_always_signs() -> None:
    assert format_change(37.69) == "+37.7%"
    assert format_change(-1.83) == "-1.8%"


def test_report_names_the_region_every_metric_and_every_source() -> None:
    packet = _packet(caveats=["ZORI is sparse."])

    markdown = render_markdown(packet)

    assert markdown.startswith("# Mercer County, NJ — housing report")
    assert "Home value index, single-family" in markdown
    assert "$453,317" in markdown
    assert "9 / 21" in markdown
    assert "ZORI is sparse." in markdown
    assert "Zillow Research" in markdown
    assert "model-generated" in markdown


def test_report_escapes_pipes_so_a_label_cannot_break_the_table() -> None:
    packet = _packet()
    packet.metrics[0].label = "Rent | gross"

    assert "Rent \\| gross" in render_markdown(packet)


def test_report_marks_a_missing_cagr_rather_than_printing_none() -> None:
    packet = _packet()
    packet.metrics[0].cagr = None
    packet.metrics[0].rank = None

    markdown = render_markdown(packet)

    assert "None" not in markdown
    assert "—" in markdown


# --- against a real warehouse -----------------------------------------------------

warehouse = pytest.mark.skipif(not probe().migrated, reason="needs a migrated warehouse")


@pytest.fixture(scope="module")
def session() -> Session:
    return Session(get_engine())


@pytest.fixture(scope="module")
def county_id(session: Session) -> int:
    ids = regions_for_level(session, "county", "5y")
    if not ids:
        pytest.skip("no analytics; run `hip analyze`")
    return ids[0]


@warehouse
def test_packet_values_are_the_warehouse_values(session: Session, county_id: int) -> None:
    """Nothing is computed at assembly time — the packet must echo the tables."""
    packet = build_packet(session, county_id, "5y")

    rows = {
        row["metric_id"]: row
        for row in session.execute(
            text(
                "SELECT metric_id, start_value, end_value, pct_change, window_start, "
                "window_end FROM fact_metric_change "
                'WHERE region_id = :id AND "window" = :w'
            ),
            {"id": county_id, "w": "5y"},
        ).mappings()
    }
    assert len(packet.metrics) == len(rows)
    for metric in packet.metrics:
        row = rows[metric.metric_id]
        assert metric.start_value == row["start_value"]
        assert metric.end_value == row["end_value"]
        assert metric.pct_change == row["pct_change"]
        assert metric.window_start == row["window_start"]
        assert metric.window_end == row["window_end"]


@warehouse
def test_packet_ranks_match_the_rankings_table(session: Session, county_id: int) -> None:
    packet = build_packet(session, county_id, "5y")

    ranked = {
        row["metric_id"]: (row["rank"], row["of"])
        for row in session.execute(
            text(
                'SELECT metric_id, rank, "of" FROM region_rankings '
                'WHERE region_id = :id AND "window" = :w'
            ),
            {"id": county_id, "w": "5y"},
        ).mappings()
    }
    for metric in packet.metrics:
        if metric.metric_id in ranked:
            assert (metric.rank, metric.of) == ranked[metric.metric_id]
            assert metric.rank is not None and 1 <= metric.rank <= metric.of  # type: ignore[operator]


@warehouse
def test_every_metric_carries_its_provenance(session: Session, county_id: int) -> None:
    """A figure without a source is what this platform exists not to serve."""
    packet = build_packet(session, county_id, "5y")

    assert packet.metrics
    assert all(m.release_id is not None for m in packet.metrics)
    assert all(m.source_id for m in packet.metrics)
    assert {m.source_id for m in packet.metrics} <= {s.source_id for s in packet.sources}


@warehouse
def test_a_metric_appears_once(session: Session, county_id: int) -> None:
    """The provenance join is one-to-many unless DISTINCT ON holds it to one row."""
    packet = build_packet(session, county_id, "5y")

    ids = [m.metric_id for m in packet.metrics]
    assert len(ids) == len(set(ids))


@warehouse
def test_highlights_only_name_ends_of_the_cohort(
    session: Session, county_id: int
) -> None:
    packet = build_packet(session, county_id, "5y")

    for highlight in packet.highlights:
        assert highlight.rank <= 3 or highlight.rank > highlight.of - 3
        assert (highlight.position == "leading") == (highlight.rank <= 3)


@warehouse
def test_a_real_packet_validates_against_the_published_schema(
    session: Session, county_id: int
) -> None:
    packet = build_packet(session, county_id, "5y")

    jsonschema.validate(
        json.loads(packet.model_dump_json()), json.loads(SCHEMA_PATH.read_text())
    )


@warehouse
def test_rebuilding_a_packet_produces_identical_bytes(
    session: Session, county_id: int
) -> None:
    first = build_packet(session, county_id, "5y").model_dump_json(indent=2)
    second = build_packet(session, county_id, "5y").model_dump_json(indent=2)

    assert first == second


@warehouse
def test_an_unknown_region_refuses(session: Session) -> None:
    with pytest.raises(PacketUnavailable, match="No region"):
        build_packet(session, -1, "5y")


@warehouse
def test_a_region_with_no_facts_at_all_refuses(session: Session) -> None:
    """An empty packet would validate while telling a reader nothing.

    Since Milestone 7 an unrecognised window is *not* enough to refuse: levels are
    window-independent, so a region with observations still packs. Only a region with
    neither change rows nor observations has nothing to say — a tract, which no source
    reaches.
    """
    bare = session.execute(
        text(
            """
            SELECT r.region_id FROM regions r
            WHERE NOT EXISTS (
                SELECT 1 FROM fact_metric_observation f WHERE f.region_id = r.region_id
            )
            LIMIT 1
            """
        )
    ).scalar_one_or_none()
    if bare is None:
        pytest.skip("every region carries at least one observation")

    with pytest.raises(PacketUnavailable, match="No analytics"):
        build_packet(session, int(bare), "5y")


@warehouse
def test_levels_survive_a_window_with_no_change_rows(
    session: Session, county_id: int
) -> None:
    """A snapshot metric must not disappear because the change window found nothing."""
    packet = build_packet(session, county_id, "1y")

    assert packet.levels, "levels are window-independent and must always be present"


@warehouse
def test_report_renders_from_a_real_packet(session: Session, county_id: int) -> None:
    markdown = render_markdown(build_packet(session, county_id, "5y"))

    assert markdown.count("\n| ") > 10  # metrics and sources tables
    assert "None" not in markdown
