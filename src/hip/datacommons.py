"""Which of our measures Google's Data Commons also has, and how current its copy is.

A developer's survey, not a pipeline source (owner, 2026-11-10). The 2026-10-31 audit
compared Data Commons with our sources through its website search, which found nothing
for "mortgage" or "fair market rent" — and a weak search cannot prove a gap. This asks
Data Commons' natural-language endpoint, the one DataGemma uses, for each measure in
`config/metrics.yml` by its label ("Median home value in Princeton, NJ"), records which
statistical variables it matched and how closely, and then reads the best match's newest
figure for the same place through the exact REST API, beside our own newest figure.

The result is a list to check by hand. A close match is not the same measure: the
endpoint matches words, and "Median home value" can mean owners' estimates or a sales
index. Nothing here reaches the site, the warehouse or a packet. A measure confirmed by
hand would be added as an ordinary source in `config/sources.yml`.

Our side is read from the staged observations in DuckDB, so the survey runs without
Postgres. Data Commons names a county subdivision `geoId/<10-digit GEOID>`, the same
code our municipalities carry, so the exact read is for the same place, not the Census
"place" Data Commons' own search tends to pick.
"""

from __future__ import annotations

import csv
import json
import os
import time
from collections.abc import Callable, Iterable
from dataclasses import asdict, dataclass, field
from datetime import date
from pathlib import Path
from typing import Any

import duckdb
import httpx

from hip.config import Metric

KEY_ENV = "DATACOMMONS_API_KEY"
NL_URL = "https://nl.datacommons.org/nodejs/query"
OBSERVATION_URL = "https://api.datacommons.org/v2/observation"
# DataGemma's two modes, with the parameters its client sends. The single-figure mode
# answers with nothing at all, not even its matches, when it cannot name one figure
# (measured 2026-11-10: 195 of 233 measures came back empty, "Students at private
# schools" among them); the table mode still reports what it matched, so it is asked
# second.
NL_MODES = [
    {"allCharts": "1", "mode": "toolformer_rig", "idx": "base_uae_mem"},
    {"mode": "toolformer_rag", "client": "table", "idx": "base_uae_mem"},
]
# Below this cosine score the endpoint's match is a guess. Measured on 2026-11-10:
# "median home value" matched the owner-occupied median at 0.89; its runners-up
# (household income, ownership costs) scored 0.73–0.75.
CLOSE = 0.8
CANDIDATES = 5

# What the survey concludes for one measure, worst news first in the summary.
NEWER_THERE = "newer there"
SAME = "same date"
OLDER_THERE = "older there"
ONLY_THERE = "only there"
NO_FIGURE = "matched, no figure for this place"
WEAK = "weak match"
NOT_FOUND = "not found"
FAILED = "request failed"
VERDICTS = [
    NEWER_THERE,
    ONLY_THERE,
    SAME,
    OLDER_THERE,
    NO_FIGURE,
    WEAK,
    NOT_FOUND,
    FAILED,
]


@dataclass
class Figure:
    date: str
    value: float
    geoid: str


@dataclass
class Finding:
    metric_id: str
    question: str
    candidates: list[tuple[str, float]] = field(default_factory=list)
    variable: str | None = None
    score: float | None = None
    theirs: Figure | None = None
    their_source: str | None = None
    ours: Figure | None = None
    # What the NL endpoint itself answered: its chart title, date and figure. It may be
    # for a different place code than ours (a Census place rather than the township),
    # so it is shown for the hand check, never compared.
    answer: str | None = None
    verdict: str = NOT_FOUND
    error: str | None = None


@dataclass
class Holding:
    """One variable's newest figure from one Data Commons source, at one place."""

    variable: str
    geoid: str
    source: str
    url: str
    date: str


@dataclass
class SourceSummary:
    """One Data Commons source, as the catalogue lists it."""

    source: str
    url: str
    variables: int
    newest: str
    places: list[str]
    # Our sources whose address is on the same domain: the same publisher, which is a
    # lead, not a match ("census.gov" is the survey we hold and a dozen we do not).
    same_publisher: list[str]
    examples: list[str]


