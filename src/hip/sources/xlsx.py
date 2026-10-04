"""Read offered XLSX workbooks without a spreadsheet engine or a fixed row limit.

Only cell values are read, including the publisher's cached formula results. Missing
formula results stay missing; we never evaluate a publisher's formula ourselves.
"""

from collections.abc import Iterator
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile

from hip.sources.base import SourceError

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"


def sheets(path: Path) -> list[str]:
    with ZipFile(path) as z:
        root = ET.fromstring(z.read("xl/workbook.xml"))
        return [s.attrib["name"] for s in root.iter(f"{NS}sheet")]


def rows(path: Path, sheet: str) -> Iterator[tuple[int, dict[str, str]]]:
    """Yield sparse rows by Excel column letter, streaming through formatted blanks."""
    with ZipFile(path) as z:
        shared: list[str] = []
        if "xl/sharedStrings.xml" in z.namelist():
            with z.open("xl/sharedStrings.xml") as handle:
                for _, node in ET.iterparse(handle, events=("end",)):
                    if node.tag == f"{NS}si":
                        shared.append("".join(t.text or "" for t in node.iter(f"{NS}t")))
                        node.clear()
        links = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
        targets = {n.attrib["Id"]: n.attrib["Target"] for n in links}
        book = ET.fromstring(z.read("xl/workbook.xml"))
        properties = book.find(f"{NS}workbookPr")
        if properties is not None and properties.attrib.get("date1904") in ("1", "true"):
            raise SourceError(
                "XLSX 1904 date system is not supported; refusing shifted dates"
            )
        found = [n for n in book.iter(f"{NS}sheet") if n.attrib["name"] == sheet]
        if len(found) != 1:
            raise SourceError(f"XLSX worksheet {sheet!r} missing or ambiguous")
        target = targets[found[0].attrib[REL]]
        filename = target.lstrip("/") if target.startswith("/") else f"xl/{target}"
        with z.open(filename) as handle:
            # Clearing completed rows keeps even a 300,000-row formatted sheet small.
            context = ET.iterparse(handle, events=("start", "end"))
            _, root = next(context)
            for event, node in context:
                if event != "end" or node.tag != f"{NS}row":
                    continue
                cells: dict[str, str] = {}
                for cell in node:
                    if cell.tag != f"{NS}c":
                        continue
                    column = "".join(c for c in cell.attrib["r"] if c.isalpha())
                    value = cell.findtext(f"{NS}v", "")
                    if cell.attrib.get("t") == "s" and value:
                        value = shared[int(value)]
                    elif cell.attrib.get("t") == "inlineStr":
                        value = "".join(t.text or "" for t in cell.iter(f"{NS}t"))
                    if value:
                        cells[column] = value.strip()
                if cells:
                    yield int(node.attrib["r"]), cells
                node.clear()
                root.clear()
