# Synthetic data-guard fixtures

These are invented, deliberately tiny publisher-shaped examples, not downloaded
publisher files. The geography names and figures are not observations about real
places. `county.csv`, `city.csv` and `zip.csv` share their cells across ZHVI and ZORI
tests because those tests guard shape, not plausible rent or price magnitudes.

- Three date columns, blanks, a real zero, an out-of-scope state and leading-zero
  county/ZIP identifiers exercise the actual landing and dbt unpivot.
- FRED JSON includes its `.` missing-value sentinel.
- BLS JSON includes two months and the annual-average pseudo-month `M13`.
- FHFA CSV includes one state quarterly and one national monthly observation.

Changed-shape and error responses are derived inside the tests. All API credentials
are the literal `synthetic-not-a-credential`; no publisher requests are made.
