"""Small synthetic recorded responses through real fetching and landing machinery.

These adapters use the base httpx.stream primitive, not MOD-IV's _client hook, so
we replace that primitive with a MockTransport-backed Client.stream. No sockets.
"""

import json
from datetime import date
from pathlib import Path

import duckdb
import httpx
import pytest

from hip.config import ConfigError
from hip.landing.tabular import land_csv, land_json
from hip.sources.bls import BASE_V1, BASE_V2, BlsAdapter, series_id
from hip.sources.fhfa import MASTER_URL, HpiAdapter
from hip.sources.fred import BASE_URL, FredAdapter

FIXTURES = Path(__file__).parent / "fixtures" / "data_guards"
FAKE_KEY = "synthetic-not-a-credential"


@pytest.fixture
def recorded(monkeypatch):
    clients = []

    def install(body: bytes):
        seen = []

        def handler(request):
            seen.append(request)
            return httpx.Response(200, content=body)

        client = httpx.Client(transport=httpx.MockTransport(handler))
        clients.append(client)
        monkeypatch.setattr(httpx, "stream", client.stream)
        return seen

    yield install
    for client in clients:
        client.close()


@pytest.fixture(autouse=True)
def fake_credentials(monkeypatch):
    monkeypatch.setenv("FRED_API_KEY", FAKE_KEY)
    monkeypatch.setenv("BLS_API_KEY", FAKE_KEY)


@pytest.mark.parametrize("weekly", [False, True])
def test_fred_request_normal_response_and_secret_redaction(tmp_path, recorded, weekly):
    seen = recorded((FIXTURES / "fred.json").read_bytes())
    adapter = FredAdapter()
    ref = adapter.refs()[int(weekly)]
    release = adapter.fetch(ref, raw_dir=tmp_path / "raw")
    [request] = seen
    assert str(request.url).split("?")[0] == BASE_URL
    expected = {"series_id": "MORTGAGE30US", "file_type": "json", "api_key": FAKE_KEY}
    if not weekly:
        expected["frequency"] = "m"
    assert dict(request.url.params) == expected
    out = land_json(release, type(adapter), parquet_dir=tmp_path / "parquet")
    with duckdb.connect() as con:
        assert con.execute(
            "SELECT * FROM read_parquet(?)", [str(out.path)]
        ).fetchall() == [
            (ref.layer, date(2025, 1, 1), "6.5"),
            (ref.layer, date(2025, 3, 1), "6.7"),
        ]
    assert FAKE_KEY not in (release.dir / "manifest.json").read_text()
    assert FAKE_KEY not in release.path.name


def test_fred_without_key_refuses_before_request(monkeypatch):
    monkeypatch.delenv("FRED_API_KEY")
    with pytest.raises(ConfigError, match="FRED_API_KEY"):
        FredAdapter().refs()


@pytest.mark.parametrize(
    "body",
    [
        {"error_code": 400, "error_message": "synthetic invalid request"},
        {"renamed_observations": []},
    ],
)
def test_fred_changed_envelope_or_http_200_error_refused(tmp_path, recorded, body):
    recorded(json.dumps(body).encode())
    adapter = FredAdapter()
    release = adapter.fetch(adapter.refs()[0], raw_dir=tmp_path / "raw")
    with pytest.raises(ValueError, match="fred/.*observations"):
        land_json(release, type(adapter), parquet_dir=tmp_path / "parquet")


@pytest.mark.xfail(
    strict=True,
    raises=pytest.fail.Exception,
    reason=(
        "FRED silently drops observations when value is renamed "
        "instead of refusing shape drift."
    ),
)
def test_fred_renamed_value_is_not_silently_lost(tmp_path, recorded):
    recorded(
        b'{"observations":[{"date":"2025-01-01","value":"6.5"},'
        b'{"date":"2025-03-01","renamed_value":"6.7"}]}'
    )
    adapter = FredAdapter()
    release = adapter.fetch(adapter.refs()[0], raw_dir=tmp_path / "raw")
    with pytest.raises((ValueError, KeyError), match="value"):
        land_json(release, type(adapter), parquet_dir=tmp_path / "parquet")


