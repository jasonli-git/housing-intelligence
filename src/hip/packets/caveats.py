"""Limitations that travel with the numbers instead of living in a document.

One derivation, two consumers: the analysis packet and `GET /regions/{id}/summary`. The
router kept its own copy until Milestone 6, which meant a model reading a packet and a
person reading the dashboard could be told different things about the same figure.

Pure — no database, no I/O. Callers pass what they know; anything they cannot cheaply
determine defaults to absent and simply produces no caveat. Order is fixed by the rule
sequence below rather than by set iteration, so two runs produce the same list.
"""

from __future__ import annotations

from collections.abc import Collection
from dataclasses import dataclass

# Ratios the platform computes from two published series (ARCHITECTURE #34).
DERIVED_RATIOS = frozenset(
    {"price_to_income", "rent_to_income", "price_to_ami", "fmr_to_income"}
)

# Milestone 21's HUD figures, each with a caveat of its own below.
FMR_METRICS = frozenset({"hud_fmr_2br", "fmr_to_income"})
CHAS_METRICS = frozenset(
    {"chas_renter_cost_burden", "chas_renter_severe_burden", "chas_owner_cost_burden"}
)

# Each entry is written to stand on its own: a packet may be read with no other context,
# so "see the docs" would be useless to its reader.
TEXTS: dict[str, str] = {
    "acs_overlap": (
        "ACS 5-year vintages overlap by four years, so consecutive estimates are not "
        "independent measurements and short windows understate the real separation."
    ),
    "derived_ratio": (
        "Affordability ratios are computed by this platform from two published series, "
        "not published by either source. The monthly value or rent series is averaged "
        "over the survey year to match the annual income denominator."
    ),
    "zori_sparse": (
        "Zillow's rent index begins in 2015 and covers far fewer places than its "
        "home-value index, so any rent figure rests on a thinner base — and ranks "
        "against a smaller cohort — than a value figure."
    ),
    "national_series": (
        "The 30-year mortgage rate is a national series. It is identical for every "
        "region and describes the country, not this place."
    ),
    "fhfa_state_only": (
        "FHFA's house price indexes are published at state level only; no county series "
        "is available at a reachable URL, so they cannot be compared across counties."
    ),
    "hud_fmr_area": (
        "Fair Market Rents are HUD's rent standard for a whole FMR area, set once per "
        "federal fiscal year from 1 October, so counties in one area share a figure and "
        "a rank among them compares areas. HUD moved some New Jersey areas from the "
        "50th to the 40th percentile by fiscal 2020, so a change spanning that year "
        "mixes two standards. In nine counties vouchers use HUD's ZIP-level Small Area "
        "FMRs instead, which are not shown here."
    ),
    "chas_one_vintage": (
        "CHAS figures are HUD's tabulation of ACS 2018-2022 microdata, published a year "
        "behind the ACS they draw on. One vintage is loaded, so they show no change over "
        "time and describe earlier years than the newest ACS figures beside them."
    ),
    "permits_volatile": (
        "Permit counts are small numbers below county level, so a large percentage "
        "change can rest on a handful of units and mean little."
    ),
    "hud_county_ami": (
        "HUD publishes income limits per county, so every AMI-based figure here is a "
        "county figure. HUD does not sanction allocating one down to a municipality."
    ),
    "zip_allocated": (
        "ZIP-level values are allocated from Census ZCTAs rather than measured. A ZIP "
        "straddling several municipalities is an estimate, not an observation."
    ),
    "name_matched": (
        "Some values here were matched to this place by name and county rather than by "
        "FIPS code. That is a weaker claim than an exact identifier match, and Zillow "
        "publishes no FIPS below county level."
    ),
    "thin_cohort": (
        "Some metrics rank this region against fewer peers than the level contains, "
        "because not every region carries every metric. Compare ranks only within the "
        "cohort size each one reports."
    ),
    "collapsed_vintage": (
        "Release provenance names the source correctly but not the vintage: values "
        "spanning several periods all cite one release, though the source publishes "
        "more than one. The figures are right; the file credited for them may not be. "
        "Sources affected here: {sources}."
    ),
}


