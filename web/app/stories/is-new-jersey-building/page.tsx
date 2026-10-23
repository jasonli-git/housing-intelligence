import type { Metadata } from "next";
import Link from "next/link";

import { StoryLines } from "@/components/StoryLines";
import { StoryShell } from "@/components/StoryShell";
import { pageMetadata } from "@/lib/meta";
import { regionPath } from "@/lib/placeRoutes";
import { latestFor, seriesFor, storyCounties } from "@/lib/storyData";
import "../../horizon-theme.css";
import "../stories.css";

export const metadata: Metadata = pageMetadata({
  title: "Is New Jersey building? — Housing",
  description: "Homes permitted, completed and demolished in each New Jersey county, and the net homes added per 1,000.",
  path: "/stories/is-new-jersey-building",
});

const MEASURES = [
  { metric: "permits_total_units", label: "Permitted", slot: 1 },
  { metric: "nj_units_certified", label: "Completed", slot: 3 },
  { metric: "nj_units_demolished", label: "Demolished", slot: 2 },
] as const;
const n = (v: number) => Math.round(v).toLocaleString("en-US");

export default async function IsNewJerseyBuildingPage() {
  const counties = await storyCounties();
  const ids = [...counties.keys()];
  const [series, net] = await Promise.all([
    Promise.all(MEASURES.map((m) => seriesFor(m.metric, ids))),
    latestFor(["nj_net_units_per_1000", "nj_net_units_added"], "county", ids),
  ]);
  // Statewide: the sum over counties, only in years every county reported.
  const statewide = MEASURES.map((m, i) => {
    const byYear = new Map<number, number[]>();
    for (const s of series[i].values()) for (const p of s) byYear.set(p.year, [...(byYear.get(p.year) ?? []), p.value]);
    return { label: m.label, slot: m.slot, points: [...byYear].filter(([, v]) => v.length === ids.length).map(([year, v]) => ({ year, value: v.reduce((a, b) => a + b, 0) })).sort((a, b) => a.year - b.year) };
  });
  // Each county's latest year all three measures share.
  const rows = ids.map((id) => {
    const last = Math.min(...MEASURES.map((_, i) => series[i].get(id)?.at(-1)?.year ?? 0));
    const at = MEASURES.map((_, i) => series[i].get(id)?.find((p) => p.year === last)?.value ?? null);
    return { id, name: counties.get(id)!, year: last, at, per1000: net.get(id)?.nj_net_units_per_1000 ?? null };
  }).sort((a, b) => (b.per1000 ?? -Infinity) - (a.per1000 ?? -Infinity));
  const top = Math.max(...rows.flatMap((r) => r.at.map((v) => v ?? 0)));
  const topNet = Math.max(1, ...rows.map((r) => r.per1000 ?? 0));
  const w = (v: number | null) => `${Math.round(((v ?? 0) / top) * 10000) / 100}%`;
  return (
    <StoryShell
      title="Is New Jersey building?"
      lede="Homes permitted are plans; homes completed are homes; homes demolished come off the count. Statewide over the years first, then each county's latest year, ordered by net homes added for every 1,000 it already had."
      note={<>Permits: the Census Bureau&rsquo;s Building Permits Survey. Completions and demolitions: certificates of occupancy and demolition permits reported to the New Jersey Department of Community Affairs, which not every town reports every year, so a county&rsquo;s totals can run low. Net homes added: completions less demolitions, per 1,000 existing homes.</>}
    >
      <figure className="story-figure" tabIndex={0}>
        <StoryLines series={statewide} format={n} label="Line chart: homes permitted, completed and demolished statewide each year." />
      </figure>
      <h2 className="story-h">County by county</h2>
      <p className="ladder-key">{MEASURES.map((m) => <span key={m.metric}><i style={{ background: `var(--story-${m.slot})` }} />{m.label}</span>)}</p>
      <table className="story-table">
        <thead><tr><th scope="col">County</th><th scope="col">Homes, latest year</th><th scope="col">Net homes added per 1,000 homes</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <th scope="row"><Link href={regionPath(r.id)}>{r.name}</Link><br /><small>{r.year}</small></th>
              <td style={{ width: "60%" }}>
                {MEASURES.map((m, i) => (
                  <div key={m.metric} className="bar-line" title={`${m.label}: ${r.at[i] === null ? "not reported" : n(r.at[i]!)}`}>
                    <i style={{ width: w(r.at[i]), background: `var(--story-${m.slot})` }} />
                    <span>{r.at[i] === null ? "—" : n(r.at[i]!)}</span>
                  </div>
                ))}
              </td>
              <td style={{ width: "22%" }}>{r.per1000 === null ? "—" : <div className="bar-line"><i style={{ width: `${Math.round((Math.max(0, r.per1000) / topNet) * 1000) / 10}%`, background: "var(--plate-ink, var(--text-primary))" }} /><span>{r.per1000.toFixed(1)}</span></div>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </StoryShell>
  );
}
