"""The Data Commons survey's reading of its two endpoints, and its verdicts.

Driven against stub responses shaped like the real ones recorded on 2026-11-10, so
what is under test is the parsing (topics dropped, the newest of several imports chosen,
the county read when the town has no figure) and the date rule that keeps an annual
"2025" from reading as older than our "2025-07-01".
"""

from __future__ import annotations

import csv
from datetime import date

import duckdb
import httpx
import pytest

from hip import datacommons as dc
from hip.config import Metric

PLACE, COUNTY = "3402160900", "34021"


def _metric(label: str) -> Metric:
    return Metric(
        label=label,
        unit="usd",
        frequency="annual",
        direction="neutral",
        description="",
        source_id="census_acs",
        record_type="survey",
    )


def _nl(svs: list[tuple[str, float]], answer: dict | None = None) -> dict:
    body: dict = {"charts": [answer] if answer else []}
    if svs:
        body["debug"] = {
            "debug": {
                "sv_matching": {
                    "SV": [s for s, _ in svs],
                    "CosineScore": [c for _, c in svs],
                }
            }
        }
    return body


def _observation(
    variable: str, by_entity: dict[str, list[tuple[str, float, str]]]
) -> dict:
    facets, entities = {}, {}
    for entity, rows in by_entity.items():
        ordered = []
        for i, (when, value, source) in enumerate(rows):
            facet_id = f"{entity}-{i}"
            facets[facet_id] = {"provenanceId": source}
            ordered.append(
                {"facetId": facet_id, "observations": [{"date": when, "value": value}]}
            )
        entities[f"geoId/{entity}"] = {"orderedFacets": ordered}
    return {"byVariable": {variable: {"byEntity": entities}}, "facets": facets}


def _client(nl: dict[str, dict], observations: dict[str, dict]) -> dc.DataCommons:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == "nl.datacommons.org":
            assert request.url.params["key"] == "k"
            return httpx.Response(200, json=nl[request.url.params["q"]])
        assert request.headers["X-API-Key"] == "k"
        variable = request.url.params["variable.dcids"]
        return httpx.Response(200, json=observations.get(variable, {"byVariable": {}}))

    return dc.DataCommons(
        "k", httpx.Client(transport=httpx.MockTransport(handler)), pause=0
    )


@pytest.fixture
def con() -> duckdb.DuckDBPyConnection:
    con = duckdb.connect()
    con.execute(
        "CREATE TABLE stg_regions (geoid VARCHAR, name VARCHAR, state_code VARCHAR, "
        "parent_geoid VARCHAR)"
    )
    con.execute(
        f"INSERT INTO stg_regions VALUES ('{PLACE}', 'Princeton', 'NJ', '{COUNTY}')"
    )
    con.execute(
        "CREATE TABLE stg_metric_observation (metric_id VARCHAR, geoid VARCHAR, "
        "period_end DATE, value DOUBLE)"
    )
    con.execute(
        "INSERT INTO stg_metric_observation VALUES "
        f"('home', '{PLACE}', '2023-12-31', 1.0), "
        f"('home', '{PLACE}', '2024-12-31', 2.0), "
        f"('pop', '{PLACE}', '2025-07-01', 31469), "
        f"('jobless', '{COUNTY}', '2026-09-30', 4.2), "
        f"('fmr', '{COUNTY}', '2027-09-30', 2242)"
    )
    return con


def test_survey_reads_the_newest_import_and_falls_back_to_the_county(
    con, tmp_path
) -> None:
    metrics = {
        "home": _metric("Median home value"),
        "pop": _metric("Population"),
        "jobless": _metric("Unemployment rate"),
        "fmr": _metric("Fair Market Rent"),
        "zhvi": _metric("Home value index"),
        "new": _metric("Crime rate"),
    }
    nl = {
        "Median home value in Princeton, NJ": _nl(
            [
                ("dc/topic/Homes", 0.99),
                ("Median_HomeValue", 0.95),
                ("Count_Home", 0.75),
            ],
            {
                "title": "Median home value in Princeton (2024)",
                "highlight": {"date": "2024", "value": 2.0},
            },
        ),
        "Population in Princeton, NJ": _nl([("Count_Person", 0.9)]),
        "Unemployment rate in Princeton, NJ": _nl([("UnemploymentRate_Person", 1.0)]),
        "Fair Market Rent in Princeton, NJ": _nl([]),
        "Home value index in Princeton, NJ": _nl([("Median_HomeValue", 0.78)]),
        "Crime rate in Princeton, NJ": _nl([("Count_CriminalActivities", 0.88)]),
    }
    observations = {
        "Median_HomeValue": _observation(
            "Median_HomeValue", {PLACE: [("2024", 2.0, "ACS")]}
        ),
        # The survey's 2024 copy leads; the 2026 estimate behind it is the newest.
        "Count_Person": _observation(
            "Count_Person", {PLACE: [("2024", 30756, "ACS"), ("2026", 31600, "PEP")]}
        ),
        # No town figure: the county's is read.
        "UnemploymentRate_Person": _observation(
            "UnemploymentRate_Person", {COUNTY: [("2026-07", 4.8, "BLS")]}
        ),
        "Count_CriminalActivities": _observation(
            "Count_CriminalActivities", {PLACE: [("2024", 120, "FBI")]}
        ),
    }

    findings = {
        f.metric_id: f for f in dc.survey(metrics, _client(nl, observations), con, PLACE)
    }

    home = findings["home"]
    assert home.candidates == [("Median_HomeValue", 0.95), ("Count_Home", 0.75)]
    assert home.verdict == dc.SAME
    assert home.answer == "Median home value in Princeton: 2.0 (2024)"
    assert findings["pop"].theirs == dc.Figure("2026", 31600, PLACE)
    assert findings["pop"].their_source == "PEP"
    assert findings["pop"].verdict == dc.NEWER_THERE
    assert findings["jobless"].theirs == dc.Figure("2026-07", 4.8, COUNTY)
    assert findings["jobless"].verdict == dc.OLDER_THERE
    assert findings["fmr"].verdict == dc.NOT_FOUND
    assert findings["zhvi"].verdict == dc.WEAK
    assert findings["zhvi"].theirs is None  # a weak match is not read
    assert findings["new"].verdict == dc.ONLY_THERE

    json_path, csv_path = dc.write(
        list(findings.values()), tmp_path, PLACE, date(2026, 11, 10)
    )
    assert json_path.name == f"discovery-{PLACE}-2026-11-10.json"
    rows = list(csv.DictReader(csv_path.open()))
    assert rows[0]["verdict"] == dc.NEWER_THERE  # worst news first
    assert {r["metric_id"] for r in rows} == set(metrics)


