import Link from "next/link";
import { TrendChart } from "@/components/TrendChart";
import { api, formatChange, formatValue } from "@/lib/api";

const WINDOW = "5y";
// The series worth plotting on a region page, in the order a reader wants them.
const TREND_METRICS = ["zhvi_sfr", "zori_all", "acs_median_hh_income"];

export default async function RegionPage({
  params,
}: {
  // Next 16 makes route params a promise; awaiting is required, not optional.
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const regionId = Number(id);

  const [region, summary] = await Promise.all([
    api.region(regionId),
    api.summary(regionId, WINDOW),
  ]);

  if (!region || !summary) {
    return (
      <main>
        <h1>Region not found</h1>
        <p className="sub">
          No region {id}, or the API is unreachable. <Link href="/">Back to the map</Link>.
        </p>
      </main>
    );
  }

  const series = await Promise.all(
    TREND_METRICS.map(async (metricId) => ({
      metricId,
      data: await api.observations(regionId, metricId),
    })),
  );

  return (
    <main>
      <p className="muted">
        <Link href="/">Overview</Link>
        {region.ancestors
          .slice()
          .reverse()
          .map((a) => (
            <span key={a.region_id}>
              {" / "}
              <Link href={`/regions/${a.region_id}`}>{a.name}</Link>
            </span>
          ))}
      </p>
      <h1>{region.name}</h1>
      <p className="sub">
        {region.level} · {summary.headlines.length} metrics · {WINDOW} change ·{" "}
        <Link href={`/regions/${regionId}/report`}>report</Link>
      </p>

      <div className="tiles">
        {summary.headlines.map((h) => (
          <div className="tile" key={h.metric_id}>
            <div className="label">{h.label}</div>
            <div className="value">{formatValue(h.end_value, h.unit)}</div>
            <div className="meta">
              {formatChange(h.pct_change)} over {WINDOW}
              {h.rank !== null && ` · rank ${h.rank}/${h.of}`}
            </div>
          </div>
        ))}
      </div>

      {series.map(({ metricId, data }) => {
        const observations = data?.observations ?? [];
        if (observations.length < 2) return null;
        const headline = summary.headlines.find((h) => h.metric_id === metricId);
        return (
          <section key={metricId}>
            <h2>{headline?.label ?? metricId}</h2>
            <TrendChart
              points={observations.map((o) => ({
                date: o.period_start,
                value: o.value,
              }))}
              label={`${headline?.label ?? metricId} · ${observations.length} observations`}
              unit={headline?.unit ?? ""}
            />
            {/* The table view is the accessible fallback and satisfies the relief rule
                for palette steps below 3:1 on the light surface. */}
            <details>
              <summary>Show the underlying values and their sources</summary>
              <div className="scroll-x" style={{ maxHeight: "18rem" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th className="num">Value</th>
                      <th>Source</th>
                      <th>Matched by</th>
                    </tr>
                  </thead>
                  <tbody>
                    {observations.slice(-24).reverse().map((o) => (
                      <tr key={o.period_start}>
                        <td>{o.period_start}</td>
                        <td className="num">
                          {formatValue(o.value, headline?.unit ?? "")}
                        </td>
                        <td>{o.source_id}</td>
                        <td>{o.match_method}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </section>
        );
      })}

      {summary.caveats.length > 0 && (
        <>
          <h2>Caveats</h2>
          <ul className="caveats">
            {summary.caveats.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