class DataCommons:
    """The two endpoints the survey reads. `client` is injectable for tests."""

    def __init__(self, key: str, client: httpx.Client | None = None, pause: float = 0.5):
        self.key = key
        self.client = client or httpx.Client(timeout=90)
        self.pause = pause

    def ask(self, question: str) -> tuple[list[tuple[str, float]], str | None]:
        """The variables the NL endpoint matched, best first, with their scores, and
        its own answer.

        Topics (`dc/topic/...`) are dropped: they are groups of variables, not figures.
        """
        candidates: list[tuple[str, float]] = []
        answer: str | None = None
        for params in NL_MODES:
            response = self.client.get(
                NL_URL,
                params={"q": question, **params, "key": self.key},
                headers={"x-surface": "datagemma"},
            )
            response.raise_for_status()
            if self.pause:
                time.sleep(self.pause)
            body = response.json()
            matching = body.get("debug", {}).get("debug", {}).get("sv_matching", {})
            pairs = zip(
                matching.get("SV", []), matching.get("CosineScore", []), strict=False
            )
            candidates = [
                (sv, float(score))
                for sv, score in pairs
                if not sv.startswith("dc/topic/")
            ]
            answer = answer or answer_of(body.get("charts") or [])
            if candidates:
                break
        return candidates, answer

    def latest(
        self, variable: str, geoids: Iterable[str]
    ) -> tuple[Figure, str | None] | None:
        """The newest figure for the first of `geoids` that has one, and its source.

        Data Commons holds several imports of one variable, and its first ordered facet
        is not the newest: Princeton's `Count_Person` leads with the 2024 Census survey
        while the 2025 population estimate sits behind it. The question is whether
        anything newer exists, so the newest facet is the one compared.
        """
        geoids = list(geoids)
        response = self.client.get(
            OBSERVATION_URL,
            params=[
                ("date", "LATEST"),
                ("variable.dcids", variable),
                *[("entity.dcids", f"geoId/{g}") for g in geoids],
                *[
                    ("select", s)
                    for s in ("entity", "variable", "value", "date", "facet")
                ],
            ],
            headers={"X-API-Key": self.key},
        )
        response.raise_for_status()
        body = response.json()
        by_entity = body.get("byVariable", {}).get(variable, {}).get("byEntity", {})
        for geoid in geoids:
            facets = [
                f
                for f in by_entity.get(f"geoId/{geoid}", {}).get("orderedFacets", [])
                if f.get("observations")
            ]
            if facets:
                # max() keeps the first of equal dates: Data Commons' own preference.
                newest = max(facets, key=lambda f: str(f["observations"][0]["date"]))
                obs = newest["observations"][0]
                facet = body.get("facets", {}).get(newest.get("facetId", ""), {})
                source = facet.get("provenanceId") or facet.get("provenanceUrl")
                return Figure(str(obs["date"]), float(obs["value"]), geoid), source
        return None

    def variables(self, geoid: str) -> list[str]:
        """Every variable Data Commons holds any figure for at this place."""
        response = self.client.get(
            OBSERVATION_URL,
            params=[
                ("entity.dcids", dcid(geoid)),
                ("select", "variable"),
                ("select", "entity"),
            ],
            headers={"X-API-Key": self.key},
        )
        response.raise_for_status()
        return sorted(response.json().get("byVariable", {}))

    def newest_by_source(
        self, geoid: str, variables: list[str], batch: int = 400
    ) -> list[Holding]:
        """Each variable's newest figure from each source that has one, at this place.

        Posted in batches: a GET of 400 variable ids overruns a URL's length.
        """
        held: list[Holding] = []
        for start in range(0, len(variables), batch):
            response = self.client.post(
                OBSERVATION_URL,
                json={
                    "date": "LATEST",
                    "variable": {"dcids": variables[start : start + batch]},
                    "entity": {"dcids": [dcid(geoid)]},
                    "select": ["entity", "variable", "date", "value", "facet"],
                },
                headers={"X-API-Key": self.key},
            )
            response.raise_for_status()
            if self.pause:
                time.sleep(self.pause)
            body = response.json()
            facets = body.get("facets", {})
            for variable, by_entity in body.get("byVariable", {}).items():
                place = by_entity.get("byEntity", {}).get(dcid(geoid), {})
                for facet in place.get("orderedFacets", []):
                    if not facet.get("observations"):
                        continue
                    meta = facets.get(facet.get("facetId", ""), {})
                    url = (meta.get("provenanceUrl") or "").strip()
                    held.append(
                        Holding(
                            variable=variable,
                            geoid=geoid,
                            source=meta.get("provenanceId") or url or "unknown",
                            url=url,
                            date=str(facet["observations"][0]["date"]),
                        )
                    )
        return held


