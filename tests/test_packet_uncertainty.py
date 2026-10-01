"""Margins and rank ranges in packets, reports and prose (Milestone 30, principle 12).

Packet 1.3 carries each survey figure's margin and each rank's range; the Markdown report
shows them, and shows an uncertain rank only as its range; binding licenses a margin and
both ends of a range; and `margin_problems` says where prose quotes a survey figure more
exactly than its survey allows. The pure half needs no warehouse; the last tests check a
real packet against the tables it was read from.
"""

from __future__ import annotations

import re
from datetime import date, datetime
from pathlib import Path

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from hip.packets import bind, build_packet, packet_content_hash, render_markdown
from hip.packets.assemble import _highlights
from hip.packets.citations import Binding, Citation
from hip.packets.margins import margin_problems
from hip.packets.report import (
    MULTIPLE_METRICS,
    NO_MARGIN,
    NO_SAMPLING_ERROR,
    SHARE_METRICS,
    format_metric,
    margin_label,
    ordinal,
    rank_label,
    rank_words,
)
from hip.packets.schema import (
    Packet,
    PacketComparisons,
    PacketLevel,
    PacketMetric,
    PacketRegion,
    PacketSource,
    PacketWindow,
)
from hip.warehouse.db import get_engine, probe

ROOT = Path(__file__).resolve().parents[1]
INCOME = "Median household income"
BURDEN = "Renters paying over 30% of income on housing"


def _metric(**fields: object) -> PacketMetric:
    base: dict[str, object] = {
        "metric_id": "acs_median_hh_income",
        "label": INCOME,
        "unit": "usd",
        "direction": "higher_is_better",
        "window_start": date(2019, 12, 31),
        "window_end": date(2024, 12, 31),
        "start_value": 81057.0,
        "end_value": 100645.0,
        "pct_change": 24.17,
        "cagr": 4.42,
        "rank": 12,
        "of": 21,
        "percentile": 45.0,
        "release_id": 7,
        "source_id": "census_acs",
        "match_method": "fips",
        "start_release_id": 3,
        "start_match_method": "fips",
        "survey": True,
        "pct_change_margin": 4.03,
        "start_margin": 1626.0,
        "end_margin": 2565.0,
        "rank_best": 3,
        "rank_worst": 20,
    }
    return PacketMetric(**{**base, **fields})  # type: ignore[arg-type]


def _level(**fields: object) -> PacketLevel:
    base: dict[str, object] = {
        "metric_id": "acs_median_hh_income",
        "label": INCOME,
        "unit": "usd",
        "direction": "higher_is_better",
        "value": 100645.0,
        "period_start": date(2020, 1, 1),
        "period_end": date(2024, 12, 31),
        "rank": 11,
        "of": 21,
        "percentile": 50.0,
        "release_id": 7,
        "source_id": "census_acs",
        "match_method": "fips",
        "survey": True,
        "margin_of_error": 2565.0,
        "rank_best": 10,
        "rank_worst": 12,
    }
    return PacketLevel(**{**base, **fields})  # type: ignore[arg-type]


