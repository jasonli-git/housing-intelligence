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

# Ratios the platform computes from two published series (ARCHITECTURE #34).
DERIVED_RATIOS = frozenset({"price_to_income", "rent_to_income", "price_to_ami"})

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
        "The FHFA house price index is published at state level only; no county series "
        "is available at a reachable URL, so it cannot be compared across counties."
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
    """
    present = set(metric_ids)
    methods = set(match_methods)
    keys: list[str] = []

    if any(m.startswith("acs_") for m in present):
        keys.append("acs_overlap")
    if present & DERIVED_RATIOS:
        keys.append("derived_ratio")
    if "zori_all" in present or "rent_to_income" in present:
        keys.append("zori_sparse")
    if "permits_total_units" in present and level in {"municipality", "zip", "tract"}:
        keys.append("permits_volatile")
    if "mortgage_rate_30y" in present:
        keys.append("national_series")
    if "fhfa_hpi" in present:
        keys.append("fhfa_state_only")
    if present & {"price_to_ami", "hud_area_median_income", "hud_income_limit_80"}:
        keys.append("hud_county_ami")

    out = [TEXTS[key] for key in keys]

    if level == "zip":
        text = TEXTS["zip_allocated"]
        if crosswalk_methods:
            named = ", ".join(sorted(set(crosswalk_methods)))
            text += f" Allocation weights for this ZIP: {named}."
        out.append(text)
    if "name_county" in methods:
        out.append(TEXTS["name_matched"])
    if thin_cohort:
        out.append(TEXTS["thin_cohort"])
    if multi_vintage_sources:
        out.append(
            TEXTS["collapsed_vintage"].format(
                sources=", ".join(sorted(set(multi_vintage_sources)))
            )
        )
    return out
