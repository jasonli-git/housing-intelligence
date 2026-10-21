"""Disposable PostgreSQL schemas, so a test never writes the served public tables.

`scratch_warehouse` clones every table's DDL, not data or triggers, and never falls back
to public. `shadowed_warehouse` clones only the tables a test writes and reads the rest
from public. Serial defaults are replaced by scratch-owned identity sequences, so a
test cannot advance a public sequence either.
"""

from collections.abc import Iterator, Mapping
from contextlib import contextmanager
from uuid import uuid4

from sqlalchemy import Connection, Engine, create_engine, text


@contextmanager
def scratch_warehouse(served: Engine) -> Iterator[Engine]:
    schema = "hip_test_" + uuid4().hex
    scratch = create_engine(
        served.url, connect_args={"options": f"-csearch_path={schema},pg_catalog"}
    )
    try:
        with served.begin() as conn:
            conn.execute(text(f"CREATE SCHEMA {schema}"))
            conn.execute(
                text(
                    f"CREATE TYPE {schema}.region_level AS ENUM "
                    "('state','county','municipality','zip','tract','parcel')"
                )
            )
            tables = (
                conn.execute(
                    text(
                        "SELECT tablename FROM pg_tables WHERE schemaname='public' "
                        "AND tablename NOT IN ('spatial_ref_sys', 'alembic_version')"
                    )
                )
                .scalars()
                .all()
            )
            for table in tables:
                _clone(conn, schema, table)
            # Definitions are fixed inputs, not real observations or analytics.
            for table in ("sources", "metrics"):
                conn.execute(
                    text(f"INSERT INTO {schema}.{table} SELECT * FROM public.{table}")
                )
        with scratch.connect() as conn:
            assert conn.execute(text("SELECT current_schema()")).scalar_one() == schema
            assert "public" not in conn.execute(text("SHOW search_path")).scalar_one()
        yield scratch
    finally:
        scratch.dispose()
        with served.begin() as conn:
            conn.execute(text(f"DROP SCHEMA IF EXISTS {schema} CASCADE"))


@contextmanager
def shadowed_warehouse(
    served: Engine,
    tables: tuple[str, ...],
    *,
    copy: Mapping[str, str] | None = None,
    triggers: bool = False,
) -> Iterator[Engine]:
    """Clone `tables` into a scratch schema searched before public.

    Unqualified names resolve to the clones, so a test writes only those and reads
    everything else as served. A test must therefore write nothing it did not shadow.
    A public view over a shadowed table is recreated over the clone, since a view is
    bound to the table it was created on. `copy` maps a shadowed table to a `WHERE`
    clause choosing the public rows to start with; `triggers` recreates the public
    tables' own triggers on the clones, whose functions then write the clones too.
    """
    schema = "hip_test_" + uuid4().hex
    scratch = create_engine(
        served.url, connect_args={"options": f"-csearch_path={schema},public"}
    )
    try:
        with served.begin() as conn:
            conn.execute(text(f"CREATE SCHEMA {schema}"))
            for table in tables:
                _clone(conn, schema, table)
            for table, where in (copy or {}).items():
                assert table in tables, f"{table} is copied but not shadowed"
                conn.execute(
                    text(
                        f"INSERT INTO {schema}.{table} SELECT * FROM public.{table} "
                        f"WHERE {where}"
                    )
                )
            if triggers:
                for table in tables:
                    for (definition,) in conn.execute(
                        text(
                            "SELECT pg_get_triggerdef(oid) FROM pg_trigger "
                            "WHERE tgrelid = to_regclass(:t) AND NOT tgisinternal"
                        ),
                        {"t": f"public.{table}"},
                    ):
                        conn.execute(
                            text(
                                definition.replace(
                                    f" ON public.{table} ", f" ON {schema}.{table} "
                                )
                            )
                        )
            # Printed under the served search path, so names come out unqualified.
            views = conn.execute(
                text(
                    "SELECT DISTINCT view_name, pg_get_viewdef(format('public.%I', "
                    "view_name)::regclass) FROM information_schema.view_table_usage "
                    "WHERE view_schema = 'public' AND table_schema = 'public' "
                    "AND table_name = ANY(:tables)"
                ),
                {"tables": list(tables)},
            ).all()
        with scratch.begin() as conn:
            assert conn.execute(text("SELECT current_schema()")).scalar_one() == schema
            for view, definition in views:
                conn.execute(text(f"CREATE VIEW {schema}.{view} AS {definition}"))
        yield scratch
    finally:
        scratch.dispose()
        with served.begin() as conn:
            conn.execute(text(f"DROP SCHEMA IF EXISTS {schema} CASCADE"))