def uncertain_packet() -> Packet:
    """Mercer County's income, a share, a CHAS figure, a controlled population and a
    multiple — each kind of margin — beside Zillow's index, which has none."""
    return Packet(
        packet_version="1.3",
        region=PacketRegion(
            region_id=11,
            geoid="34021",
            level="county",
            name="Mercer",
            label="Mercer County, NJ",
            state_code="NJ",
        ),
        window=PacketWindow(label="5y", start=date(2019, 12, 31), end=date(2026, 8, 31)),
        metrics=[
            _metric(),
            _metric(
                metric_id="zhvi_sfr",
                label="Home value index, single-family",
                direction="neutral",
                window_start=date(2021, 8, 31),
                window_end=date(2026, 8, 31),
                start_value=331086.0,
                end_value=445078.0,
                pct_change=34.43,
                cagr=6.1,
                rank=11,
                source_id="zillow_zhvi",
                survey=False,
                pct_change_margin=None,
                start_margin=None,
                end_margin=None,
                rank_best=None,
                rank_worst=None,
            ),
        ],
        levels=[
            _level(),
            _level(
                metric_id="acs_renter_cost_burden",
                label=BURDEN,
                unit="ratio",
                direction="lower_is_better",
                value=0.5008,
                rank=7,
                margin_of_error=0.0231,
                rank_best=3,
                rank_worst=14,
            ),
            _level(
                metric_id="chas_owner_cost_burden",
                label="Owners paying over 30% of income, HUD CHAS",
                unit="ratio",
                direction="lower_is_better",
                value=0.2406,
                rank=5,
                source_id="hud_chas",
                margin_of_error=None,
                rank_best=None,
                rank_worst=None,
            ),
            _level(
                metric_id="acs_population",
                label="Total population",
                unit="count",
                direction="neutral",
                value=385864.0,
                rank=12,
                margin_of_error=0.0,
                rank_best=12,
                rank_worst=12,
            ),
            _level(
                metric_id="price_to_income",
                label="Home value to household income",
                unit="ratio",
                direction="lower_is_better",
                value=4.26,
                rank=9,
                source_id="hip_derived",
                margin_of_error=0.1086,
                rank_best=8,
                rank_worst=9,
            ),
        ],
        comparisons=PacketComparisons(
            peer_level="county", peer_scope="NJ", peer_count=21
        ),
        highlights=[],
        caveats=[],
        sources=[
            PacketSource(
                source_id="census_acs",
                name="American Community Survey, 5-year estimates",
                publisher="U.S. Census Bureau",
                license="public domain",
                url="https://example.invalid",
                vintage="2024",
                fetched_at=datetime(2026, 9, 26, 12, 0),
                release_ids=[7],
            )
        ],
    )


@pytest.fixture
def packet() -> Packet:
    return uncertain_packet()


# --- the packet ------------------------------------------------------------------


def test_a_1_2_packet_still_parses_with_no_uncertainty() -> None:
    older = _metric(survey=False, pct_change_margin=None, rank_best=None, rank_worst=None)
    dumped = older.model_dump(mode="json")
    for field in ("survey", "pct_change_margin", "start_margin", "end_margin"):
        dumped.pop(field)
    parsed = PacketMetric.model_validate(dumped)
    assert parsed.survey is False
    assert parsed.pct_change_margin is None


def test_a_margin_is_content_so_changing_one_stales_a_reading(packet: Packet) -> None:
    before = packet_content_hash(packet)
    packet.levels[0].margin_of_error = 2600.0
    assert packet_content_hash(packet) != before


def test_a_ranged_rank_stands_out_only_when_its_whole_range_does() -> None:
    """The region pages' rule (ARCHITECTURE #241): third with a range to tenth is not a
    stand-out, and second with a range to third is."""
    uncertain = _metric(rank=3, rank_best=1, rank_worst=10)
    certain = _metric(metric_id="a", rank=2, rank_best=1, rank_worst=3)
    trailing = _metric(metric_id="b", rank=20, rank_best=19, rank_worst=21)
    unranged = _metric(metric_id="c", rank=1, rank_best=None, rank_worst=None)

    chosen = {
        h.metric_id: h for h in _highlights([uncertain, certain, trailing, unranged])
    }

    assert set(chosen) == {"a", "b", "c"}
    assert chosen["a"].position == "leading"
    assert (chosen["a"].rank_best, chosen["a"].rank_worst) == (1, 3)
    assert chosen["b"].position == "trailing"


# --- the report ------------------------------------------------------------------


def test_the_report_gives_every_survey_figure_its_margin(packet: Packet) -> None:
    markdown = render_markdown(packet)

    assert "$100,645 ± $2,565" in markdown
    assert "$81,057 ± $1,626" in markdown
    assert "+24.2% ± 4.0%" in markdown
    assert "50.1% ± 2.3 points" in markdown
    assert "4.26× ± 0.11×" in markdown
    assert f"24.1% ({NO_MARGIN})" in markdown
    assert f"385,864 ({NO_SAMPLING_ERROR})" in markdown
    assert "## Margins of error" in markdown


def test_the_report_shows_an_uncertain_rank_only_as_its_range(packet: Packet) -> None:
    markdown = render_markdown(packet)

    assert "3rd–20th of 21 (can't be told apart from most)" in markdown
    assert "10th–12th of 21 (near the middle)" in markdown
    income = next(
        line for line in markdown.splitlines() if line.startswith(f"| {INCOME} | $100")
    )
    assert "11th" not in income  # the point rank is the packet's, not the report's
    # A range of one place is a place.
    assert "| Total population | 385,864 (no sampling error) | 12th of 21 |" in markdown


