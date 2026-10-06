"""A New Jersey municipality's name as a list without counties must give it.

Thirty names repeat across New Jersey's 564 towns: Boonton town and Boonton township
are both in Morris County, and there are Washington townships in five counties. A list
of towns linked to their pages (Milestone 45's work destinations, Milestone 46's
similar places) names a town plainly where its name is New Jersey's only one, by its
legal type (`name_lsad`) where that is, and by its legal type and county otherwise.
"""

from __future__ import annotations


def municipality_label(town: str, county: str) -> str:
    """SQL for the label of the municipality row aliased `town`, whose county row is
    aliased `county`."""
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
            ELSE {town}.name_lsad || ', ' || {county}.name || ' County'
        END"""