def answer_of(charts: list[dict[str, Any]]) -> str | None:
    """'<title>: <value> (<date>)' from the endpoint's first chart with a figure."""
    for chart in charts:
        highlight = chart.get("highlight") or {}
        if highlight.get("value") not in (None, ""):
            title = chart.get("title", "").split(" (")[0]
            return f"{title}: {highlight['value']} ({highlight.get('date', '?')})"
    return None


def key_from_env() -> str:
    key = os.environ.get(KEY_ENV, "").strip()
    if not key:
        raise RuntimeError(
            f"{KEY_ENV} is not set. Request a key at https://apikeys.datacommons.org, "
            "enable the Data Commons API and NL API on it, and put it in .env."
        )
    return key


def question_for(metric: Metric, place: str) -> str:
    return f"{metric.label} in {place}"


def verdict(finding: Finding) -> str:
    if finding.error:
        return FAILED
    if not finding.candidates:
        return NOT_FOUND
    if finding.score is None or finding.score < CLOSE:
        return WEAK
    if finding.theirs is None:
        return NO_FIGURE
    if finding.ours is None:
        return ONLY_THERE
    # Data Commons dates an annual figure "2025" and a monthly one "2026-07"; we date
    # every figure by its period's last day. Compare at the shorter's precision, so a
    # July population estimate does not read as newer than its own year.
    precision = min(len(finding.theirs.date), len(finding.ours.date))
    theirs = finding.theirs.date[:precision]
    ours = finding.ours.date[:precision]
    if theirs > ours:
        return NEWER_THERE
    return SAME if theirs == ours else OLDER_THERE


def our_latest(
    con: duckdb.DuckDBPyConnection, metric_id: str, geoids: list[str]
) -> Figure | None:
    """Our newest staged figure for the first of `geoids` that has one."""
    for geoid in geoids:
        row = con.execute(
            "SELECT max(period_end), arg_max(value, period_end) "
            "FROM stg_metric_observation WHERE metric_id = ? AND geoid = ?",
            [metric_id, geoid],
        ).fetchone()
        if row and row[0] is not None:
            return Figure(row[0].isoformat(), float(row[1]), geoid)
    return None


def place_of(con: duckdb.DuckDBPyConnection, geoid: str) -> tuple[str, list[str]]:
    """A question's place name, and the codes to read: the place, then its county."""
    row = con.execute(
        "SELECT name, state_code, parent_geoid FROM stg_regions WHERE geoid = ?", [geoid]
    ).fetchone()
    if row is None:
        raise ValueError(f"no region with GEOID {geoid} in the staged regions")
    name, state, parent = row
    return f"{name}, {state}", [geoid, *([parent] if parent else [])]


def survey(
    metrics: dict[str, Metric],
    dc: DataCommons,
    con: duckdb.DuckDBPyConnection,
    geoid: str,
    progress: Callable[[int, int, Finding], None] | None = None,
) -> list[Finding]:
    place, geoids = place_of(con, geoid)
    findings: list[Finding] = []
    for i, (metric_id, metric) in enumerate(metrics.items(), start=1):
        finding = Finding(metric_id, question_for(metric, place))
        finding.ours = our_latest(con, metric_id, geoids)
        try:
            candidates, finding.answer = dc.ask(finding.question)
            finding.candidates = candidates[:CANDIDATES]
            if finding.candidates:
                finding.variable, finding.score = finding.candidates[0]
                if finding.score >= CLOSE:
                    read = dc.latest(finding.variable, geoids)
                    if read:
                        finding.theirs, finding.their_source = read
        except httpx.HTTPError as error:
            finding.error = f"{type(error).__name__}: {error}"
        finding.verdict = verdict(finding)
        findings.append(finding)
        if progress:
            progress(i, len(metrics), finding)
    return findings


