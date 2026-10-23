import type { Metadata } from "next";

import { StoryShell } from "@/components/StoryShell";
import { pageMetadata } from "@/lib/meta";
import { monthlySeriesFor, storyCounties } from "@/lib/storyData";
import "../../horizon-theme.css";
import "../stories.css";

export const metadata: Metadata = pageMetadata({
  title: "How long homes sit — Housing",
  description: "How many days a New Jersey listing waits for a buyer, every county, every month since 2016, as a horizon chart.",
  path: "/stories/how-long-homes-sit",
});

const DOM = "realtor_median_days_on_market";
const W = 880, L = 120, R = 16, ROW = 22, BAND = 15;

export default async function HowLongHomesSitPage() {
  const counties = await storyCounties();
  const series = await monthlySeriesFor(DOM, [...counties.keys()]);
  const months = [...new Set([...series.values()].flatMap((s) => s.map((o) => o.month)))].sort();
  const at = new Map(months.map((m, i) => [m, i]));
  // Each county against its own typical wait, so a slow rural county and a fast suburban
  // one both show when their market tightened.
  const rows = [...series].map(([id, s]) => {
    const sorted = [...s.map((o) => o.value)].sort((a, b) => a - b);
    const mid = sorted[Math.floor(sorted.length / 2)] ?? 0;
    return { id, name: counties.get(id) ?? "", s, mid, low: Math.min(...s.map((o) => o.value)) };
  }).sort((a, b) => a.mid - b.mid);
  const cw = (W - L - R) / Math.max(1, months.length);
  const H = 24 + rows.length * (ROW + 2) + 24;
  const fastest = rows[0], slowest = rows.at(-1);
  const lowMonth = (r: (typeof rows)[number]) => r.s.find((o) => o.value === r.low)?.month ?? "";
  // A horizon chart folds each row's line into bands of 15 days, darker the further it is
  // from the county's typical wait: blue slower than usual, orange faster.
  const bands = (v: number, mid: number) => {
    const d = v - mid, n = Math.min(3, Math.ceil(Math.abs(d) / BAND));
    return { slot: d >= 0 ? "s1" : "s2", n, rest: Math.abs(d) - (n - 1) * BAND };
  };
  return (
    <StoryShell
      title="How long homes sit"
      lede={<>Each strip is a county, each sliver a month since mid-2016, and the colour how long its listings waited against that county&rsquo;s own usual wait: blue slower than usual, orange faster, darker the further from it. Watch the whole state turn orange together in 2021, and stay orange since: homes that used to sit two months now sell in weeks. {fastest?.name}&rsquo;s homes sell fastest, a median {Math.round(fastest?.mid ?? 0)} days; {slowest?.name}&rsquo;s slowest, {Math.round(slowest?.mid ?? 0)}.</>}
      note={<>Realtor.com&rsquo;s median days on market, monthly, from list date to pending, sold or withdrawn, as FRED republishes it (copyright Realtor.com, which FRED marks &ldquo;citation required&rdquo;). Realtor.com changed its method in December 2021 and October 2022 and restated its history each time, so the series is consistent with itself. Each band is {BAND} days; three bands is 45 days or more from the county&rsquo;s usual wait.</>}
    >
      <figure className="story-figure" tabIndex={0}>
        <p className="ladder-key"><span><i style={{ background: "var(--story-1)" }} />Slower than the county&rsquo;s usual</span><span><i style={{ background: "var(--story-2)" }} />Faster</span></p>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Horizon chart of median days on market for each New Jersey county by month since 2016, each against its own usual wait; every county is fastest in 2021 and 2022.">
          <g className="grid" aria-hidden="true">
            {months.filter((m) => m.endsWith("-01")).map((m) => <text key={m} x={L + at.get(m)! * cw} y={14}>{m.slice(0, 4)}</text>)}
          </g>
          {rows.map((r, i) => {
            const y0 = 24 + i * (ROW + 2);
            return (
              <g key={r.id}>
                <text className="sub" x={L - 8} y={y0 + ROW - 6} textAnchor="end">{r.name}</text>
                <rect x={L} y={y0} width={months.length * cw} height={ROW} className="muted" fillOpacity={0.25} />
                {r.s.map((o) => {
                  const b = bands(o.value, r.mid);
                  if (!b.n) return null;
                  return (
                    <g key={o.month}>
                      {b.n > 1 ? <rect x={L + at.get(o.month)! * cw} y={y0} width={cw + 0.3} height={ROW} className={b.slot} fillOpacity={0.3 * (b.n - 1)} /> : null}
                      <rect x={L + at.get(o.month)! * cw} y={y0 + ROW - (b.rest / BAND) * ROW} width={cw + 0.3} height={(b.rest / BAND) * ROW} className={b.slot} fillOpacity={0.3 * b.n}>
                        <title>{`${r.name}, ${o.month}: ${Math.round(o.value)} days (usually ${Math.round(r.mid)})`}</title>
                      </rect>
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </figure>
      <p className="story-note">Fastest month on record: {rows.slice(0, 3).map((r) => `${r.name} ${Math.round(r.low)} days (${lowMonth(r)})`).join("; ")}.</p>
    </StoryShell>
  );
}
