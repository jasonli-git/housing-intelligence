import Link from "next/link";
import { Choropleth } from "@/components/Choropleth";
import { api, formatChange, formatValue } from "@/lib/api";

const METRIC = "zhvi_sfr";
const WINDOW = "5y";

export default async function Home() {
  const [geo, ranking] = await Promise.all([
    api.geo("county"),
    api.rankings(METRIC, "county", WINDOW, 25),
  ]);

  if (!geo || !ranking) {
    return (
      <main>
        <h1>Housing Intelligence Platform</h1>
        <div className="card">
          <p>The API is unreachable, so there is nothing to show.</p>
          <p className="muted">
            Start it with <code>make api</code>, and check the warehouse is loaded with{" "}
            <code>make pipeline</code>.
          </p>
        </div>
      </main>
    );
  }

  // `value` is the ranked quantity whatever the basis — a percentage change here,
  // and non-null by construction, unlike the change-only fields.
  const values = new Map(ranking.items.map((r) => [r.region_id, r.value]));
  const window = ranking.items[0];

  return (
    <main>
      <h1>New Jersey housing</h1>
      <p className="sub">
        {ranking.label} change over five years, by county
        {window && ` · ${window.window_start} to ${window.window_end}`}
      </p>

      <div
        // Stacks below ~64rem so the table is never clipped on a narrow screen.
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 26rem), 1fr))",
          gap: "2rem",
          alignItems: "start",
        }}
      >
        <Choropleth
          geo={geo}
          values={values}
          title={`${ranking.label}, ${WINDOW} change`}
        />

        <section>
          <h2 style={{ marginTop: 0 }}>Ranked by change</h2>
          <p className="muted" style={{ marginTop: "-0.4rem" }}>
            Rank 1 is the {ranking.direction === "lower_is_better" ? "smallest" : "largest"}{" "}
            rise, following the metric&rsquo;s own direction.
          </p>
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th className="num">#</th>
                  <th>County</th>
                  <th className="num">Change</th>
                  <th className="num">Latest</th>
                </tr>
              </thead>
              <tbody>
                {ranking.items.map((row) => (
                  <tr key={row.region_id}>
                    <td className="num">{row.rank}</td>
                    <td>
                      <Link href={`/regions/${row.region_id}`}>{row.name}</Link>
                    </td>
                    <td className="num">{formatChange(row.value)}</td>
                    <td className="num">
                      {row.end_value === null
                        ? "—"
                        : formatValue(row.end_value, ranking.unit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
