import type { Metadata } from "next";

import { StoryShell } from "@/components/StoryShell";
import { pageMetadata } from "@/lib/meta";
import { seriesFor, storyTownRegions } from "@/lib/storyData";
import { crossingYear, PRICE } from "@/lib/stories";
import "../../horizon-theme.css";
import "../stories.css";

export const metadata: Metadata = pageMetadata({
  title: "Your town's time machine — Housing",
  description: "The year each New Jersey town's typical home first passed $500,000 and $1 million.",
  path: "/stories/your-towns-time-machine",
});

const W = 880, L = 44, R = 110, DOT = 7;
const LINES = [
  { value: 500_000, label: "$500,000", slot: 1 },
  { value: 1_000_000, label: "$1 million", slot: 2 },
];

/** One line's towns as a stack of dots in the year each crossed, the not-yet towns counted at the end. */
function Panel({ towns, first, last, line }: { towns: { name: string; year: number | null }[]; first: number; last: number; line: (typeof LINES)[number] }) {
  const byYear = new Map<number, string[]>();
  for (const t of towns) if (t.year !== null) byYear.set(t.year, [...(byYear.get(t.year) ?? []), t.name]);
  const tallest = Math.max(1, ...[...byYear.values()].map((n) => n.length));
  const H = tallest * DOT + 50;
  const x = (yr: number) => Math.round(L + ((yr - first) / (last - first)) * (W - L - R));
  const notYet = towns.filter((t) => t.year === null).length;
  // The busiest year, named on the chart.
  const [peakYear, peakTowns] = [...byYear].sort((a, b) => b[1].length - a[1].length)[0] ?? [first, []];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Dot chart: each town in the year its typical home first passed ${line.label}. ${notYet} towns have not yet.`}>
      <g className="grid" aria-hidden="true">
        {Array.from({ length: last - first + 1 }, (_, i) => first + i).filter((yr) => yr % 5 === 0 || yr === first).map((yr) => <text key={yr} x={x(yr)} y={H - 8} textAnchor="middle">{yr === first ? `by ${yr}` : yr}</text>)}
        <line x1={L - 6} x2={W - R + 6} y1={H - 26} y2={H - 26} />
      </g>
      {[...byYear].map(([yr, names]) => names.map((n, i) => (
        <circle key={`${yr}-${n}`} cx={x(yr)} cy={H - 26 - DOT / 2 - i * DOT} r={DOT / 2 - 0.5} fill={`var(--story-${line.slot})`}><title>{`${n}: ${yr === first ? `already by ${yr}` : yr}`}</title></circle>
      )))}
      {/* Years no town crossed, named where they sit: the bust after 2006, for one. */}
      {(() => {
        const quiet: number[] = [];
        for (let yr = first + 1; yr < last; yr++) if (!byYear.has(yr)) quiet.push(yr);
        const runs: [number, number][] = [];
        for (const yr of quiet) { const r = runs.at(-1); if (r && r[1] === yr - 1) r[1] = yr; else runs.push([yr, yr]); }
        return runs.filter(([a, b]) => b - a >= 2).map(([a, b]) => (
          <text key={a} className="sub" x={(x(a) + x(b)) / 2} y={H - 34} textAnchor="middle">no town crossed {a}–{b}</text>
        ));
      })()}
      <text className="sub" x={x(peakYear)} y={H - 26 - peakTowns.length * DOT - 8} textAnchor="middle">{peakTowns.length} towns in {peakYear}</text>
      <g aria-hidden="true">
        <text className="label" x={W - R + 16} y={H - 46}>{notYet}</text>
        <text className="sub" x={W - R + 16} y={H - 30}>not yet</text>
      </g>
    </svg>
  );
}

export default async function TimeMachinePage() {
  const regions = await storyTownRegions();
  const series = await seriesFor(PRICE, regions.map((r) => r.region_id));
  const names = new Map(regions.map((r) => [r.region_id, r.name]));
  const all = [...series.entries()].filter(([, s]) => s.length);
  const first = Math.min(...all.map(([, s]) => s[0].year)), last = Math.max(...all.map(([, s]) => s.at(-1)!.year));
  const panels = LINES.map((line) => ({ line, towns: all.map(([id, s]) => ({ name: names.get(id) ?? "", year: crossingYear(s, line.value) })) }));
  return (
    <StoryShell
      title="Your town's time machine"
      lede={<>Each dot is a town, stacked over the year its typical home first passed a line. Hover a dot for its name. The first column holds towns already over the line when Zillow&rsquo;s record begins in {first}.</>}
      note={<>Zillow&rsquo;s typical home value, monthly from {first}, in the dollars of each month: not adjusted for inflation, which is part of the story. A town crosses in the first month its value reaches the line. {all.length} towns have a Zillow series.</>}
    >
      {panels.map((p) => (
        <figure key={p.line.value} className="story-figure" tabIndex={0}>
          <h2 className="story-h">The year it passed {p.line.label}</h2>
          <Panel towns={p.towns} first={first} last={last} line={p.line} />
        </figure>
      ))}
    </StoryShell>
  );
}
