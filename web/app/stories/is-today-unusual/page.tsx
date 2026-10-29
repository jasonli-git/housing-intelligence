import type { Metadata } from "next";
import Link from "next/link";

import { StoryShell } from "@/components/StoryShell";
import { api, artifactUrl, type Persistence } from "@/lib/api";
import { initialPlaceStory } from "@/lib/placeStoryData";
import { PlaceStoryFocus } from "@/components/PlaceStoryFocus";
import { pageMetadata } from "@/lib/meta";
import { againstUsual, placeAmongYears } from "@/lib/persistence";
import { regionPath } from "@/lib/placeRoutes";
import { storyCounties } from "@/lib/storyData";
import "../../horizon-theme.css";
import "../stories.css";

export const metadata: Metadata = pageMetadata({
  title: "Is today unusual here? — Housing",
  description: "Each New Jersey county's home prices against household incomes now, set against its own history.",
  path: "/stories/is-today-unusual",
});

const W = 240, H = 110, PAD = 6;

/** One county's years: above its own usual level shaded up, below shaded down, today a dot. */
function Panel({ p, first, last, span, annotate = false }: { p: Persistence; first: number; last: number; span: number; annotate?: boolean }) {
  const x = (yr: number) => Math.round((PAD + ((yr - first) / (last - first)) * (W - 2 * PAD)) * 10) / 10;
  const y = (v: number) => Math.round((H / 2 - (v / span) * (H / 2 - PAD)) * 10) / 10;
  const pts = p.series;
  const line = pts.map((s, i) => `${i ? "L" : "M"}${x(s.year)} ${y(s.vs_median)}`).join("");
  const area = `${line}L${x(pts.at(-1)!.year)} ${y(0)}L${x(pts[0].year)} ${y(0)}Z`;
  const now = pts.at(-1)!;
  return (
    <svg viewBox={`0 0 ${W} ${H + 14}`} aria-hidden="true">
      <defs>
        <clipPath id={`up-${p.region_id}`}><rect x={0} y={0} width={W} height={y(0)} /></clipPath>
        <clipPath id={`down-${p.region_id}`}><rect x={0} y={y(0)} width={W} height={H} /></clipPath>
      </defs>
      <path d={area} className="area-up" clipPath={`url(#up-${p.region_id})`} />
      <path d={area} className="area-down" clipPath={`url(#down-${p.region_id})`} />
      <line className="zero" x1={PAD} x2={W - PAD} y1={y(0)} y2={y(0)} />
      <path d={line} className="line" />
      <circle className="now" cx={x(now.year)} cy={y(now.vs_median)} r={3.5} />
      {annotate && (
        <>
          <text x={PAD + 2} y={y(0) - 4}>usual level</text>
          <text x={PAD + 2} y={PAD + 8}>dearer than usual ↑</text>
          <text x={PAD + 2} y={H - PAD}>cheaper than usual ↓</text>
          <text x={x(now.year) - 6} y={y(now.vs_median) - 6} textAnchor="end">today</text>
        </>
      )}
      <text x={PAD} y={H + 12}>{first}</text>
      <text x={W - PAD} y={H + 12} textAnchor="end">{last}</text>
    </svg>
  );
}

export default async function IsTodayUnusualPage() {
  const initial = await initialPlaceStory("past");
  const counties = await storyCounties();
  const read = await Promise.all([1, ...counties.keys()].map((id) => api.persistence(id)));
  const shown = read.filter((p): p is Persistence => !!p && p.vs_median !== null && p.series.length > 1);
  const state = shown.find((p) => p.region_id === 1);
  const rest = shown.filter((p) => p.region_id !== 1).sort((a, b) => b.vs_median! - a.vs_median!);
  const first = Math.min(...shown.map((p) => p.series[0].year)), last = Math.max(...shown.map((p) => p.series.at(-1)!.year));
  const span = Math.max(...shown.flatMap((p) => p.series.map((s) => Math.abs(s.vs_median)))) * 1.05;
  const name = (p: Persistence) => (p.region_id === 1 ? "New Jersey" : counties.get(p.region_id) ?? "");
  const highest = rest.filter((p) => p.rank_best === 1).map(name);
  return (
    <StoryShell
      title="Is today unusual here?"
      focus={<PlaceStoryFocus initial={initial} artifactUrl={artifactUrl} />}
      lede={<>Each panel is a county&rsquo;s home prices against its households&rsquo; incomes, year by year, measured against that county&rsquo;s own usual level, the dashed line. Above it, homes cost more of a year&rsquo;s income than usual. {highest.length ? <>{highest.length === 1 ? `${highest[0]} is` : `${highest.length} counties are`} at or near the highest in their record.</> : null}</>}
      note={<>Each year, FHFA&rsquo;s house price index for the county divided by the Census Bureau&rsquo;s estimate of its median household income, compared with the middle year of all its years. An index, not dollars: each panel compares a county with its own past only, so two panels say how unusual today is in each, not which county is dearer. The record starts in {first}; years with no income estimate are skipped. All panels share one scale, in percent from the usual level. Each county&rsquo;s page explains its history in words.</>}
    >
      <ul className="multiples">
        {[...(state ? [state] : []), ...rest].map((p) => (
          <li key={p.region_id} aria-label={`${name(p)}: ${againstUsual(p.vs_median!)} its usual level in ${p.last_year}${placeAmongYears(p) ? `, ${placeAmongYears(p)}` : ""}`}>
            <h3><Link href={regionPath(p.region_id)}>{name(p)}</Link><span>{againstUsual(p.vs_median!)}</span></h3>
            <Panel p={p} first={first} last={last} span={span} annotate={p.region_id === 1} />
          </li>
        ))}
      </ul>
    </StoryShell>
  );
}
