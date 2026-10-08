"""Relationship facts and the causal-wording gate (Milestone 51, ARCHITECTURE #336-#337).

The pace rule is pure; the rest reads the migrated warehouse, as the packet tests do,
because a relationship is only worth narrating if it agrees with the figures beside it.
"""

from __future__ import annotations

import pytest
from sqlalchemy.orm import Session

from hip.analytics.relationships import pace
from hip.eval.formats import consumer_problems, shape_consumer
from hip.packets import Packet, bind, build_packet, render_markdown
from hip.packets.causal import causal_problems
from hip.warehouse.db import get_engine, probe

warehouse = pytest.mark.skipif(
    not probe().migrated,
    reason="needs a migrated warehouse; run `make db-up && make migrate`",
)

HUDSON = 4


def test_one_change_outpaces_another_only_beyond_their_margins() -> None:
    # Hudson 2019-2024: rents +36.2% ± 1.7, incomes +28.9% ± 3.1. The gap, 7.2, is
    # beyond its margin, 3.5.
    assert pace(36.2, 1.7, 28.9, 3.1) == "faster"
    assert pace(28.9, 3.1, 36.2, 1.7) == "slower"
    # A gap of 3 points against margins of 3 each cannot be told apart.
    assert pace(31.0, 3.0, 28.0, 3.0) == "indistinguishable"


@pytest.fixture(scope="module")
def hudson() -> Packet:
    with Session(get_engine()) as session:
        return build_packet(session, HUDSON)


@warehouse
def test_a_ratio_split_agrees_with_the_ratio_it_splits(hudson: Packet) -> None:
    split = next(
        r for r in hudson.relationships if r.relation_id == "ratio_split:price_to_income"
    )
    f = {figure.role: figure.value for figure in split.figures}
    # The ratio is the year's mean home value over the year's income, so its ends are
    # the sides' ends divided — to the six places both are rounded to.
    assert f["ratio_start"] == pytest.approx(
        f["numerator_start"] / f["denominator_start"], abs=1e-5
    )
    assert f["ratio_end"] == pytest.approx(
        f["numerator_end"] / f["denominator_end"], abs=1e-5
    )
    assert split.causal
    metric = next(m for m in hudson.metrics if m.metric_id == "price_to_income")
    assert (split.period_start, split.period_end) == (
        metric.window_start,
        metric.window_end,
    )


@warehouse
def test_only_a_ratio_split_admits_a_cause(hudson: Packet) -> None:
    kinds = {r.kind: r.causal for r in hudson.relationships}
    assert kinds == {"ratio_split": True, "outpaced": False, "supply_and_moves": False}


@warehouse
def test_the_report_states_every_relationship(hudson: Packet) -> None:
    report = render_markdown(hudson)
    assert "## Relationships between figures" in report
    assert report.count("A comparison, not a cause.") == sum(
        r.kind == "outpaced" for r in hudson.relationships
    )


@warehouse
@pytest.mark.parametrize(
    ("sentence", "refused"),
    [
        # A ratio explained by its two sides: arithmetic, so a cause may be said.
        (
            "Home value to household income slipped from 6.81 to 6.65 because incomes "
            "rose 28.9% while home values rose 26%.",
            False,
        ),
        # Method, citing no figure.
        ("Because these survey estimates pool five years, they lag the market.", False),
        # A cause between measures no relationship supports.
        ("Median gross rent rose 36.2% due to incomes rising 28.9%.", True),
        (
            "Home values rose 16% because of newcomers, with net moves at -3.7 per "
            "1,000.",
            True,
        ),
        # Side by side is not a cause.
        ("Median gross rent rose 36.2% while incomes rose 28.9%.", False),
        # Loosened 2026-10-08 (#346): the ratio named by its label, in the sentence
        # before, or in a shorter spoken form, rather than by its figure.
        (
            "The shift in **Home value to household income** occurred because home "
            "values rose 26% while incomes rose 28.9%.",
            False,
        ),
        (
            "Home value to household income slipped from 6.81 to 6.65. This happened "
            "because incomes rose 28.9% while home values rose 26%.",
            False,
        ),
        (
            "The value-to-income ratio fell because home values rose 26% while incomes "
            "rose 28.9%.",
            False,
        ),
        # Method at the head of the clause; a denial; the packet's own caveat.
        (
            "Because the margin of error (± 3.1%) is wide, incomes rose 28.9% at best "
            "roughly.",
            False,
        ),
        (
            "Values rose 26%, but a sale median can rise because pricier homes sold, "
            "not because homes became worth more.",
            False,
        ),
        # Still refused: the sides with no ratio named are a cause between measures.
        ("Home values rose 26% because incomes rose 28.9%.", True),
        # A ratio named, but explained by a measure that is not one of its sides.
        ("Home value to household income fell because rents rose 36.2%.", True),
        (
            "Home value to household income slipped from 6.81 to 6.65. Median gross "
            "rent rose 36.2% due to incomes rising 28.9%.",
            True,
        ),
        # A method word late in the clause does not make the claim about method.
        (
            "Median gross rent rose 36.2% because incomes rose 28.9%, within the survey "
            "margins.",
            True,
        ),
    ],
)
def test_causal_wording_needs_a_relationship_that_supports_it(
    hudson: Packet, sentence: str, refused: bool
) -> None:
    assert bool(causal_problems(sentence, bind(sentence, hudson), hudson)) is refused


@warehouse
def test_an_answer_never_ends_on_a_question(hudson: Packet) -> None:
    """Cumberland's test reading wrote the next heading, misspelled, into its answer."""
    body, sections = shape_consumer(
        "## What stands out here?\n\nRents here are among the highest in the state.\n"
        "What shout I check before moving?\n"
    )
    problems = consumer_problems(body, sections, bind(body, hudson), hudson)
    assert any("ends with a question" in p for p in problems)


@warehouse
def test_a_survey_figure_s_annualised_change_is_left_out(hudson: Packet) -> None:
    survey = [m for m in hudson.metrics if m.survey]
    assert survey and all(m.cagr is None for m in survey)
    assert any(m.cagr is not None for m in hudson.metrics if not m.survey)
