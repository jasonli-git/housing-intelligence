"""A survey word only of a survey figure (ARCHITECTURE #422), on Cumberland's live packet:
the county whose `readings-v8` reading called Zillow's home value a survey estimate."""

from __future__ import annotations

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from hip.packets import bind, build_packet, format_value, render_markdown
from hip.packets.kinds import _SURVEY, kind_problems
from hip.packets.schema import Packet
from hip.warehouse.db import get_engine, probe

warehouse = pytest.mark.skipif(not probe().migrated, reason="needs a migrated warehouse")


@pytest.fixture(scope="module")
def cumberland() -> Packet:
    with Session(get_engine()) as session:
        region = session.execute(
            text(
                "SELECT region_id FROM regions WHERE level = 'county' AND geoid = '34011'"
            )
        ).scalar_one()
        return build_packet(session, region, "5y")


def _usd(packet: Packet, metric_id: str) -> str:
    return format_value(
        next(lv for lv in packet.levels if lv.metric_id == metric_id).value, "usd"
    )


@warehouse
@pytest.mark.parametrize(
    ("sentence", "refused"),
    [
        # readings-v8: a figure-free sentence naming the measure the reading cited.
        (
            "Cumberland has the lowest typical single-family home value at {zhvi}. "
            "However, the typical home value rests on a five-year window of survey "
            "estimates that overlap across consecutive periods.",
            True,
        ),
        (
            "The typical single-family home value is {zhvi}, a five-year survey "
            "estimate.",
            True,
        ),
        # "These" reaches back to the sentence before.
        (
            "The typical single-family home value is {zhvi}. These five-year survey "
            "estimates overlap.",
            True,
        ),
        # The owner-reported value is a survey figure.
        (
            "Owners report a typical home value of {acs}, a five-year survey estimate.",
            False,
        ),
        ("Zillow's typical home value is {zhvi}, not a survey estimate.", False),
        ("Household income comes from the five-year survey.", False),
    ],
)
def test_a_survey_word_needs_a_survey_figure(
    cumberland: Packet, sentence: str, refused: bool
) -> None:
    sentence = sentence.format(
        zhvi=_usd(cumberland, "zhvi_sfr"), acs=_usd(cumberland, "acs_median_home_value")
    )
    binding = bind(sentence, cumberland, payload=render_markdown(cumberland))
    assert bool(kind_problems(sentence, binding, cumberland)) is refused


@pytest.mark.parametrize(
    ("phrase", "survey"),
    [
        ("a five-year survey estimate", True),
        ("from the ACS", True),
        ("five-year estimates", True),
        # Found in readings-v1 and v6: a denial, and the change window every measure has.
        ("this non-survey figure", False),
        ("grew 94% over the five-year window", False),
    ],
)
def test_which_words_claim_a_survey(phrase: str, survey: bool) -> None:
    assert bool(_SURVEY.search(phrase)) is survey
