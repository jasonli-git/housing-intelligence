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


def test_county_fips_on_a_new_database_names_the_missing_spine(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine = create_engine("sqlite://")  # no `regions` table at all
    monkeypatch.setattr(registry, "create_engine", lambda _: engine)
    with pytest.raises(ConfigError, match="No geography spine"):
        registry._county_fips(scope("NJ"))


def test_an_all_sources_run_skips_spine_dependent_sources_by_name(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    import typer

    from hip import cli

    def build(name: str, *_: object, **__: object) -> object:
        if name in ("bls", "hud"):
            raise ConfigError("No geography spine in the warehouse yet")
        return name

    monkeypatch.setattr(cli, "build_adapter", build)
    monkeypatch.setattr(cli, "IMPLEMENTED", ("tiger", "bls", "hud", "zillow_zhvi"))
    assert cli._adapters(None) == ["tiger", "zillow_zhvi"]
    assert "bls" in capsys.readouterr().err
    with pytest.raises(typer.Exit):
        cli._adapters("bls")