def caveats_for(
    *,
    level: str,
    metric_ids: Collection[str],
    match_methods: Collection[str] = (),
    crosswalk_methods: Collection[str] = (),
    thin_cohort: bool = False,
    multi_vintage_sources: Collection[str] = (),
) -> list[str]:
    """The caveats that apply to one region's figures, in a stable order.

    `crosswalk_methods` names the allocation weights behind a ZIP's values —
    `hud_res_ratio` or `area` (ARCHITECTURE #37). Naming them matters because the two
    encode different assumptions and a reader cannot tell from the number which one
    produced it.

    `multi_vintage_sources` are sources whose facts for this region actually cite one
    release across several periods when the source publishes more than one vintage.
    Milestone 7 fixed the loader that caused it (#53), so the caller now derives this
    from the fact table rather than from a source's vintage count — the caveat should
    appear only if something regresses.

    The texts of `scoped_caveats`, in its order. This plain list is what the packet
    carries, so a model reads — and the packet's content hash covers — exactly what it
    did before scopes existed.
    """
    return [
        caveat.text
        for caveat in scoped_caveats(
            level=level,
            metric_ids=metric_ids,
            match_methods=match_methods,
            crosswalk_methods=crosswalk_methods,
            thin_cohort=thin_cohort,
            multi_vintage_sources=multi_vintage_sources,
        )
    ]


@dataclass(frozen=True)
class ScopedCaveat:
    """A caveat and the metrics it qualifies.

    `metric_ids` is empty when the caveat is about the region's figures as a whole — how
    a ZIP's values were allocated, that some were matched by name, that some ranks come
    from a thinner cohort — rather than about particular metrics. The dashboard sets a
    scoped caveat beside the figures it names instead of collecting every caveat at the
    foot of the page (Milestone 18).
    """

    text: str
    metric_ids: tuple[str, ...] = ()


def scoped_caveats(
    *,
    level: str,
    metric_ids: Collection[str],
    match_methods: Collection[str] = (),
    crosswalk_methods: Collection[str] = (),
    thin_cohort: bool = False,
    multi_vintage_sources: Collection[str] = (),
) -> list[ScopedCaveat]:
    """`caveats_for`, with each caveat's scope: the present metrics it is about.

    One rule sequence serves both, so a caveat cannot appear in the packet and be missing
    from the dashboard, or the other way round. The order is the order `caveats_for`
    has always returned.
    """
    present = set(metric_ids)
    methods = set(match_methods)
    out: list[ScopedCaveat] = []

    def add(key: str, scope: Collection[str]) -> None:
        out.append(ScopedCaveat(TEXTS[key], tuple(sorted(scope))))

    acs = {m for m in present if m.startswith("acs_")}
    if acs:
        add("acs_overlap", acs)
    if present & DERIVED_RATIOS:
        add("derived_ratio", present & DERIVED_RATIOS)
    rent = present & {"zori_all", "rent_to_income"}
    if rent:
        add("zori_sparse", rent)
    if "permits_total_units" in present and level in {"municipality", "zip", "tract"}:
        add("permits_volatile", {"permits_total_units"})
    if "mortgage_rate_30y" in present:
        add("national_series", {"mortgage_rate_30y"})
    fhfa = present & {"fhfa_hpi", "fhfa_hpi_all_transactions"}
    if fhfa:
        add("fhfa_state_only", fhfa)
    ami = present & {"price_to_ami", "hud_area_median_income", "hud_income_limit_80"}
    if ami:
        add("hud_county_ami", ami)
    if present & FMR_METRICS:
        add("hud_fmr_area", present & FMR_METRICS)
    if present & CHAS_METRICS:
        add("chas_one_vintage", present & CHAS_METRICS)

    if level == "zip":
        text = TEXTS["zip_allocated"]
        if crosswalk_methods:
            named = ", ".join(sorted(set(crosswalk_methods)))
            text += f" Allocation weights for this ZIP: {named}."
        out.append(ScopedCaveat(text))
    if "name_county" in methods:
        out.append(ScopedCaveat(TEXTS["name_matched"]))
    if thin_cohort:
        out.append(ScopedCaveat(TEXTS["thin_cohort"]))
    if multi_vintage_sources:
        out.append(
            ScopedCaveat(
                TEXTS["collapsed_vintage"].format(
                    sources=", ".join(sorted(set(multi_vintage_sources)))
                )
            )
        )
    return out