def test_a_survey_figures_annualised_change_is_left_out(packet: Packet) -> None:
    markdown = render_markdown(packet)

    assert "4.4%/yr" not in markdown
    assert "6.1%/yr" in markdown  # Zillow's index has no margin to carry


def test_a_figure_without_sampling_error_reads_as_before(packet: Packet) -> None:
    markdown = render_markdown(packet)
    assert (
        "| Home value index, single-family | $331,086 | $445,078 | +34.4% |" in markdown
    )


@pytest.mark.parametrize(
    ("best", "worst", "of", "words"),
    [
        (1, 3, 21, "near the top"),
        (18, 21, 21, "near the bottom"),
        (9, 13, 21, "near the middle"),
        (3, 20, 21, "can't be told apart from most"),
        (1, 21, 21, "too uncertain to place"),
        (2, 12, 21, "toward the top"),
        (10, 19, 21, "toward the bottom"),
    ],
)
def test_rank_words_match_the_dashboard(
    best: int, worst: int, of: int, words: str
) -> None:
    assert rank_words(best, worst, of) == words


def test_ordinals() -> None:
    assert [ordinal(n) for n in (1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111)] == [
        "1st", "2nd", "3rd", "4th", "11th", "12th", "13th",
        "21st", "22nd", "23rd", "101st", "111th",
    ]  # fmt: skip


def test_rank_label_for_an_unranked_entry() -> None:
    assert rank_label(_level(rank=None, of=None)) == "—"


def test_a_share_whose_margin_passes_zero_reads_as_its_range() -> None:
    label = margin_label(0.12, 0.28, "ratio", "acs_vacancy_rate", survey=True)
    assert label == "0.0% to 40.0%"


def test_formats_match_the_dashboard() -> None:
    assert format_metric(0.6215, "ratio", "acs_homeownership_rate") == "62.2%"
    assert format_metric(4.2598, "ratio", "price_to_income") == "4.26×"
    assert format_metric(1623.0, "usd_month", "acs_median_gross_rent") == "$1,623/mo"
    assert format_metric(100645.0, "usd", "acs_median_hh_income") == "$100,645"


def _web_set(name: str) -> set[str]:
    source = (ROOT / "web" / "lib" / "format.ts").read_text(encoding="utf-8")
    block = re.search(
        rf"{name}: ReadonlySet<string> = new Set\(\[(.*?)\]\)", source, re.S
    )
    assert block, f"{name} not found in web/lib/format.ts"
    return set(re.findall(r'"([a-z0-9_]+)"', block.group(1)))


def test_the_report_classes_ratios_as_the_dashboard_does() -> None:
    """A share rendered as "0.50" in the report and "50.1%" on the page would give the
    two a different figure — and a reading a different number to quote."""
    assert _web_set("SHARE_METRICS") == SHARE_METRICS
    assert _web_set("MULTIPLE_METRICS") == MULTIPLE_METRICS


# --- binding -----------------------------------------------------------------------


def test_margins_bind_to_the_quantity_they_qualify(packet: Packet) -> None:
    prose = (
        "Household income rose 24.2% (± 4.0%) from $81,057 (± $1,626) to $100,645 "
        "(± $2,565). The typical household earns $100,645 a year, give or take $2,600. "
        "Half of renters, 50.1% (± 2.3 points), pay over 30% of income for housing. "
        "A home costs 4.26 times income, give or take 0.11."
    )
    binding = bind(prose, packet, payload=render_markdown(packet))

    assert binding.complete, binding.unbound
    fields = {(c.text, c.field) for c in binding.citations}
    assert ("4.0%", "metrics[acs_median_hh_income].pct_change_margin") in fields
    assert ("$1,626", "metrics[acs_median_hh_income].start_margin") in fields
    assert ("$2,565", "levels[acs_median_hh_income].margin_of_error") in fields
    # Two significant figures: a margin is itself an estimate.
    assert ("$2,600", "levels[acs_median_hh_income].margin_of_error") in fields
    assert ("2.3", "levels[acs_renter_cost_burden].margin_of_error") in fields
    assert ("0.11", "levels[price_to_income].margin_of_error") in fields


