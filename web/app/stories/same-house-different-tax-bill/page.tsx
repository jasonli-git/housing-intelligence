import type { Metadata } from "next";
import Link from "next/link";

import { StoryShell } from "@/components/StoryShell";
import { formatValue } from "@/lib/format";
import { pageMetadata } from "@/lib/meta";
import { regionPath } from "@/lib/placeRoutes";
import { storyShapes, storyTowns } from "@/lib/storyData";
import "../../horizon-theme.css";
import "../stories.css";

export const metadata: Metadata = pageMetadata({
  title: "Same house, different tax bill — Housing",
  description: "What each New Jersey town's effective tax rate means for the same house, and which towns' assessments are overdue.",
  path: "/stories/same-house-different-tax-bill",
});

const usd = (v: number) => formatValue(v, "usd");
const HOUSE = 500_000;
const W = 880, H = 440, L = 64, R = 20, T = 16, B = 44;
const MAP_W = 520;
/** Effective rates above this, per $100, are set aside from the chart (see below). */
const SET_ASIDE = 6;
const AGE = [
  { slot: "s1", label: "Revalued 2020 or later", test: (y: number) => y >= 2020 },
  { slot: "s3", label: "2010 to 2019", test: (y: number) => y >= 2010 && y < 2020 },
  { slot: "s2", label: "Before 2010", test: (y: number) => y < 2010 },
];