def write(
    findings: list[Finding], out_dir: Path, geoid: str, day: date
) -> tuple[Path, Path]:
    """The full record as JSON, and a flat CSV to sort and annotate by hand."""
    out_dir.mkdir(parents=True, exist_ok=True)
    stem = out_dir / f"discovery-{geoid}-{day.isoformat()}"
    json_path, csv_path = stem.with_suffix(".json"), stem.with_suffix(".csv")
    json_path.write_text(
        json.dumps(
            {
                "geoid": geoid,
                "run": day.isoformat(),
                "close": CLOSE,
                "findings": [asdict(f) for f in findings],
            },
            indent=2,
        )
        + "\n"
    )
    order = {v: i for i, v in enumerate(VERDICTS)}
    with csv_path.open("w", newline="") as handle:
        out = csv.writer(handle)
        out.writerow(
            [
                "verdict",
                "metric_id",
                "question",
                "variable",
                "score",
                "their_date",
                "their_value",
                "their_geoid",
                "their_source",
                "our_date",
                "our_value",
                "our_geoid",
                "their_answer",
                "runners_up",
            ]
        )
        for f in sorted(findings, key=lambda f: (order[f.verdict], f.metric_id)):
            t, o = f.theirs, f.ours
            out.writerow(
                [
                    f.verdict,
                    f.metric_id,
                    f.question,
                    f.variable or "",
                    f"{f.score:.3f}" if f.score is not None else "",
                    t.date if t else "",
                    t.value if t else "",
                    t.geoid if t else "",
                    f.their_source or "",
                    o.date if o else "",
                    o.value if o else "",
                    o.geoid if o else "",
                    f.answer or "",
                    "; ".join(f"{sv} {s:.2f}" for sv, s in f.candidates[1:]),
                ]
            )
    return json_path, csv_path


def dcid(geoid: str) -> str:
    """A GEOID as Data Commons names it; a full id ("country/USA") passes through."""
    return geoid if "/" in geoid else f"geoId/{geoid}"


def domain(url: str) -> str:
    """'https://data.census.gov/table' -> 'census.gov'."""
    host = httpx.URL(url).host if url.startswith("http") else ""
    return ".".join(host.split(".")[-2:]) if host else ""


def catalogue(
    holdings: Iterable[Holding], ours: dict[str, list[str]], examples: int = 5
) -> list[SourceSummary]:
    """Holdings grouped by source, largest first.

    `ours` maps a domain to our source ids on it, from `config/sources.yml`.
    """
    grouped: dict[str, list[Holding]] = {}
    for holding in holdings:
        grouped.setdefault(holding.source, []).append(holding)
    summaries = []
    for source, rows in grouped.items():
        url = next((r.url for r in rows if r.url), "")
        variables = sorted({r.variable for r in rows})
        summaries.append(
            SourceSummary(
                source=source,
                url=url,
                variables=len(variables),
                newest=max(r.date for r in rows),
                places=sorted({r.geoid for r in rows}),
                same_publisher=ours.get(domain(url), []),
                examples=variables[:examples],
            )
        )
    return sorted(summaries, key=lambda s: (-s.variables, s.source))


def our_domains(addresses: dict[str, list[str]]) -> dict[str, list[str]]:
    """Our source ids by the domains of their addresses (`url`, `homepage`)."""
    by_domain: dict[str, list[str]] = {}
    for source_id, urls in addresses.items():
        for found in {domain(u) for u in urls if u}:
            if found:
                by_domain.setdefault(found, []).append(source_id)
    return {k: sorted(v) for k, v in by_domain.items()}


def write_catalogue(
    summaries: list[SourceSummary], out_dir: Path, geoids: list[str], day: date
) -> tuple[Path, Path]:
    """The catalogue as JSON, and as a CSV to sort and annotate by hand."""
    out_dir.mkdir(parents=True, exist_ok=True)
    names = "-".join(g.replace("/", "_") for g in geoids)
    stem = out_dir / f"catalogue-{names}-{day.isoformat()}"
    json_path, csv_path = stem.with_suffix(".json"), stem.with_suffix(".csv")
    json_path.write_text(
        json.dumps(
            {
                "geoids": geoids,
                "run": day.isoformat(),
                "sources": [asdict(s) for s in summaries],
            },
            indent=2,
        )
        + "\n"
    )
    with csv_path.open("w", newline="") as handle:
        out = csv.writer(handle)
        out.writerow(
            [
                "source",
                "variables",
                "newest",
                "places",
                "same_publisher_as_ours",
                "url",
                "examples",
            ]
        )
        for s in summaries:
            out.writerow(
                [
                    s.source,
                    s.variables,
                    s.newest,
                    " ".join(s.places),
                    " ".join(s.same_publisher),
                    s.url,
                    "; ".join(s.examples),
                ]
            )
    return json_path, csv_path