def _clone(conn: Connection, schema: str, table: str) -> None:
    """One public table's columns, keys and indexes, with defaults of its own."""
    quote = conn.dialect.identifier_preparer.quote
    target = f"{schema}.{quote(table)}"
    conn.execute(
        text(
            f"CREATE TABLE {target} (LIKE public.{quote(table)} "
            "INCLUDING ALL EXCLUDING DEFAULTS EXCLUDING IDENTITY)"
        )
    )
    columns = conn.execute(
        text(
            "SELECT column_name, column_default "
            "FROM information_schema.columns "
            "WHERE table_schema='public' AND table_name=:table "
            "AND column_default IS NOT NULL"
        ),
        {"table": table},
    ).all()
    for column, default in columns:
        if default.startswith("nextval("):
            conn.execute(
                text(
                    f"ALTER TABLE {target} ALTER COLUMN {quote(column)} "
                    "ADD GENERATED BY DEFAULT AS IDENTITY"
                )
            )
        else:
            conn.execute(
                text(
                    f"ALTER TABLE {target} ALTER COLUMN {quote(column)} "
                    f"SET DEFAULT {default}"
                )
            )


def seed_analytics(engine: Engine) -> None:
    """Small, deterministic survey/index histories, including unknown margins."""
    with engine.begin() as conn:
        # Copy only six region identities/geometries (no production facts).
        conn.execute(
            text("""
            INSERT INTO regions SELECT * FROM public.regions WHERE region_id IN (
              SELECT region_id FROM public.regions WHERE level='county'
              ORDER BY region_id LIMIT 3
            ) OR region_id IN (
              SELECT region_id FROM public.regions WHERE level='zip'
              ORDER BY region_id LIMIT 3
            )
        """)
        )
        conn.execute(
            text("""
            INSERT INTO source_releases
              (source_id,layer,vintage,fetched_at,file_sha256,row_count)
            VALUES ('census_acs','test','synthetic','2026-01-01','synthetic',1)
        """)
        )
        # Packet queries cast the unqualified enum name; keep this type local too.
        checks = conn.execute(
            text(
                "SELECT conname FROM pg_constraint "
                "WHERE conrelid='regions'::regclass AND contype='c'"
            )
        )
        quote = engine.dialect.identifier_preparer.quote
        for check in checks.scalars().all():
            conn.execute(text(f"ALTER TABLE regions DROP CONSTRAINT {quote(check)}"))
        conn.execute(
            text(
                "ALTER TABLE regions ALTER COLUMN level TYPE region_level "
                "USING level::text::region_level"
            )
        )
        conn.execute(
            text("""
            INSERT INTO fact_metric_observation
              (region_id,metric_id,period_start,period_end,value,release_id,
               match_method,margin_of_error)
            SELECT r.region_id,m.metric,
              make_date(y-4,1,1),make_date(y,12,31),
              m.base + (y-2010)*m.base/50 + r.region_id*10,
              (SELECT release_id FROM source_releases LIMIT 1),'fips',
              CASE WHEN r.region_id=(SELECT min(region_id) FROM regions)
                        AND m.metric='acs_median_gross_rent' THEN NULL
                   ELSE m.base/20 END
            FROM regions r CROSS JOIN generate_series(2010,2025) y
            CROSS JOIN (VALUES ('acs_median_hh_income',60000.0),
              ('acs_median_home_value',250000.0),('acs_median_gross_rent',1000.0))
              m(metric,base)
            WHERE r.level='county' OR y BETWEEN 2020 AND 2024;
            INSERT INTO fact_metric_observation
              (region_id,metric_id,period_start,period_end,value,release_id,
               match_method,margin_of_error)
            SELECT r.region_id,'zhvi_sfr',make_date(y,1,1),make_date(y,12,31),
              200000+(y-2010)*10000+r.region_id*100,1,'fips',NULL
            FROM regions r CROSS JOIN generate_series(2010,2025) y
            WHERE r.level='county' OR y BETWEEN 2020 AND 2024
        """)
        )
