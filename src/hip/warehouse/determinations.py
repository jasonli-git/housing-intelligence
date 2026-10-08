"""When HUD's income limits took effect (#350).

The warehouse dates each fiscal year's limits 1 January to 31 December, which is how
`price_to_ami` pairs them with Zillow's calendar-year average — FY2026's with 2026's.
But a year's limits apply from the effective date in HUD's annual notice, not from
January, and the newest year's 31 December has not happened. Re-dating the facts would
move every AMI ratio's window into the following year (TODO, "HUD income limits are
dated by calendar year"), so the dates a reader sees come from here instead.

Each from HUD's Section 8 income-limits notice for the year, checked 2026-10-08:
FY2023's came late (15 May) because the 2020 ACS was unusable, FY2026's (1 May) because
the Census Bureau delayed the 2024 ACS.
"""

from __future__ import annotations

from datetime import date

INCOME_LIMITS_IN_FORCE: dict[int, date] = {
    2020: date(2020, 4, 1),
    2021: date(2021, 4, 1),
    2022: date(2022, 4, 18),
    2023: date(2023, 5, 15),
    2024: date(2024, 4, 1),
    2025: date(2025, 4, 1),
    2026: date(2026, 5, 1),
}


def income_limits_in_force(fiscal_year: int) -> date | None:
    """The day a fiscal year's income limits took effect, where HUD's notice is held."""
    return INCOME_LIMITS_IN_FORCE.get(fiscal_year)
