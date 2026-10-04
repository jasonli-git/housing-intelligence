"""The completeness standing check (ROADMAP.md, "The completeness standing check").

A platform can look more complete by filling cells — a neighbouring geography's figure,
an old observation, a model shown as a measurement — and become less truthful doing it.
So completeness is measured along six fixed dimensions, the same way every run, and each
run's full report is kept (`reports/completeness/`) so the next can be compared with it.
**A blank that stays blank is not a regression; a blank filled by a proxy the page does
not name is.**

Three dimensions are measured from the warehouse: geographic coverage, the three dates
per source (through the freshness report, Milestone 27), and match quality. The other
three are judgments, and they are recorded here as data rather than re-judged each run,
because a judgment made afresh every time is not a measurement:

- each metric's **subject** (`METRIC_SUBJECTS`), which a test requires for every
  configured metric, so a new one cannot land unclassified;
- a **fixed list of reader questions** (`QUESTIONS`), taken from the questions ROADMAP
  already names — Milestone 17's views, what they decided not to answer, and Milestone
  27's two pages — rather than invented for the check;
- each licence's **reuse rights** (`LICENCE_RIGHTS`), keyed by the licence text in
  `config/sources.yml`, where "unverified" means the licence as recorded does not say and
  nobody has checked the publisher's terms. That is a finding, not a gap in the check.

An inspection command, not a pipeline stage, like `hip footprint`: it reads and reports.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Literal

from sqlalchemy import text
from sqlalchemy.orm import Session

from hip.config import Source, load_metrics
from hip.warehouse.freshness import SourceFreshness, build_report

SUBJECTS = (
    "price",
    "rent",
    "financing",
    "taxes",
    # What a home costs to run beyond its mortgage and tax: insurance and utility bills
    # (Milestone 33).
    "running",
    "stock",
    "supply",
    "assistance",
    "hazards",
    "access",
)

# Every configured metric's subject, or "context" for one that describes the people or
# the economy rather than the housing (income, population, jobs, migration, and the
# cost-burden shares, which are outcomes of price and rent rather than either). A ratio
# takes its numerator's subject. HUD's income limits are eligibility thresholds for
# assistance, not a count of assisted homes or vouchers. M41's delivery metrics
# describe municipal reports, separately from these income thresholds.
METRIC_SUBJECTS: dict[str, str] = {
    "nj_ah_present_need": "assistance",
    "nj_ah_prospective_need": "assistance",
    "nj_ah_completed_units": "assistance",
    "nj_ah_trust_balance": "assistance",
    "zhvi_sfr": "price",
    "acs_median_home_value": "price",
    "fhfa_hpi": "price",
    "fhfa_hpi_all_transactions": "price",
    "sr1a_median_sale_price": "price",
    "sr1a_sales_count": "price",
    "sr1a_price_lower_quartile": "price",
    "sr1a_price_upper_quartile": "price",
    "sr1a_median_sale_price_12m": "price",
    "sr1a_median_year_built_sold": "stock",
    "sr1a_median_price_per_sqft": "price",
    "sr1a_median_sales_ratio": "taxes",
    "nj_revaluation_year": "taxes",
    "modiv_median_assessed_value": "price",
    "price_to_income": "price",
    "price_to_ami": "price",
    "zori_all": "rent",
    "acs_median_gross_rent": "rent",
    "hud_fmr_2br": "rent",
    "hud_fmr_0br": "rent",
    "hud_fmr_1br": "rent",
    "hud_fmr_3br": "rent",
    "hud_fmr_4br": "rent",
    "hud_safmr_0br": "rent",
    "hud_safmr_1br": "rent",
    "hud_safmr_2br": "rent",
    "hud_safmr_3br": "rent",
    "hud_safmr_4br": "rent",
    "rent_to_income": "rent",
    "fmr_to_income": "rent",
    "mortgage_rate_30y": "financing",
    "mortgage_rate_30y_weekly": "financing",
    "modiv_median_tax_bill": "taxes",
    "nj_general_tax_rate": "taxes",
    "nj_effective_tax_rate": "taxes",
    "nj_director_ratio": "taxes",
    "acs_median_home_insurance": "running",
    "acs_median_electricity": "running",
    "acs_median_gas": "running",
    "acs_median_water_sewer": "running",
    "acs_median_other_fuel": "running",
    "acs_renters_paying_utilities": "running",
    "acs_vacancy_rate": "stock",
    "acs_homeownership_rate": "stock",
    "modiv_residential_parcels": "stock",
    "modiv_median_year_built": "stock",
    "modiv_median_lot_acres": "stock",
    "modiv_multifamily_share": "stock",
    "modiv_vacant_land_share": "stock",
    "permits_total_units": "supply",
    # Milestone 39: the end of the pipeline permits start, and the stock it adds to.
    "nj_units_certified": "supply",
    "nj_units_certified_1_2": "supply",
    "nj_units_certified_multi": "supply",
    "nj_units_certified_mixed": "supply",
    "nj_units_demolished": "supply",
    "nj_net_units_added": "supply",
    "nj_net_units_per_1000": "supply",
    "nj_certificates_reporting_share": "supply",
    "nj_demolitions_reporting_share": "supply",
    "acs_housing_units": "stock",
    # Milestone 40: flood, contaminated ground and drinking water.
    "fema_flood_homes_share": "hazards",
    "fema_flood_homes_share_moderate": "hazards",
    "fema_flood_homes": "hazards",
    "fema_mapped_homes_share": "hazards",
    "njdep_tidal_homes_share": "hazards",
    "fema_flood_claims": "hazards",
    "fema_flood_claims_paid": "hazards",
    "njdep_sites_open": "hazards",
    "njdep_sites_post_remedy": "hazards",
    "njdep_sites_heating_oil": "hazards",
    "water_homes_share_public": "hazards",
    "water_homes_share_violation": "hazards",
    "acs_median_hh_income": "context",
    "acs_population": "context",
    "pep_population": "context",
    "unemployment_rate": "context",
    "net_migration_returns": "context",
    "hud_area_median_income": "context",
    "hud_income_limit_80": "context",
    "acs_renter_cost_burden": "context",
    "chas_owner_cost_burden": "context",
    "chas_renter_cost_burden": "context",
    "chas_renter_severe_burden": "context",
    # Milestone 34's ACS in depth: rents by size to rent, heating fuel to running costs,
    # commuting and car ownership to access, the homes to stock, and the rest — owner
    # costs, severe burden, households and disability — to context.
    "acs_median_rent_studio": "rent",
    "acs_median_rent_1br": "rent",
    "acs_median_rent_2br": "rent",
    "acs_median_rent_3br": "rent",
    "acs_median_rent_4br": "rent",
    "acs_rent_lower_quartile": "rent",
    "acs_rent_upper_quartile": "rent",
    "acs_owner_costs_mortgage": "context",
    "acs_owner_costs_no_mortgage": "context",
    "acs_renter_severe_burden": "context",
    "acs_owner_severe_burden": "context",
    "acs_share_detached": "stock",
    "acs_share_attached": "stock",
    "acs_share_2_4_units": "stock",
    "acs_share_5_19_units": "stock",
    "acs_share_20plus_units": "stock",
    "acs_share_mobile_homes": "stock",
    "acs_median_year_built": "stock",
    "acs_share_built_2000_later": "stock",
    "acs_share_built_1980_1999": "stock",
    "acs_share_built_1940_1979": "stock",
    "acs_share_built_pre_1940": "stock",
    "acs_share_0_1_bedrooms": "stock",
    "acs_share_2_bedrooms": "stock",
    "acs_share_3_bedrooms": "stock",
    "acs_share_4plus_bedrooms": "stock",
    "acs_overcrowded_share": "stock",
    "acs_lacking_plumbing_share": "stock",
    "acs_lacking_kitchen_share": "stock",
    "acs_avg_household_size": "context",
    "acs_no_vehicle_share": "access",
    "acs_rental_vacancy_rate": "stock",
    "acs_homeowner_vacancy_rate": "stock",
    "acs_vacant_seasonal_share": "stock",
    "acs_vacant_other_share": "stock",
    "acs_heat_gas_share": "running",
    "acs_heat_electric_share": "running",
    "acs_heat_oil_share": "running",
    "acs_heat_propane_share": "running",
    "acs_heat_other_share": "running",
    "acs_commute_transit_share": "access",
    "acs_work_from_home_share": "access",
    "acs_commute_drove_alone_share": "access",
    "acs_commute_walked_share": "access",
    "acs_mean_commute_minutes": "access",
    "acs_commute_60plus_share": "access",
    "acs_living_alone_share": "context",
    "acs_married_couple_share": "context",
    "acs_with_children_share": "context",
    "acs_disability_share": "context",
}

Answer = Literal["answered", "declined", "unanswered"]


@dataclass(frozen=True)
class Question:
    text: str
    # "answered": the site answers it, at `where` (a route under web/app, checked by a
    # test). "declined": the site itself says it cannot. "unanswered": neither — `where`
    # says what ROADMAP has decided or scheduled instead.
    status: Answer
    where: str


QUESTIONS: tuple[Question, ...] = (
    Question("What can I afford here?", "answered", "/afford"),
    Question("What would it cost me per month to own here?", "answered", "/regions/[id]"),
    Question(
        "Is it cheaper to rent or to own here, month to month?",
        "answered",
        "/regions/[id]",
    ),
    Question("What is the property tax bill here?", "answered", "/regions/[id]"),
    Question(
        "How much has changed since the year I moved here?", "answered", "/regions/[id]"
    ),
    Question("Are paychecks keeping up with housing here?", "answered", "/regions/[id]"),
    Question("What is the housing here like?", "answered", "/regions/[id]"),
    Question("How does this place rank in New Jersey?", "answered", "/"),
    Question("How current is each figure?", "answered", "/freshness"),
    Question("What changed since the figures were published?", "answered", "/changes"),
    Question(
        "Will prices go up?",
        "unanswered",
        "decided against 2026-09-13 (a forecast); Milestone 52 is the descriptive answer",
    ),
    Question(
        "Is it a good investment, or should I buy?",
        "unanswered",
        "decided against 2026-09-13 (advice)",
    ),
    Question("Is it at risk of flooding?", "answered", "/regions/[id]"),
    Question("How long is the commute?", "unanswered", "Milestone 45"),
    Question("Where is somewhere like here, but cheaper?", "unanswered", "Milestone 46"),
    Question("What are the schools like?", "unanswered", "Milestone 47"),
    Question("Is it safe?", "unanswered", "Milestone 47"),
)

Right = Literal["yes", "no", "unverified", "inherited"]


@dataclass(frozen=True)
class Rights:
    display: Right
    download: Right
    derived: Right
    commercial: Right


# Keyed by the licence text in config/sources.yml, so a source whose licence changes
# falls out of this table and fails the test that requires every licence be classified.
LICENCE_RIGHTS: dict[str, Rights] = {
    "Public domain (U.S. Government work)": Rights("yes", "yes", "yes", "yes"),
    "Free for non-commercial use with attribution": Rights(
        "yes", "unverified", "unverified", "no"
    ),
    "Free with attribution; series-level terms vary by originator": Rights(
        "yes", "unverified", "unverified", "unverified"
    ),
    "Open public record": Rights("yes", "unverified", "unverified", "unverified"),
    "Open data": Rights("yes", "unverified", "unverified", "unverified"),
    # Milestone 40. NJDEP's agreement conditions use on its credit and disclaimer and on
    # keeping the metadata with the data, and sets no commercial limit (#303).
    "NJDEP Data Distribution Agreement": Rights("yes", "yes", "yes", "yes"),
    # OpenFEMA's terms forbid re-identification and describe the data as for statistical
    # research or a reporting record; commerce is not addressed in words (#302).
    "OpenFEMA Terms and Conditions": Rights("yes", "yes", "yes", "unverified"),
    "Derived from cited sources": Rights(
        "inherited", "inherited", "inherited", "inherited"
    ),
}


@dataclass(frozen=True)
class Coverage:
    metric_id: str
    label: str
    subject: str
    newest_period: date
    municipalities: int
    zips: int
    counties: int
    national: bool
    # A single figure for the whole state, like FHFA's state index.
    statewide: bool
    # Share of New Jersey's population in the covered municipalities, or counties where
    # a metric has no municipal figures. None where neither applies: a ZIP-only metric
    # (no ZIP carries a population figure), a statewide one or a national one.
    population_share: float | None
    # Share of the metric's observations joined to their region by each method.
    match_methods: dict[str, float]
    # Share of the metric's observations at its newest period that carry a margin of
    # error (Milestone 28); 0 for a source that publishes none.
    margin_share: float = 0.0


@dataclass(frozen=True)
class Totals:
    municipalities: int
    zips: int
    counties: int


def measure_coverage(session: Session) -> tuple[Totals, list[Coverage]]:
    """Each metric's coverage at its newest period, which is what a reader sees today.

    Coverage at *any* period would count a town a series dropped years ago.
    """
    totals = session.execute(
        text(
            """
            SELECT count(*) FILTER (WHERE level = 'municipality') AS municipalities,
                   count(*) FILTER (WHERE level = 'zip') AS zips,
                   count(*) FILTER (WHERE level = 'county') AS counties
            FROM regions
            """
        )
    ).one()
    rows = session.execute(
        text(
            """
            WITH newest AS (
                SELECT metric_id, max(period_start) AS period_start
                FROM fact_metric_observation GROUP BY metric_id
            ),
            population AS (
                SELECT DISTINCT ON (region_id) region_id, value AS people
                FROM fact_metric_observation
                WHERE metric_id = 'pep_population'
                ORDER BY region_id, period_start DESC
            ),
            state_people AS (
                SELECT sum(p.people) AS people
                FROM population p JOIN regions r USING (region_id)
                WHERE r.level = 'county'
            ),
            covered AS (
                SELECT o.metric_id, n.period_start, r.level, p.people
                FROM fact_metric_observation o
                JOIN newest n
                  ON n.metric_id = o.metric_id AND n.period_start = o.period_start
                JOIN regions r ON r.region_id = o.region_id
                LEFT JOIN population p ON p.region_id = o.region_id
            )
            SELECT c.metric_id, m.label, c.period_start AS newest_period,
                   count(*) FILTER (WHERE c.level = 'municipality') AS municipalities,
                   count(*) FILTER (WHERE c.level = 'zip') AS zips,
                   count(*) FILTER (WHERE c.level = 'county') AS counties,
                   bool_or(c.level = 'nation') AS national,
                   bool_or(c.level = 'state') AS statewide,
                   sum(c.people) FILTER (WHERE c.level = 'municipality')
                       / (SELECT people FROM state_people) AS municipal_share,
                   sum(c.people) FILTER (WHERE c.level = 'county')
                       / (SELECT people FROM state_people) AS county_share
            FROM covered c JOIN metrics m ON m.metric_id = c.metric_id
            GROUP BY c.metric_id, m.label, c.period_start
            ORDER BY c.metric_id
            """
        )
    ).mappings()
    methods: dict[str, dict[str, float]] = {}
    for row in session.execute(
        text(
            """
            SELECT metric_id, match_method,
                   count(*)::float / sum(count(*)) OVER (PARTITION BY metric_id) AS share
            FROM fact_metric_observation
            GROUP BY metric_id, match_method
            ORDER BY metric_id, share DESC
            """
        )
    ).mappings():
        methods.setdefault(row["metric_id"], {})[row["match_method"]] = row["share"]

    margins = {
        row["metric_id"]: row["share"]
        for row in session.execute(
            text(
                """
                WITH newest AS (
                    SELECT metric_id, max(period_start) AS period_start
                    FROM fact_metric_observation GROUP BY metric_id
                )
                SELECT o.metric_id,
                       count(o.margin_of_error)::float / count(*) AS share
                FROM fact_metric_observation o
                JOIN newest n
                  ON n.metric_id = o.metric_id AND n.period_start = o.period_start
                GROUP BY o.metric_id
                """
            )
        ).mappings()
    }

    coverage = []
    for row in rows:
        if row["municipalities"]:
            share = row["municipal_share"]
        elif row["counties"]:
            share = row["county_share"]
        else:
            share = None
        coverage.append(
            Coverage(
                metric_id=row["metric_id"],
                label=row["label"],
                subject=METRIC_SUBJECTS.get(row["metric_id"], "unclassified"),
                newest_period=row["newest_period"],
                municipalities=row["municipalities"],
                zips=row["zips"],
                counties=row["counties"],
                national=bool(row["national"]),
                statewide=bool(row["statewide"]),
                population_share=None if row["national"] else share,
                match_methods=methods.get(row["metric_id"], {}),
                margin_share=margins.get(row["metric_id"], 0.0),
            )
        )
    return Totals(totals.municipalities, totals.zips, totals.counties), coverage


# Matched on a code the publisher and the spine share, as against a name, which is the
# one method here that can pick the wrong place (four NJ pairs share a name and county).
_BY_NAME = {"name_county"}


def _pct(share: float | None) -> str:
    return "—" if share is None else f"{share:.0%}"


def render(session: Session, sources: dict[str, Source], run_on: date) -> str:
    """The full report, as Markdown: one section per dimension."""
    totals, coverage = measure_coverage(session)
    freshness = build_report(session, sources)
    discoveries = {
        row["source_id"]: row
        for row in session.execute(
            text("SELECT source_id, newest, pending FROM source_discoveries")
        ).mappings()
    }
    # The newest vintage held, preferring a dated one: HUD's crosswalk is `current` and
    # its income limits are years, and "current" would hide FY2026. Not the one fetched
    # last, which for a source backfilling its history is its oldest year.
    vintages = {
        row["source_id"]: row["vintage"]
        for row in session.execute(
            text(
                """
                SELECT source_id,
                       COALESCE(max(vintage) FILTER (WHERE vintage ~ '^[0-9]'),
                                max(vintage)) AS vintage
                FROM source_releases GROUP BY source_id
                """
            )
        ).mappings()
    }
    held = {s: [c for c in coverage if c.subject == s] for s in SUBJECTS}

    lines = [
        f"# Completeness standing check — {run_on.isoformat()}",
        "",
        "Generated by `hip completeness`; the dimensions are defined in ROADMAP.md, "
        '"The completeness standing check". Coverage is at each metric\'s newest '
        "period. Population is the Census Population Estimates' newest vintage.",
        "",
        "## Summary",
        "",
        summary(coverage, totals, freshness.sources, sources),
        "",
        "## Geographic",
        "",
        f"Of {totals.municipalities} municipalities, {totals.zips} ZIP codes and "
        f"{totals.counties} counties.",
        "",
        "| Metric | Newest period | Municipalities | ZIPs | Counties | Population |",
        "|---|---|---:|---:|---:|---:|",
    ]
    for c in coverage:
        people = (
            "national"
            if c.national
            else "statewide"
            if c.statewide and c.population_share is None
            else _pct(c.population_share)
        )
        lines.append(
            f"| `{c.metric_id}` | {c.newest_period.isoformat()} | {c.municipalities} "
            f"| {c.zips} | {c.counties} | {people} |"
        )

    lines += [
        "",
        "## Temporal",
        "",
        "Three dates, not one: the newest release the publisher has out, the one "
        "acquired, and the newest period the site publishes from it.",
        "",
        "| Source | Status | Newest available | Acquired | Published through |",
        "|---|---|---|---|---|",
    ]
    for s in freshness.sources:
        found = discoveries.get(s.source_id)
        if found is None:
            available = "not tracked"
        elif found["pending"]:
            available = f"{found['pending']} (in force from {s.pending_from})"
        else:
            available = found["newest"] or "—"
        acquired = s.acquired_at.date().isoformat() if s.acquired_at else "—"
        vintage = vintages.get(s.source_id)
        lines.append(
            f"| `{s.source_id}` | {s.status.replace('_', ' ')} | {available} "
            f"| {vintage + ', ' if vintage else ''}{acquired} "
            f"| {s.period_observed_end or '—'} |"
        )

    lines += ["", "## Subject", "", "| Subject | Held | Metrics |", "|---|---|---|"]
    for subject in SUBJECTS:
        metrics = held[subject]
        names = ", ".join(f"`{c.metric_id}`" for c in metrics) or "—"
        lines.append(f"| {subject} | {'yes' if metrics else 'no'} | {names} |")

    lines += [
        "",
        "## Statistical quality",
        "",
        "How each observation was matched to its region, and — since Milestone 28 — "
        "the share of each metric's newest figures that carry a 90% margin of error. "
        "Only the Census's survey publishes margins, and the ratios divided by its "
        "income inherit them. No sample counts or suppression flags are loaded.",
        "",
        "| Metric | Matched by | With a margin |",
        "|---|---|---:|",
    ]
    for c in coverage:
        methods = ", ".join(
            f"{method}{' (by name)' if method in _BY_NAME else ''} {share:.0%}"
            for method, share in c.match_methods.items()
        )
        margin = f"{c.margin_share:.0%}" if c.margin_share else "—"
        lines.append(f"| `{c.metric_id}` | {methods} | {margin} |")

    lines += ["", "## Usability", "", "| Question | Status | Where |", "|---|---|---|"]
    for q in QUESTIONS:
        lines.append(f"| {q.text} | {q.status} | {q.where} |")

    lines += [
        "",
        "## Reuse rights",
        "",
        "As the licence recorded in `config/sources.yml` states them; *unverified* "
        "means it does not say, and the publisher's own terms have not been checked.",
        "",
        "| Source | Licence | Display | Download | Derived figures | Commercial |",
        "|---|---|---|---|---|---|",
    ]
    for s in freshness.sources:
        licence = sources[s.source_id].license
        rights = LICENCE_RIGHTS[licence]
        lines.append(
            f"| `{s.source_id}` | {licence} | {rights.display} | {rights.download} "
            f"| {rights.derived} | {rights.commercial} |"
        )
    return "\n".join(lines) + "\n"


def summary(
    coverage: list[Coverage],
    totals: Totals,
    freshness: list[SourceFreshness],
    sources: dict[str, Source],
) -> str:
    """One paragraph per run, for the ROADMAP record."""
    municipal = [c for c in coverage if c.municipalities]
    most = sum(1 for c in municipal if c.municipalities >= 0.95 * totals.municipalities)
    held = [s for s in SUBJECTS if any(c.subject == s for c in coverage)]
    missing = [s for s in SUBJECTS if s not in held]
    statuses: dict[str, int] = {}
    for s in freshness:
        statuses[s.status] = statuses.get(s.status, 0) + 1
    answered = sum(1 for q in QUESTIONS if q.status == "answered")
    declined = sum(1 for q in QUESTIONS if q.status == "declined")
    by_name = sum(1 for c in coverage if any(m in _BY_NAME for m in c.match_methods))
    margined = sum(1 for c in coverage if c.margin_share > 0)
    public = sum(
        1
        for s in freshness
        if sources[s.source_id].license == "Public domain (U.S. Government work)"
    )
    return (
        f"**Geographic:** {len(coverage)} metrics; {len(municipal)} reach "
        f"municipalities, {most} of them at least 95% of the {totals.municipalities}. "
        f"**Temporal:** {len(freshness)} sources — "
        + ", ".join(
            f"{n} {status.replace('_', ' ')}" for status, n in sorted(statuses.items())
        )
        + ". "
        f"**Subject:** {len(held)} of {len(SUBJECTS)} held; "
        f"{', '.join(missing) or 'none'} not held. "
        f"**Statistical quality:** match method on every observation, {by_name} "
        f"metrics partly matched by name; margins of error on {margined} metrics — the "
        "survey's, and the ratios built on it; no sample counts or suppression flags. "
        f"**Usability:** {answered} of {len(QUESTIONS)} fixed questions answered, "
        f"{declined} declined on the site, "
        f"{len(QUESTIONS) - answered - declined} neither. "
        f"**Reuse rights:** {public} of {len(freshness)} sources public domain; the rest "
        "carry at least one use the recorded licence leaves unverified."
    )


def run(session: Session, sources: dict[str, Source], run_on: date) -> str:
    """The report, after checking every configured metric has a subject."""
    unclassified = sorted(set(load_metrics()) - set(METRIC_SUBJECTS))
    if unclassified:
        raise ValueError(
            f"metrics without a subject: {', '.join(unclassified)} — add them to "
            "METRIC_SUBJECTS in hip/completeness.py"
        )
    return render(session, sources, run_on)
