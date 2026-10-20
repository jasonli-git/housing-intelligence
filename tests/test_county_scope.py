"""Source series use the loaded county spine, never NJ's numbering pattern."""

import pytest
from sqlalchemy import create_engine, text

from hip.config import ConfigError, GeographyScope
from hip.sources import registry


def scope(*states: str) -> GeographyScope:
    return GeographyScope(
        states=list(states), levels=["county"], municipality_id_system="census_mcd"
    )


def spine(monkeypatch: pytest.MonkeyPatch, codes: list[tuple[str, str]]) -> None:
    engine = create_engine("sqlite://")
    with engine.begin() as conn:
        conn.execute(
            text("CREATE TABLE regions (geoid TEXT, level TEXT, state_code TEXT)")
        )
        for state, code in codes:
            conn.execute(
                text("INSERT INTO regions VALUES (:code, 'county', :state)"),
                {"state": state, "code": code},
            )
        conn.execute(text("INSERT INTO regions VALUES ('34001', 'tract', 'NJ')"))
    monkeypatch.setattr(registry, "create_engine", lambda _: engine)


def test_county_fips_uses_two_state_spine_including_even_and_large_codes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    spine(
        monkeypatch,
        [
            ("NJ", "34041"),
            ("NJ", "34001"),
            ("AK", "02020"),
            ("AK", "02290"),
            ("NY", "36061"),
        ],
    )
    assert registry._county_fips(scope("NJ", "AK")) == [
        "02020",
        "02290",
        "34001",
        "34041",
    ]


def test_county_fips_refuses_a_state_without_counties(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    spine(monkeypatch, [("NJ", "34001")])
    with pytest.raises(ConfigError, match="No county regions loaded for AK"):
        registry._county_fips(scope("NJ", "AK"))


def test_county_fips_refuses_wrong_state_identity(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    spine(monkeypatch, [("NJ", "36001")])
    with pytest.raises(ConfigError, match="Invalid county GEOID"):
        registry._county_fips(scope("NJ"))
