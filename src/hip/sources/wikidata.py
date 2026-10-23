"""Towns' incorporation dates and the people born in them, from Wikidata (stories).

Wikidata is the structured data behind Wikipedia, every statement CC0. Two questions
asked of its SPARQL service, each answered as one CSV:

* **municipalities** — every New Jersey place with a FIPS 55 code, its county's FIPS
  code and, where recorded, its inception: for a municipality, the date it was
  incorporated or set off. The code and the county make the town's GEOID exactly, no
  name matching. Measured 2026-10-23: 563 of the 564 municipalities matched, 430 with a
  date. A missing date is Wikidata's gap, not a town without a history, and the story
  says how many there are.
* **births** — every person whose place of birth is one of those places, with the
  number of Wikipedia languages that have an article on them: a rough, public measure
  of how widely known someone is. 12,642 people on 2026-10-23. Only people already
  notable enough for Wikidata are in it, and its editors record some towns and some
  eras more fully than others; the story counts notability as Wikidata records it.

The service asks for an identifying User-Agent and stops a query at 60 seconds, so both
step from a town to its county to the state rather than walking every chain of
locations, and an answer cut short is refused (`_fetch_bytes`).
"""

from __future__ import annotations

from datetime import timedelta
from pathlib import Path
from typing import ClassVar
from urllib.parse import urlencode

from hip.sources.base import ReleaseRef, SourceAdapter, SourceError

ENDPOINT = "https://query.wikidata.org/sparql"

QUERIES = {
    "municipalities": """
SELECT ?item ?fips ?county ?inception WHERE {
  ?item wdt:P774 ?fips ; wdt:P131 ?c .
  ?c wdt:P131 wd:Q1408 ; wdt:P882 ?county .
  OPTIONAL { ?item wdt:P571 ?inception }
}""",
    "births": """
SELECT ?place ?person ?personLabel ?links WHERE {
  ?place wdt:P774 ?fips ; wdt:P131 ?c .
  ?c wdt:P131 wd:Q1408 .
  ?person wdt:P19 ?place ; wdt:P31 wd:Q5 ; wikibase:sitelinks ?links .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}""",
}


class WikidataAdapter(SourceAdapter):
    source_id: ClassVar[str] = "wikidata"
    default_vintage: ClassVar[str] = "current"
    states: ClassVar[tuple[str, ...] | None] = ("NJ",)
    # Edited continuously; a story about history needs nothing fresher than a month.
    revalidate_after: ClassVar[timedelta] = timedelta(days=30)
    headers: dict[str, str] = {  # noqa: RUF012 - the base class's instance attribute
        "User-Agent": "housing-intelligence/0.2 (public data research; "
        "https://github.com/jasonli-git/housing-intelligence)",
        "Accept": "text/csv",
    }

    def refs(self, vintage: str | None = None) -> list[ReleaseRef]:
        return [
            ReleaseRef(
                source_id=self.source_id,
                layer=layer,
                vintage=vintage or self.default_vintage,
                url=f"{ENDPOINT}?{urlencode({'query': query.strip()})}",
            )
            for layer, query in QUERIES.items()
        ]

    csv_encoding: ClassVar[str] = "utf-8"

    @classmethod
    def filename(cls, ref: ReleaseRef) -> str:
        return f"{ref.layer}.csv"

    def _fetch_bytes(self, ref: ReleaseRef, destination: Path) -> None:
        """The answer, refused if the service gave up partway through it.

        A query running into the 60-second limit is not an error status: the service
        has already sent 200 and some rows, and appends the Java exception to the CSV.
        Measured 2026-10-23, when walking every place's whole chain of locations to New
        Jersey did exactly that; the queries now step from town to county to state.
        """
        super()._fetch_bytes(ref, destination)
        tail = destination.read_bytes()[-4096:]
        if b"SPARQL-QUERY" in tail or b"Exception" in tail:
            raise SourceError(f"{ref.source_id}/{ref.layer}: the query timed out")
