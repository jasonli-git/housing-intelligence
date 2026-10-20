"""Reproduce the scoped NJ-token inventory; print Markdown, never edit project docs.

Categories are review annotations, not an automatic correctness gate. Literal 34 and
substring nj searches intentionally include CSS/SVG numbers and unrelated words.
"""

from __future__ import annotations

import json
import re
import subprocess
from collections import Counter, defaultdict

# Reviewed structural assumptions deliberately deferred by this bounded task.
STRUCTURAL = {
    "src/hip/sources/census_lodes.py": (
        r"/nj/|state != \"NJ\"",
        "LODES main/crosswalk and home-state selection; needs source/staging expansion",
    ),
    "src/hip/sources/fema.py": (
        r"34%|state eq 'NJ'|claims_nj",
        "Federal hazard/claims filters and filename pinned to NJ",
    ),
    "src/hip/sources/hmda.py": (
        r"states=NJ|nj_\{year\}|hmda_nj",
        "Federal loan discovery/download contract pinned to NJ",
    ),
    "src/hip/sources/epa_sdwis.py": (
        r"PRIMACY_AGENCY_CODE/NJ",
        "Federal water-violation request pinned to NJ",
    ),
    "src/hip/sources/community.py": (
        r"stateabbr='NJ'",
        "CDC PLACES state filter (NJ school/crime adapters are legitimate A)",
    ),
    "src/hip/sources/hud_assistance.py": (
        r'!= "NJ"|f"34\{county\}"|else "34"',
        "Federal assisted-property parsing filters/codes NJ; reviewed inventory contract",
    ),
    "src/hip/sources/infrastructure.py": (
        r'!= "NJ"|34\\d|all 21 NJ',
        "UCMR/EIA/LEAD filters and count guard; LEAD edition explicitly NJ-only",
    ),
    "src/hip/sources/fcc.py": (
        r'COUNTIES =|geoid == "34"|state:34|need state and 21|re.compile\(r"34|bdc_34_',
        "FCC manual summaries/location file contract is NJ-only",
    ),
    "src/hip/completeness.py": (
        r"state:34",
        "Broadband completeness check selects one state entity",
    ),
    "web/lib/affordData.ts": (
        r"state=NJ",
        "Budget enumeration is NJ-scoped; decide tool coverage before expanding",
    ),
    "web/lib/dataScale.ts": (
        r'state_code==="NJ"',
        "Home-page coverage counter filters NJ; must expand with its explanatory copy",
    ),
    "web/lib/placeRoutes.ts": (
        r"STATE_IDS",
        "One state-id destination; pinned local paths intentionally unchanged",
    ),
    "web/lib/coverageMap.ts": (
        r'NJ: "/states/',
        "State destination catalog; new state page must exist before adding destination",
    ),
    "web/lib/ownership.ts": (
        r"njSellerFees\(salePrice\)",
        "Generic buy/rent model applies NJ seller fees; needs jurisdiction rules",
    ),
    "web/components/NationalCoverageMap.tsx": (
        r"STATE_DESTINATIONS.NJ|=== \"NJ\"|New Jersey is blue|Only New Jersey|"
        r"Detailed housing pages are available for New Jersey",
        "Single covered-state locator/availability; separate home navigation expansion",
    ),
    "web/app/[state]/[place]/page.tsx": (
        r'"County in New Jersey"|"ZIP code in New Jersey"|: "New Jersey"|'
        r'href: "/states/new-jersey"|search all New Jersey',
        "Profile location, breadcrumb/tool copy; needs state-page/tool routing together",
    ),
    "web/app/[state]/[place]/report/page.tsx": (
        r'href: "/states/new-jersey"',
        "Generic report breadcrumb has one state destination",
    ),
    "web/components/SimilarPlaces.tsx": (
        r"No New Jersey",
        "Generic empty-state text names NJ; coordinate with matching geography/cohorts",
    ),
    "web/components/HowUnusual.tsx": (
        r"New Jersey against its own history",
        "Noninteractive exhibit caption assumes NJ; coordinate with state exhibit caller",
    ),
    "web/components/SectionJump.tsx": (
        r"\.nj-page",
        "State-profile section selector knows the NJ template only",
    ),
}


def inventory() -> str:
    result = subprocess.run(
        [
            "rg",
            "--json",
            "NJ|nj|34|New Jersey",
            "src/hip",
            "web/lib",
            "web/app",
            "web/components",
            "--glob",
            "!*.test.*",
            "--glob",
            "!**/__pycache__/**",
            "--glob",
            "!*.fixture.*",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode not in (0, 1):
        raise RuntimeError(result.stderr)
    groups: dict[str, dict[str, list[int]]] = defaultdict(lambda: defaultdict(list))
    for line in result.stdout.splitlines():
        item = json.loads(line)
        if item["type"] != "match":
            continue
        record = item["data"]
        file, text = record["path"]["text"], record["lines"]["text"]
        category = "A" if re.search(r"NJ|New Jersey|\bnj|nj_|/nj|\.nj", text) else "C"
        if file.endswith("placeRoutes.json") and '"geoid"' in text:
            category = "A"
        if file.endswith("photos.json") and '"geoid"' in text:
            category = "A"
        if file == "src/hip/config.py" and '"NJ"' in text:
            category = "A"
        if file == "src/hip/sources/census_permits.py" and "frozenset" in text:
            category = "A"  # Strong-MCD state-code vocabulary, not a one-state filter.
        if file in STRUCTURAL and re.search(STRUCTURAL[file][0], text):
            category = "B"
        groups[file][category].append(record["line_number"])
    totals = Counter(
        {
            key: sum(len(classes.get(key, [])) for classes in groups.values())
            for key in "ABC"
        }
    )
    rows = [
        "## Exhaustive scoped token inventory",
        "",
        "Reproduce: `uv run python scripts/audit_state_assumptions.py`. "
        "One hit means one matching source line, even with several tokens. "
        "Tests, test fixtures and bytecode are excluded; JSON, migrations, comments "
        "and CSS are included. Every matched line is assigned once. "
        "A = legitimate NJ source/content/identity (including intentional coverage); "
        "B = structural assumption, deferred unless noted above; "
        "C = numeric/SVG/style/milestone or substring noise, not an NJ assumption. "
        "No unresolved C geography case was found; assumptions without these "
        "tokens can still exist.",
        "",
        f"{len(groups)} files; {sum(totals.values())} matching lines. "
        f"A: {totals['A']}; B: {totals['B']}; C: {totals['C']}.",
        "",
        "| File | Category: matching lines | Review / disposition |",
        "|---|---|---|",
    ]
    for file, classes in sorted(groups.items()):
        references = "; ".join(
            f"{key}: {','.join(map(str, values))}"
            for key, values in sorted(classes.items())
        )
        note = (
            STRUCTURAL[file][1]
            if "B" in classes
            else "NJ-only source/content/identity; retained"
            if "A" in classes
            else "Non-geographic numeric/comment/style matches; no change"
        )
        if file.startswith("web/components/HousingAtlas") or file.startswith(
            "web/app/atlas"
        ):
            note = "NJ county Atlas is intentional (#398); retained, explicit geo caller"
        if file.endswith("placeRoutes.json"):
            note = "Pinned identities, not new-state allocation; unchanged (#367/#400)"
        rows.append(f"| `{file}` | {references} | {note} |")
    return "\n".join(rows) + "\n"


if __name__ == "__main__":
    print(inventory(), end="")