def test_a_range_binds_both_ends_to_one_entry(packet: Packet) -> None:
    binding = bind("Income ranks between 10th and 12th of 21 counties.", packet)
    ranks = [c.field for c in binding.citations if c.kind == "rank"]
    assert ranks == [
        "levels[acs_median_hh_income].rank_best",
        "levels[acs_median_hh_income].rank_worst",
    ]


@pytest.mark.parametrize(
    "prose",
    [
        "About half of renters spend more than 30 percent of their income on housing.",
        "Renters paying 30% of their income or more are 50.1% ± 2.3 points.",
    ],
)
def test_a_labels_income_threshold_paraphrased_is_the_label(
    packet: Packet, prose: str
) -> None:
    """A measure's threshold, however it is worded, is not a claim that something moved
    30% — which would bind to a 29.7% change and read as a survey figure without its
    margin (found in the first side-by-side, 2026-09-27)."""
    binding = bind(prose, packet)
    first = binding.citations[0]
    assert first.kind == "text"
    assert not margin_problems(prose, binding, packet)


def test_a_number_inside_a_quoted_label_is_the_label(packet: Packet) -> None:
    """ "30%" in "paying over 30% of income" names the measure; it is not a claim that
    something rose 30%."""
    binding = bind("Renters paying over 30% of income are 50.1% ± 2.3 points.", packet)
    first = binding.citations[0]
    assert (first.text, first.kind) == ("30%", "text")


# --- the principle-12 check --------------------------------------------------------


def _problems(prose: str, packet: Packet) -> list[tuple[str, str]]:
    binding = bind(prose, packet, payload=render_markdown(packet))
    assert binding.complete, binding.unbound
    return [(p.text, p.reason) for p in margin_problems(prose, binding, packet)]


def test_a_survey_figure_with_its_margin_passes(packet: Packet) -> None:
    assert (
        _problems(
            "Household income rose 24.2% (± 4.0%) to $100,645 (± $2,565), between 10th "
            "and 12th of 21 counties.",
            packet,
        )
        == []
    )


def test_a_survey_figure_without_its_margin_is_a_problem(packet: Packet) -> None:
    problems = _problems("Household income rose 24.2% to $100,645.", packet)
    assert [text for text, _ in problems] == ["24.2%", "$100,645"]


def test_a_margin_rounded_from_its_printed_form_passes() -> None:
    """Flash-Lite's consumer reading of Sussex, 2026-10-01: the packet prints the vacancy
    change's margin, 7.47, as "± 7.5%", and the prompt lets a writer round a margin to a
    whole number. "Give or take 8%" was refused, because 7.47 itself rounds to 7."""
    from hip.packets.citations import states_margin

    def gives(text: str, margin: float) -> bool:
        return states_margin(text, 0, len(text), margin)

    assert gives("The vacancy rate fell 44.4%, give or take 8%.", 7.470233)
    assert gives("Rent rose 12%, give or take 3%.", 2.5)  # half up, not to even
    assert gives("The share is 50%, give or take 3 points.", 0.025)
    assert not gives("The vacancy rate fell 44.4%, give or take 9%.", 7.470233)


def test_a_margin_must_be_the_one_for_that_quantity(packet: Packet) -> None:
    """The change's margin does not vouch for the value beside it."""
    problems = _problems("Household income rose 24.2% (± 4.0%) to $100,645.", packet)
    assert [text for text, _ in problems] == ["$100,645"]


def test_a_figure_is_judged_under_every_field_it_could_be_read_from(
    packet: Packet,
) -> None:
    """Gemini's consumer reading of Mercer, 2026-09-27: binding gave "4%" to another
    ratio's change margin for the words around it, and the income change beside it read
    as bare. The sentence gives the income change its margin; it is not refused."""
    packet.metrics.append(
        _metric(
            metric_id="fmr_to_income",
            label="Two-bedroom Fair Market Rent to household income",
            unit="ratio",
            direction="lower_is_better",
            start_value=0.2157,
            end_value=0.2418,
            pct_change=12.18,
            pct_change_margin=3.64,
            start_margin=0.0043,
            end_margin=0.0062,
            rank=14,
            rank_best=12,
            rank_worst=16,
        )
    )
    assert not _problems(
        "Typical household incomes rose by 24% (give or take 4%), while two-bedroom "
        "rents measured against household income rose too.",
        packet,
    )


