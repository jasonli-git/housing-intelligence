"""Snyder's civil boundaries: headings read through OCR slips, renames followed back."""

from hip.sources.nj_civil_boundaries import (
    NjCivilBoundariesAdapter,
    parse_entries,
    resolve,
)

# Shaped like pdftotext's reading of the State Library scan: padded columns, a stray
# mark after a heading, a misread type, an asterisk for a town since gone.
TEXT = """
Preface text that mentions Oaklyn borough
ATLANTIC          COUNTY
Avalon borougb
     1892     Apr.  18     Formed from Middle twp.     10
BERGEN       COUNTY
Riverside borough •
     1894     June 30      Formed from Midland twp.    80
River Edge     borough
     1930     Dec.  1      Replaced Riverside bor.     80, 156
CAMDEN    COUNTY
Oaklyn borough
     1905     Mar.  13     Formed from Haddon twp.     50
Stockton town*
     1894     May   1      Replaced Stockton twp.      4
Franklin   borough
     19{t3    Mar.  18     Formed from Hardyston twp.
MONMOUTH   COUNTY
Eatontown township
     1873     Apr.  4      Formed from Ocean and Shrewsbury twps.
Eatontown borough
     1926     Mar.  8      Replaced Eatontown twp.
New Shrewsbury borough
     1950     Mar.  1      Formed from Shrewsbury twp.
                        IV.    MISCELLANEOUS        TABLES
Schraalenburgh    Dumont    Bergen
"""


def by_name(rows):
    return {(r["county"], r["name"]): r for r in rows}


def test_reads_headings_through_ocr_slips_and_stops_at_the_tables():
    entries = parse_entries(TEXT)
    names = [(e["county"], e["name"], e["type"]) for e in entries]
    assert ("Atlantic", "Avalon", "borough") in names
    assert ("Bergen", "Riverside", "borough") in names
    assert all(e["name"] != "Schraalenburgh" for e in entries)
    stockton = next(e for e in entries if e["name"] == "Stockton")
    assert stockton["defunct"] is True


def test_a_misread_year_is_left_undated():
    franklin = next(e for e in parse_entries(TEXT) if e["name"] == "Franklin")
    assert franklin["year"] is None


def test_a_rename_keeps_the_earlier_year_and_a_change_of_form_does_not():
    rows = by_name(resolve(parse_entries(TEXT)))
    assert rows[("Bergen", "River Edge borough")]["year"] == 1894
    assert rows[("Monmouth", "Eatontown borough")]["year"] == 1926
    assert rows[("Camden", "Oaklyn borough")]["county_fips"] == "34007"


def test_a_town_renamed_since_1968_takes_its_book_entry():
    rows = by_name(resolve(parse_entries(TEXT)))
    assert rows[("Monmouth", "Tinton Falls borough")]["year"] == 1950


def test_the_adapter_lands_the_scan_as_a_pdf():
    (ref,) = NjCivilBoundariesAdapter().refs()
    assert NjCivilBoundariesAdapter.landing_format == "pdf"
    assert ref.url.startswith("https://dspace.njstatelib.org/")
    assert NjCivilBoundariesAdapter.filename(ref) == "bulletin67.pdf"