@pytest.mark.parametrize(
    ("theirs", "ours", "expected"),
    [
        ("2025", "2025-07-01", dc.SAME),
        ("2026", "2025-07-01", dc.NEWER_THERE),
        ("2026-07", "2026-09-30", dc.OLDER_THERE),
        ("2026-10", "2026-09-30", dc.NEWER_THERE),
        ("2024-12-31", "2024-12-31", dc.SAME),
    ],
)
def test_dates_compare_at_the_shorter_precision(
    theirs: str, ours: str, expected: str
) -> None:
    finding = dc.Finding(
        "m",
        "q",
        candidates=[("v", 0.9)],
        score=0.9,
        theirs=dc.Figure(theirs, 1, PLACE),
        ours=dc.Figure(ours, 1, PLACE),
    )
    assert dc.verdict(finding) == expected


def test_a_failed_request_is_recorded_not_raised(con) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(503)

    client = dc.DataCommons(
        "k", httpx.Client(transport=httpx.MockTransport(handler)), pause=0
    )
    [finding] = dc.survey({"home": _metric("Median home value")}, client, con, PLACE)
    assert finding.verdict == dc.FAILED
    assert finding.ours == dc.Figure("2024-12-31", 2.0, PLACE)


def test_the_key_is_required(monkeypatch) -> None:
    monkeypatch.delenv(dc.KEY_ENV, raising=False)
    with pytest.raises(RuntimeError, match="apikeys.datacommons.org"):
        dc.key_from_env()


def test_an_empty_single_figure_answer_falls_back_to_the_table_mode() -> None:
    asked: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        mode = request.url.params["mode"]
        asked.append(mode)
        if mode == "toolformer_rig":
            return httpx.Response(200, json={"charts": []})
        return httpx.Response(200, json=_nl([("Count_Student_PrivateSchool", 0.92)]))

    client = dc.DataCommons(
        "k", httpx.Client(transport=httpx.MockTransport(handler)), pause=0
    )
    candidates, _ = client.ask("Students at private schools in Princeton, NJ")
    assert asked == ["toolformer_rig", "toolformer_rag"]
    assert candidates == [("Count_Student_PrivateSchool", 0.92)]


def test_the_catalogue_lists_every_source_a_place_has() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET":  # what variables exist here
            return httpx.Response(
                200, json={"byVariable": {"Count_Person": {}, "Risk_Score": {}}}
            )
        body = _observation("Count_Person", {COUNTY: [("2024", 1, "dc/base/ACS")]})
        body["byVariable"]["Risk_Score"] = _observation(
            "Risk_Score", {COUNTY: [("2023", 9, "dc/base/FEMA_NRI")]}
        )["byVariable"]["Risk_Score"]
        body["facets"].update({f"{COUNTY}-0": {"provenanceId": "dc/base/ACS"}})
        # Distinct facet ids per source, as the real endpoint gives.
        body["byVariable"]["Risk_Score"]["byEntity"][f"geoId/{COUNTY}"]["orderedFacets"][
            0
        ]["facetId"] = "nri"
        body["facets"]["nri"] = {
            "provenanceId": "dc/base/FEMA_NRI",
            "provenanceUrl": "https://hazards.fema.gov/nri/",
        }
        return httpx.Response(200, json=body)

    client = dc.DataCommons(
        "k", httpx.Client(transport=httpx.MockTransport(handler)), pause=0
    )
    variables = client.variables(COUNTY)
    assert variables == ["Count_Person", "Risk_Score"]
    holdings = client.newest_by_source(COUNTY, variables)
    ours = dc.our_domains({"fema_nfhl": ["https://msc.fema.gov/x"], "x": [""]})
    assert ours == {"fema.gov": ["fema_nfhl"]}
    summaries = {s.source: s for s in dc.catalogue(holdings, ours)}
    assert summaries["dc/base/FEMA_NRI"].same_publisher == ["fema_nfhl"]
    assert summaries["dc/base/FEMA_NRI"].newest == "2023"
    assert summaries["dc/base/ACS"].examples == ["Count_Person"]