@pytest.mark.parametrize("keyed", [False, True])
def test_bls_request_and_normal_response(tmp_path, recorded, monkeypatch, keyed):
    if not keyed:
        monkeypatch.delenv("BLS_API_KEY")
    seen = recorded((FIXTURES / "bls.json").read_bytes())
    adapter = BlsAdapter(["34001"], end_year=2025)
    ref = adapter.refs()[0]
    release = adapter.fetch(ref, raw_dir=tmp_path / "raw")
    [request] = seen
    assert str(request.url).split("?")[0] == (
        f"{BASE_V2 if keyed else BASE_V1}/{series_id('34001')}"
    )
    assert series_id("34001") == "LAUCN340010000000003"
    assert dict(request.url.params) == (
        {"registrationkey": FAKE_KEY, "startyear": "2006", "endyear": "2025"}
        if keyed
        else {}
    )
    out = land_json(release, type(adapter), parquet_dir=tmp_path / "parquet")
    with duckdb.connect() as con:
        assert con.execute(
            "SELECT * FROM read_parquet(?)", [str(out.path)]
        ).fetchall() == [("34001", "2025", "M01", "4.2"), ("34001", "2025", "M02", "4.3")]
    assert FAKE_KEY not in (release.dir / "manifest.json").read_text()


@pytest.mark.parametrize(
    "body,problem",
    [
        ({"status": "REQUEST_FAILED"}, "not successful"),
        (
            {
                "status": "REQUEST_SUCCEEDED",
                "message": ["Series does not exist"],
                "Results": {"series": []},
            },
            "Series does not exist",
        ),
        (
            {
                "status": "REQUEST_SUCCEEDED",
                "Results": {
                    "series": [
                        {
                            "data": [
                                {"year": "2025", "period": "M01", "renamed_value": "4"}
                            ]
                        }
                    ]
                },
            },
            "value",
        ),
    ],
)
def test_bls_http_200_failures_and_changed_point_refused(
    tmp_path, recorded, body, problem
):
    recorded(json.dumps(body).encode())
    adapter = BlsAdapter(["34001"], end_year=2025)
    release = adapter.fetch(adapter.refs()[0], raw_dir=tmp_path / "raw")
    with pytest.raises((ValueError, KeyError), match=problem):
        land_json(release, type(adapter), parquet_dir=tmp_path / "parquet")


@pytest.mark.parametrize(
    "body",
    [
        {"status": "REQUEST_SUCCEEDED", "Results": {"series": []}},
        {"status": "REQUEST_SUCCEEDED", "Results": {"renamed_series": []}},
    ],
)
def test_bls_empty_series_is_a_named_failure(tmp_path, recorded, body):
    recorded(json.dumps(body).encode())
    adapter = BlsAdapter(["34001"], end_year=2025)
    release = adapter.fetch(adapter.refs()[0], raw_dir=tmp_path / "raw")
    # The parser returns [], but the real landing boundary refuses it. This is
    # already safe, not a production bug requiring an expected failure.
    with pytest.raises(ValueError, match="bls/.*no rows"):
        land_json(release, type(adapter), parquet_dir=tmp_path / "parquet")


def test_fhfa_master_request_and_csv_values(tmp_path, recorded):
    seen = recorded((FIXTURES / "fhfa.csv").read_bytes())
    adapter = HpiAdapter()
    [ref] = adapter.refs()
    release = adapter.fetch(ref, raw_dir=tmp_path / "raw")
    [request] = seen
    assert str(request.url) == MASTER_URL
    assert not request.url.params
    assert "authorization" not in request.headers
    out = land_csv(release, parquet_dir=tmp_path / "parquet")
    with duckdb.connect() as con:
        assert con.execute(
            "SELECT place_id, yr, period, index_sa FROM read_parquet(?)", [str(out.path)]
        ).fetchall() == [("NJ", 2025, 1, 310), ("USA", 2025, 1, 330)]


@pytest.mark.parametrize("variant", ["renamed_field", "http_200_error"])
@pytest.mark.xfail(
    strict=True,
    raises=pytest.fail.Exception,
    reason=(
        "FHFA master has no adapter-level CSV schema validation: changed headers/HTTP200 "
        "error bodies can land as Parquet; real staging may only fail later."
    ),
)
def test_fhfa_changed_shape_must_be_refused_at_landing(tmp_path, recorded, variant):
    body = (FIXTURES / "fhfa.csv").read_bytes().replace(b"index_sa", b"renamed_index")
    if variant == "http_200_error":
        body = b"error,message\n400,synthetic rejection\n"
    recorded(body)
    adapter = HpiAdapter()
    release = adapter.fetch(adapter.refs()[0], raw_dir=tmp_path / "raw")
    with pytest.raises((ValueError, duckdb.Error), match="index|error|schema|column"):
        land_csv(release, parquet_dir=tmp_path / "parquet")