def test_a_rank_that_is_one_place_by_value_is_fine_beside_a_ranged_change(
    packet: Packet,
) -> None:
    """Gemini's analyst reading of Mercer, 2026-09-27: "62.2%, ranking 17th of 21" is
    the rank by value, one place, though binding gave "17th" to the change's rank, which
    the survey places only within 7th-21st."""
    packet.metrics.append(
        _metric(
            metric_id="acs_homeownership_rate",
            label="Homeownership rate",
            unit="ratio",
            direction="neutral",
            start_value=0.631,
            end_value=0.6215,
            pct_change=-1.43,
            pct_change_margin=2.18,
            start_margin=0.0084,
            end_margin=0.011,
            rank=17,
            rank_best=7,
            rank_worst=21,
        )
    )
    packet.levels.append(
        _level(
            metric_id="acs_homeownership_rate",
            label="Homeownership rate",
            unit="ratio",
            direction="neutral",
            value=0.6215,
            rank=17,
            margin_of_error=0.011,
            rank_best=17,
            rank_worst=17,
        )
    )
    assert not _problems(
        "Homeownership eased to 62.2% (± 1.1 points), ranking 17th of 21.", packet
    )


def test_a_ranges_ends_split_by_binding_are_still_a_range(packet: Packet) -> None:
    """ "10th–12th" whose first end binding gave to another measure's range, and whose
    second went to a single rank: the sentence still quotes income's range."""
    packet.metrics.append(
        _metric(
            metric_id="price_to_income",
            label="Home value to household income",
            unit="ratio",
            direction="lower_is_better",
            start_value=3.38,
            end_value=4.26,
            pct_change=26.2,
            pct_change_margin=4.09,
            start_margin=0.068,
            end_margin=0.109,
            rank=13,
            rank_best=10,
            rank_worst=15,
        )
    )
    assert not _problems(
        "Household income is 10th–12th of 21, and home value to household income "
        "8th–9th of 21.",
        packet,
    )


def test_a_number_quoted_from_a_caveat_is_the_caveats(packet: Packet) -> None:
    """HUD's move "from the 50th to the 40th percentile" is a change of method a caveat
    describes, not a percentile of this region."""
    packet.caveats.append(
        "HUD moved some areas' Fair Market Rents from the 50th to the 40th percentile."
    )
    prose = "HUD moved some areas from the 50th to the 40th percentile."
    binding = bind(prose, packet)
    assert [c.kind for c in binding.citations] == ["text", "text"]
    assert not margin_problems(prose, binding, packet)


def test_a_threshold_introduced_rather_than_followed_is_the_labels(
    packet: Packet,
) -> None:
    packet.levels.append(
        _level(
            metric_id="chas_renter_severe_burden",
            label="Renters paying over 50% of income, HUD CHAS",
            unit="ratio",
            direction="lower_is_better",
            value=0.2443,
            rank=11,
            source_id="hud_chas",
            margin_of_error=None,
            rank_best=None,
            rank_worst=None,
        )
    )
    prose = "And 24.4% of renters pay over 50%, with no margin available."
    binding = bind(prose, packet)
    assert [c.kind for c in binding.citations] == ["value", "text"]
    assert not margin_problems(prose, binding, packet)


def test_a_margin_in_another_sentence_is_not_beside_the_figure(packet: Packet) -> None:
    problems = _problems(
        "Household income is $100,645. Its margin of error is $2,565.", packet
    )
    assert [text for text, _ in problems] == ["$100,645"]


def test_a_survey_figure_with_no_margin_must_say_so(packet: Packet) -> None:
    assert _problems("Owners paying over 30% of income were 24.1%.", packet)
    assert not _problems(
        "Owners paying over 30% of income were 24.1%, with no margin available.", packet
    )


def test_a_controlled_figure_must_say_it_has_no_sampling_error(packet: Packet) -> None:
    assert _problems("The population is 385,864.", packet)
    assert not _problems("The population is 385,864, with no sampling error.", packet)


