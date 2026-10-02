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
FMR_METRICS = frozenset(
    {
        "hud_fmr_0br",
        "hud_fmr_1br",
        "hud_fmr_2br",
        "hud_fmr_3br",
        "hud_fmr_4br",
        "fmr_to_income",
    }
)
# Milestone 36: what the deeds say, and what a median of them can and cannot.
SALE_PRICE_METRICS = frozenset(
    {
        "sr1a_median_sale_price",
        "sr1a_median_sale_price_12m",
        "sr1a_price_lower_quartile",
        "sr1a_price_upper_quartile",
        "sr1a_median_price_per_sqft",
    }
)
SAFMR_METRICS = frozenset(
    {"hud_safmr_0br", "hud_safmr_1br", "hud_safmr_2br", "hud_safmr_3br", "hud_safmr_4br"}
)
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
        "FHFA's house price indexes here are its state-level series. FHFA also publishes "
        "developmental county and ZIP indexes, which this platform does not yet load, so "
        "these figures describe New Jersey as a whole and cannot be compared across "
        "counties."
    ),
    "hud_fmr_area": (
        "Fair Market Rents are HUD's rent standard for a whole FMR area, set once per "
        "federal fiscal year from 1 October, so counties in one area share a figure and "
        "a rank among them compares areas. HUD moved some New Jersey areas from the "
        "50th to the 40th percentile by fiscal 2020, so a change spanning that year "
        "mixes two standards. In nine counties vouchers use HUD's ZIP-level Small Area "
        "FMRs instead, shown on those ZIP codes' pages."
    ),
    "chas_one_vintage": (
        "CHAS figures are HUD's tabulation of ACS 2018-2022 microdata, published a year "
        "behind the ACS they draw on. One vintage is loaded, so they show no change over "
        "time and describe earlier years than the newest ACS figures beside them."
    ),
    "modiv_tax_bill": (
        "The property tax bill is the median total tax across one- to four-family homes "
        "in MOD-IV, New Jersey's assessment records, for the tax year its period names — "
        "the year NJOGIS last joined its parcel map to. It is the bill as levied, before "
        "relief paid to individual households such as ANCHOR, and it follows each "
        "municipality's own assessments rather than a rate on market value."
    ),
    "irs_matching_2023": (
        "IRS migration counts from the 2022-2023 pair onward match returns across years "
        "by an updated method that includes about 5 percent more returns, so a change "
        "spanning 2022-2023 is partly the method rather than more people moving."
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
    # Milestone 34: the ACS measured for the ZCTA itself, not allocated to a ZIP.
    "zcta_measured": (
        "Census survey figures for a ZIP code are measured for its ZCTA, the area the "
        "Census builds from census blocks to approximate the ZIP's delivery routes; the "
        "two can differ. ZCTA figures begin with the 2016-2020 survey, the first drawn "
        "on 2020's ZCTAs, so none shows a five-year change yet."
    ),
    # Milestone 37.
    "county_tax_rate": (
        "A county's or the state's effective tax rate is worked out here from its towns' "
        "published rates, each weighted by the town's equalized valuation in the state's "
        "Table of Equalized Valuations: the levy over the value, taken together."
    ),
    # Milestone 36, each a guardrail ROADMAP set and a test pins.
    "sales_composition": (
        "Sale prices describe the one- to four-family homes that sold, not every home: a "
        "median that rises can mean pricier homes changed hands rather than homes "
        "becoming worth more. Counties and the state are computed from the deeds "
        "themselves, never from town medians."
    ),
    "sales_ratio": (
        "The sales ratio is a home's assessed value over its sale price. Below 100% "
        "means assessments trail the market, which they do more the longer since a town "
        "last revalued; it is not a tax rate and says nothing alone about a bill."
    ),
    "revaluation_lists": (
        "The state's revaluation and reassessment lists begin with tax year 2017; a town "
        "on none of them has not revalued since at least then."
    ),
    # Milestone 35.
    "hud_safmr": (
        "Small Area Fair Market Rents are HUD's rent standard set ZIP code by ZIP code, "
        "where HUD prices a metro area that way, and are what vouchers pay against "
        "there. They are a benchmark set near the 40th percentile of recent movers' "
        "rents, not what this ZIP's renters pay."
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
    rates = present & {"mortgage_rate_30y", "mortgage_rate_30y_weekly"}
    if rates:
        add("national_series", rates)
    fhfa = present & {"fhfa_hpi", "fhfa_hpi_all_transactions"}
    if fhfa:
        add("fhfa_state_only", fhfa)
    ami = present & {"price_to_ami", "hud_area_median_income", "hud_income_limit_80"}
    if ami:
        add("hud_county_ami", ami)
    if present & FMR_METRICS:
        add("hud_fmr_area", present & FMR_METRICS)
    if "nj_effective_tax_rate" in present and level in {"county", "state"}:
        add("county_tax_rate", {"nj_effective_tax_rate"})
    if present & SALE_PRICE_METRICS:
        add("sales_composition", present & SALE_PRICE_METRICS)
    if "sr1a_median_sales_ratio" in present:
        add("sales_ratio", {"sr1a_median_sales_ratio"})
    if "nj_revaluation_year" in present:
        add("revaluation_lists", {"nj_revaluation_year"})
    if present & SAFMR_METRICS:
        add("hud_safmr", present & SAFMR_METRICS)
    if present & CHAS_METRICS:
        add("chas_one_vintage", present & CHAS_METRICS)
    if "modiv_median_tax_bill" in present:
        add("modiv_tax_bill", {"modiv_median_tax_bill"})
    if "net_migration_returns" in present:
        add("irs_matching_2023", {"net_migration_returns"})

    if level == "zip":
        # Since Milestone 34 the ACS is fetched for each ZCTA, so its figures are measured
        # there rather than allocated: the allocation caveat covers the rest.
        allocated = present - acs
        if acs:
            add("zcta_measured", acs)
        if allocated or not acs:
            text = TEXTS["zip_allocated"]
            if crosswalk_methods:
                named = ", ".join(sorted(set(crosswalk_methods)))
                text += f" Allocation weights for this ZIP: {named}."
            out.append(ScopedCaveat(text, tuple(sorted(allocated)) if acs else ()))
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