export default async function SameHouseDifferentTaxBillPage() {
  const [towns, map] = await Promise.all([
    storyTowns(["nj_effective_tax_rate", "acs_median_home_value", "nj_revaluation_year", "nj_director_ratio"]),
    storyShapes("municipality", MAP_W),
  ]);
  const measured = towns.filter((t) => t.values.nj_effective_tax_rate && t.values.acs_median_home_value);
  // Winfield and Audubon Park were built as wartime housing and their homes are held through
  // a mutual housing corporation, so their rates fall on small assessments and are no guide
  // to a house bought outright. Set aside and named rather than allowed to flatten the chart.
  const apart = measured.filter((t) => t.values.nj_effective_tax_rate! > SET_ASIDE);
  const points = measured.filter((t) => t.values.nj_effective_tax_rate! <= SET_ASIDE);
  const byRate = [...points].sort((a, b) => a.values.nj_effective_tax_rate! - b.values.nj_effective_tax_rate!);
  const bill = (rate: number) => (rate / 100) * HOUSE;
  const low = byRate[0], high = byRate.at(-1)!;
  const [x0, x1] = [Math.log(Math.min(...points.map((t) => t.values.acs_median_home_value!)) * 0.9), Math.log(Math.max(...points.map((t) => t.values.acs_median_home_value!)) * 1.1)];
  const topRate = Math.ceil(Math.max(...points.map((t) => t.values.nj_effective_tax_rate!)));
  const x = (v: number) => Math.round((L + ((Math.log(v) - x0) / (x1 - x0)) * (W - L - R)) * 10) / 10;
  const y = (r: number) => Math.round((H - B - (r / topRate) * (H - T - B)) * 10) / 10;
  const byId = new Map(towns.map((t) => [t.id, t]));
  const ageOf = (yr?: number) => (yr ? AGE.find((a) => a.test(yr)) : undefined);
  const overdue = towns.filter((t) => t.values.nj_director_ratio !== undefined && t.values.nj_director_ratio < 85).sort((a, b) => a.values.nj_director_ratio! - b.values.nj_director_ratio!);
  return (
    <StoryShell
      title="Same house, different tax bill"
      lede={<>New Jersey taxes homes town by town, so the same house owes very different amounts depending on the line it sits behind. A {usd(HOUSE)} house would owe about {usd(bill(low.values.nj_effective_tax_rate!))} a year in {low.name} and {usd(bill(high.values.nj_effective_tax_rate!))} in {high.name}. Dearer towns tend to tax at lower rates, as the dots show.</>}
      note={<>Effective tax rate: the state&rsquo;s general rate adjusted by each town&rsquo;s Director&rsquo;s Ratio, giving tax per $100 of market value, from the Department of Community Affairs. Home value: the Census Bureau&rsquo;s median owner-reported value. Revaluation year: the last town-wide revaluation or reassessment the county board recorded. A Director&rsquo;s Ratio under 85% means assessments have fallen well behind sale prices, the level at which a county board can order a revaluation.</>}
    >
      <figure className="story-figure">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Scatter plot: each town's effective property tax rate against its median home value.">
          <g className="grid" aria-hidden="true">
            {[200_000, 400_000, 800_000, 1_600_000].filter((t) => Math.log(t) > x0 && Math.log(t) < x1).map((t) => <g key={t}><line x1={x(t)} x2={x(t)} y1={T} y2={H - B} /><text x={x(t)} y={H - B + 18} textAnchor="middle">{usd(t)}</text></g>)}
            {Array.from({ length: topRate + 1 }, (_, r) => <g key={r}><line x1={L} x2={W - R} y1={y(r)} y2={y(r)} /><text x={L - 6} y={y(r) + 4} textAnchor="end">{r}%</text></g>)}
            <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle">Median home value</text>
          </g>
          {points.map((t) => (
            <circle key={t.id} className="dot s1" cx={x(t.values.acs_median_home_value!)} cy={y(t.values.nj_effective_tax_rate!)} r={4}>
              <title>{`${t.name}, ${t.countyName}: ${t.values.nj_effective_tax_rate!.toFixed(2)}%, about ${usd(bill(t.values.nj_effective_tax_rate!))} a year on a ${usd(HOUSE)} house`}</title>
            </circle>
          ))}
          {[low, high].map((t) => <text key={t.id} className="place" x={x(t.values.acs_median_home_value!) + 8} y={y(t.values.nj_effective_tax_rate!) + 4}>{t.name}</text>)}
        </svg>
        <figcaption className="story-note">Effective tax rate, per $100 of market value, against median home value. {points.length} towns. Set aside: {apart.map((t) => `${t.name} (${t.values.nj_effective_tax_rate!.toFixed(1)}%)`).join(" and ")}, whose homes are held through a mutual housing corporation, so the rate falls on small assessments.</figcaption>
      </figure>
      <div className="story-two">
        <figure className="story-figure">
          <h2 className="story-h">When each town last revalued</h2>
          <svg className="map" viewBox={`0 0 ${MAP_W} ${map.projector.height}`} role="img" aria-label="Map of New Jersey's towns shaded by when each last revalued its properties. Towns with overdue assessments are listed beside it.">
            {map.shapes.map((s) => {
              const t = byId.get(s.id), a = ageOf(t?.values.nj_revaluation_year);
              return <path key={s.id} d={s.d} className={`town ${a?.slot ?? "muted"}`}><title>{`${t?.name ?? s.name}: ${t?.values.nj_revaluation_year ? `revalued ${t.values.nj_revaluation_year}` : "no revaluation year on record"}`}</title></path>;
            })}
          </svg>
          <p className="ladder-key">{AGE.map((a) => <span key={a.slot}><i style={{ background: `var(--story-${a.slot.slice(1)})` }} />{a.label}</span>)}<span><i className="muted" style={{ background: "var(--plate-rule, var(--border))" }} />No year on record</span></p>
        </figure>
        <div>
          <h2 className="story-h">Assessments furthest behind</h2>
          <table className="story-table">
            <thead><tr><th scope="col">Town</th><th scope="col" className="num">Director&rsquo;s Ratio</th><th scope="col" className="num">Last revalued</th></tr></thead>
            <tbody>
              {overdue.slice(0, 20).map((t) => (
                <tr key={t.id}>
                  <th scope="row"><Link href={regionPath(t.id)}>{t.name}</Link> <small>{t.countyName}</small></th>
                  <td className="num">{t.values.nj_director_ratio!.toFixed(1)}%</td>
                  <td className="num">{t.values.nj_revaluation_year ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="story-note">{overdue.length} towns have a Director&rsquo;s Ratio under 85%; the 20 lowest are shown.</p>
        </div>
      </div>
    </StoryShell>
  );
}
