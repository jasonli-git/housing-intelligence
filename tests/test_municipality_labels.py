"""Municipality labels across two states (2026-10-21): New Jersey's stay as they were;
a label another state shares gains the state's code."""

from sqlalchemy import create_engine, text

from hip.warehouse.names import municipality_label

TOWNS = [
    # region_id, name, name_lsad, state, county region_id
    (11, "Princeton", "Princeton", "NJ", 1),
    (12, "Boonton", "Boonton town", "NJ", 2),
    (13, "Boonton", "Boonton township", "NJ", 2),
    (14, "Washington", "Washington township", "NJ", 3),
    (15, "Washington", "Washington township", "NJ", 2),
    (21, "Washington", "Washington township", "PA", 4),
    (22, "Bethlehem", "Bethlehem township", "NJ", 3),
    (23, "Bethlehem", "Bethlehem township", "PA", 5),
]
COUNTIES = [
    (1, "Mercer", "NJ"),
    (2, "Morris", "NJ"),
    (3, "Warren", "NJ"),
    (4, "Warren", "PA"),
    (5, "Northampton", "PA"),
]


def labels() -> dict[int, str]:
    engine = create_engine("sqlite://")
    with engine.begin() as c:
        c.execute(
            text(
                "CREATE TABLE regions (region_id INT, level TEXT, name TEXT, "
                "name_lsad TEXT, state_code TEXT, parent_id INT)"
            )
        )
        for rid, name, state in COUNTIES:
            c.execute(
                text("INSERT INTO regions VALUES (:r, 'county', :n, :n, :s, NULL)"),
                {"r": rid, "n": name, "s": state},
            )
        for rid, name, lsad, state, county in TOWNS:
            c.execute(
                text("INSERT INTO regions VALUES (:r, 'municipality', :n, :l, :s, :c)"),
                {"r": rid, "n": name, "l": lsad, "s": state, "c": county},
            )
        rows = c.execute(
            text(
                f"SELECT t.region_id, {municipality_label('t', 'c')} FROM regions t "
                "JOIN regions c ON c.region_id = t.parent_id "
                "WHERE t.level = 'municipality'"
            )
        ).fetchall()
    return {int(r): str(label) for r, label in rows}


def test_labels_across_two_states() -> None:
    got = labels()
    assert got[11] == "Princeton"  # the only one anywhere
    assert got[12] == "Boonton town"  # its legal type tells it apart
    # Two in one state: the county tells them apart; another state shares the label.
    assert got[14] == "Washington township, Warren County, NJ"
    assert got[15] == "Washington township, Morris County, NJ"
    assert got[21] == "Washington township, PA"
    # One in each state: the state's code alone.
    assert got[22] == "Bethlehem township, NJ"
    assert got[23] == "Bethlehem township, PA"