def test_an_uncertain_rank_quoted_as_a_place_is_a_problem(packet: Packet) -> None:
    single = _problems("Renter cost burden ranks 7th of 21.", packet)
    assert len(single) == 1 and "single rank" in single[0][1]

    one_end = _problems("Household income ranks 10th of 21 counties.", packet)
    assert len(one_end) == 1 and "one end" in one_end[0][1]


def test_a_rank_the_survey_can_place_is_fine(packet: Packet) -> None:
    assert not _problems("Its population ranks 12th of 21.", packet)


def test_figures_without_sampling_error_need_nothing(packet: Packet) -> None:
    assert not _problems("Home values rose 34.4% to $445,078, 11th of 21.", packet)


# --- against a real warehouse --------------------------------------------------------

warehouse = pytest.mark.skipif(not probe().migrated, reason="needs a migrated warehouse")


@warehouse
def test_a_real_packet_carries_the_warehouse_margins_and_ranges() -> None:
    with Session(get_engine()) as session:
        county = session.execute(
            text(
                "SELECT region_id FROM regions WHERE level = 'county' ORDER BY 1 LIMIT 1"
            )
        ).scalar_one()
        packet = build_packet(session, county, "5y")
        rows = {
            row["metric_id"]: row
            for row in session.execute(
                text(
                    "SELECT metric_id, pct_change_margin, start_margin, end_margin "
                    "FROM fact_metric_change WHERE region_id = :id AND \"window\" = '5y'"
                ),
                {"id": county},
            ).mappings()
        }

    surveyed = [m for m in packet.metrics if m.survey]
    assert surveyed, "a county packet has ACS figures"
    for metric in packet.metrics:
        row = rows[metric.metric_id]
        assert metric.pct_change_margin == row["pct_change_margin"]
        assert metric.start_margin == row["start_margin"]
        assert metric.end_margin == row["end_margin"]
        if metric.rank_best is not None:
            assert metric.rank is not None and metric.rank_worst is not None
            assert metric.rank_best <= metric.rank <= metric.rank_worst
    assert not any(m.survey for m in packet.metrics if m.source_id == "zillow_zhvi")


def _rank_at(prose: str, figure: str, field: str) -> Citation:
    start = prose.index(figure)
    return Citation(
        text=figure,
        start=start,
        end=start + len(figure),
        value=float(figure),
        packet_value=float(figure),
        field=field,
        kind="rank",
    )


@pytest.mark.parametrize(
    "prose",
    [
        "Renter cost burden sits 3rd–14th of 21 counties.",
        "Renter cost burden sits between 3rd and 14th of 21 counties.",
        "Renter cost burden sits from 3rd to 14th of 21 counties.",
    ],
)
def test_a_range_written_as_one_passes_wherever_its_ends_were_bound(
    packet: Packet, prose: str
) -> None:
    """Binding places each end on its own, so the two can land on different measures
    that share the values; the range as written is what the rule is about (#266). Three
    of Gemini's four analyst refusals on 2026-09-28 were this."""
    binding = Binding(
        citations=[
            _rank_at(prose, "3", "levels[acs_renter_cost_burden].rank_best"),
            _rank_at(prose, "14", "metrics[zhvi_sfr].rank"),
        ]
    )
    assert not margin_problems(prose, binding, packet)


def test_two_ranks_that_happen_to_be_the_ends_are_not_a_range(packet: Packet) -> None:
    prose = "Renter cost burden ranks 3rd, and home values 14th of 21 counties."
    binding = Binding(
        citations=[
            _rank_at(prose, "3", "levels[acs_renter_cost_burden].rank_best"),
            _rank_at(prose, "14", "metrics[zhvi_sfr].rank"),
        ]
    )
    [problem] = margin_problems(prose, binding, packet)
    assert problem.text == "3" and "one end of the range 3–14" in problem.reason


def test_a_movement_between_two_ranks_is_not_a_range(packet: Packet) -> None:
    """ "Rose from 14th to 3rd" names two places, even where the survey's range is
    exactly 3rd–14th."""
    prose = "Renter cost burden rose from 14th to 3rd of 21 counties."
    binding = Binding(
        citations=[
            _rank_at(prose, "14", "metrics[zhvi_sfr].rank"),
            _rank_at(prose, "3", "levels[acs_renter_cost_burden].rank_best"),
        ]
    )
    [problem] = margin_problems(prose, binding, packet)
    assert problem.text == "3"
