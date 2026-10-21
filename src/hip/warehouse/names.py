"""A New Jersey municipality's name as a list without counties must give it.

Thirty names repeat across New Jersey's 564 towns: Boonton town and Boonton township
are both in Morris County, and there are Washington townships in five counties. A list
of towns linked to their pages (Milestone 45's work destinations, Milestone 46's
similar places) names a town plainly where its name is New Jersey's only one, by its
legal type (`name_lsad`) where that is, and by its legal type and county otherwise.

With a second state loaded, names repeat across states too — Washington township is in
New Jersey's and Pennsylvania's Warren County alike — so a name is checked within its
own state first, and the state's code is added only where another state shares the
label (2026-10-21). With one state loaded, every label is what it was.
"""

from __future__ import annotations


def municipality_label(town: str, county: str) -> str:
    """SQL for the label of the municipality row aliased `town`, whose county row is
    aliased `county`."""
    others = (
        f"EXISTS (SELECT 1 FROM regions x WHERE x.level = 'municipality'"
        f" AND x.name_lsad = {town}.name_lsad AND x.state_code <> {town}.state_code)"
    )
    return f"""
        CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM regions o
                WHERE o.level = 'municipality' AND o.name = {town}.name
                  AND o.region_id <> {town}.region_id
            ) THEN {town}.name
            WHEN NOT EXISTS (
                SELECT 1 FROM regions o
                WHERE o.level = 'municipality' AND o.name_lsad = {town}.name_lsad
                  AND o.region_id <> {town}.region_id
            ) THEN {town}.name_lsad
            WHEN NOT EXISTS (
                SELECT 1 FROM regions o
                WHERE o.level = 'municipality' AND o.name_lsad = {town}.name_lsad
                  AND o.state_code = {town}.state_code
                  AND o.region_id <> {town}.region_id
            ) THEN {town}.name_lsad || ', ' || {town}.state_code
            ELSE {town}.name_lsad || ', ' || {county}.name || ' County'
                || CASE WHEN {others} THEN ', ' || {town}.state_code ELSE '' END
        END"""
