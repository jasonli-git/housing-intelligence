"""List limits must remain visible and cannot silently cut published data."""

import json
from pathlib import Path

import pytest
from scripts.check_list_completeness import check
from sqlalchemy import text
from sqlalchemy.orm import Session

from hip.api.routers.analytics import rankings
from hip.api.routers.metrics import region_metrics
from hip.publish import require_complete_list, write_response
from hip.warehouse.db import get_engine, probe
from tests.warehouse_scratch import scratch_warehouse, seed_analytics


@pytest.mark.skipif(not probe().migrated, reason="needs migrated local Postgres")
def test_large_ranking_is_explicit_and_publication_refuses_it(tmp_path: Path) -> None:
    with scratch_warehouse(get_engine()) as engine:
        seed_analytics(engine)
        with engine.begin() as conn:
            conn.execute(
                text("""
                INSERT INTO regions
                  (region_id,geoid,level,name,name_lsad,state_code,parent_id,geom)
                SELECT 10000+n,'test'||n,'county','Synthetic '||n,'Synthetic '||n,
                       'NJ',1,(SELECT geom FROM regions LIMIT 1)
                FROM generate_series(1,1001) n;
                INSERT INTO region_rankings
                  (metric_id,level,basis,"window",region_id,value,rank,"of",percentile,ties)
                SELECT 'zhvi_sfr','county','value','latest',10000+n,n,n,1001,
                       100.0*(1001-n)/1000,1
                FROM generate_series(1,1001) n
            """)
            )
        with Session(engine) as session:
            body = rankings(session, "zhvi_sfr", "county", "5y", "value", 1000)
        assert body.total == 1001
        assert len(body.items) == 1000
        target = tmp_path / "rankings/test.json"
        target.parent.mkdir()
        target.write_bytes(b"previous complete artifact")
        with pytest.raises(RuntimeError, match="fetched 1000, total 1001"):
            write_response(
                tmp_path,
                "/rankings?limit=1000",
                "rankings/test.json",
                body.model_dump_json().encode(),
            )
        assert target.read_bytes() == b"previous complete artifact"


@pytest.mark.skipif(not probe().migrated, reason="needs migrated local Postgres")
def test_metrics_total_precedes_limit_and_respects_filters() -> None:
    with scratch_warehouse(get_engine()) as engine:
        seed_analytics(engine)
        with Session(engine) as session:
            region = session.execute(
                text("SELECT min(region_id) FROM regions")
            ).scalar_one()
            body = region_metrics(region, session, limit=1)
            assert body.total > len(body.observations) == 1
            with pytest.raises(RuntimeError, match="incomplete observations"):
                require_complete_list(f"/regions/{region}/metrics", body.model_dump())
            filtered = region_metrics(region, session, metric_id=["zhvi_sfr"])
            assert filtered.total == len(filtered.observations) == 16
            empty = region_metrics(region, session, metric_id=["does_not_exist"])
            assert empty.total == 0 and empty.observations == []


@pytest.mark.parametrize(
    "payload",
    [
        {"items": []},
        {"total": -1, "items": []},
        {"total": True, "items": [1]},
        {"total": 2, "items": [1]},
    ],
)
def test_unknown_or_inconsistent_completeness_is_refused(payload: dict) -> None:
    with pytest.raises(RuntimeError):
        require_complete_list("/rankings", payload)


def test_check_dist_checks_the_artifact_not_just_manifest_presence(
    tmp_path: Path,
) -> None:
    (tmp_path / "manifest.json").write_text(
        json.dumps(
            {"artifacts": [{"path": "list.json", "source": "/rankings?limit=1000"}]}
        )
    )
    (tmp_path / "list.json").write_text('{"total":1,"items":[{}]}')
    assert check(tmp_path) == 1
    (tmp_path / "list.json").write_text('{"total":2,"items":[{}]}')
    with pytest.raises(RuntimeError, match="incomplete items"):
        check(tmp_path)


def test_complete_payload_bytes_are_written_without_reserialization(
    tmp_path: Path,
) -> None:
    payload = b'{"items": [1], "total": 1}\n'
    write_response(tmp_path, "/rankings", "list.json", payload)
    assert (tmp_path / "list.json").read_bytes() == payload
