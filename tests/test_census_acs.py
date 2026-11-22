"""The ACS adapter's own fetching (Milestone 63)."""


def test_a_long_zcta_list_is_asked_for_in_parts_and_written_as_one_matrix(
    tmp_path, monkeypatch
) -> None:
    """Milestone 63: the API refuses Pennsylvania's 1,800 ZCTAs in one request."""
    import json as _json

    import httpx

    from hip.sources import census_acs
    from hip.sources.base import ReleaseRef

    asked: list[int] = []

    def respond(request: httpx.Request) -> httpx.Response:
        codes = request.url.params["for"].split(":", 1)[1].split(",")
        asked.append(len(codes))
        rows = [["B01003_001E", "zip code tabulation area"]] + [["1", c] for c in codes]
        return httpx.Response(200, json=rows)

    real = httpx.Client
    monkeypatch.setattr(
        census_acs.httpx,
        "Client",
        lambda **kw: real(transport=httpx.MockTransport(respond), **kw),
    )
    codes = ",".join(f"{15000 + i}" for i in range(1500))
    ref = ReleaseRef(
        source_id="census_acs",
        layer="zcta",
        vintage="2024",
        scope="PA",
        url=f"{census_acs.BASE_URL}/2024/acs/acs5?get=B01003_001E"
        f"&for=zip%20code%20tabulation%20area:{codes}&key=k",
    )
    out = tmp_path / "zcta.json"
    census_acs.AcsAdapter(states=["PA"], end_year=2024)._fetch_bytes(ref, out)
    matrix = _json.loads(out.read_text())
    assert asked == [600, 600, 300]
    assert matrix[0] == ["B01003_001E", "zip code tabulation area"]
    assert len(matrix) == 1501 and matrix[-1][1] == "16499"
