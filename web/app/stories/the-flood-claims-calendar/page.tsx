import type { Metadata } from "next";

import { StoryShell } from "@/components/StoryShell";
import { PlaceStoryFocus } from "@/components/PlaceStoryFocus";
import { initialPlaceStory } from "@/lib/placeStoryData";
import { artifactUrl } from "@/lib/api";
import { pageMetadata } from "@/lib/meta";
import { storyPoints } from "@/lib/storyData";
import "../../horizon-theme.css";
import "../stories.css";

export const metadata: Metadata = pageMetadata({
  title: "The flood claims calendar — Housing",
  description: "Every day since 1978 that New Jersey's insured homes flooded, as a calendar: the storms are the bright stripes.",
  path: "/stories/the-flood-claims-calendar",
});

const W = 880, L = 44, R = 96, ROW = 9, TOP = 22;
/** The storms a reader will know, named where they fall: the day FEMA dates most of their claims. */
const STORMS: Record<string, string> = {
  "1992-12-11": "December 1992 nor'easter",
  "1999-09-16": "Floyd",
  "2011-08-28": "Irene",
  "2012-10-29": "Sandy",
  "2021-09-01": "Ida",
};
const dayOfYear = (d: string) => {
  const t = Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
  return Math.floor((t - Date.UTC(+d.slice(0, 4), 0, 1)) / 86_400_000);
};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function FloodCalendarPage() {
  const initial=await initialPlaceStory("flood");
  const { points } = await storyPoints("flood-claims-calendar");
  const days = points.map((p) => ({ day: p.x, claims: p.y }));
  const years = [...new Set(days.map((d) => +d.day.slice(0, 4)))].sort((a, b) => a - b);
  const first = years[0] ?? 1978, last = years.at(-1) ?? 2026;
  const H = TOP + (last - first + 1) * ROW + 30;
  const cw = (W - L - R) / 366;
  const most = Math.max(1, ...days.map((d) => d.claims));
  // Brightness on a log scale: one claim is visible, Sandy's 61,812 is the ceiling.
  const shade = (n: number) => 0.1 + 0.9 * (Math.log10(n) / Math.log10(most)) ** 1.6;
  const perYear = new Map<number, number>();
  for (const d of days) perYear.set(+d.day.slice(0, 4), (perYear.get(+d.day.slice(0, 4)) ?? 0) + d.claims);
  const topYear = Math.max(1, ...perYear.values());
  const total = days.reduce((a, d) => a + d.claims, 0);
  const sandy = days.find((d) => d.day === "2012-10-29")?.claims ?? 0;
  const busiest = [...days].sort((a, b) => b.claims - a.claims).slice(0, 10);
  const share = busiest.reduce((a, d) => a + d.claims, 0) / (total || 1);
  return (
    <StoryShell
      focus={<PlaceStoryFocus initial={initial} artifactUrl={artifactUrl}/>}
      title="The flood claims calendar"
      lede={<>Every row is a year, every sliver a day, and its brightness the flood insurance claims New Jersey&rsquo;s homes made for it. Most of the calendar is dark. Then a storm draws a bright stripe: Sandy&rsquo;s {sandy.toLocaleString("en-US")} claims on 29 October 2012 are more than most whole years. Ten days hold {Math.round(share * 100)}% of the {total.toLocaleString("en-US")} claims paid since {first}.</>}
      note={<>FEMA&rsquo;s National Flood Insurance Program redacted claims (OpenFEMA), every claim with anything paid, dated by its day of loss; a storm&rsquo;s claims can spread over the days after it. Only insured homes claim, and fewer homes were insured in the 1970s and 1980s than since, so early years run darker than their floods were. OpenFEMA&rsquo;s terms forbid trying to identify claimants; nothing here is below a statewide count.</>}
    >
      <figure className="story-figure" tabIndex={0}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Calendar of flood insurance claims in New Jersey from ${first} to ${last}, one row per year and one column per day of the year; the brightest days are the named storms.`}>
          <g className="grid" aria-hidden="true">
            {MONTHS.map((m, i) => <text key={m} x={L + dayOfYear(`2001-${String(i + 1).padStart(2, "0")}-01`) * cw} y={14}>{m}</text>)}
            {years.filter((y) => y % 5 === 0).map((y) => <text key={y} x={L - 6} y={TOP + (y - first) * ROW + ROW - 1} textAnchor="end">{y}</text>)}
            <text x={W - R + 8} y={14}>Claims a year</text>
          </g>
          {Array.from({ length: last - first + 1 }, (_, i) => <rect key={i} x={L} y={TOP + i * ROW} width={366 * cw} height={ROW - 1} className="muted" fillOpacity={0.35} />)}
          {days.map((d) => (
            <rect key={d.day} x={L + dayOfYear(d.day) * cw} y={TOP + (+d.day.slice(0, 4) - first) * ROW} width={Math.max(cw, 1.4)} height={ROW - 1} className="s2" fillOpacity={shade(d.claims)}>
              <title>{`${d.day}: ${d.claims.toLocaleString("en-US")} claims`}</title>
            </rect>
          ))}
          {[...perYear].map(([y, n]) => (
            <rect key={y} x={W - R + 8} y={TOP + (y - first) * ROW} width={Math.max(1, (n / topYear) * (R - 16))} height={ROW - 1} className="s1"><title>{`${y}: ${n.toLocaleString("en-US")} claims`}</title></rect>
          ))}
          {Object.entries(STORMS).filter(([d]) => days.some((x) => x.day === d)).map(([d, name]) => {
            const x = L + dayOfYear(d) * cw, y = TOP + (+d.slice(0, 4) - first) * ROW + ROW / 2;
            const left = x > W / 2;
            return (
              <g key={d} aria-hidden="true">
                <line className="leader" x1={x} x2={left ? x - 24 : x + 24} y1={y} y2={y} />
                <text className="place" x={left ? x - 28 : x + 28} y={y + 4} textAnchor={left ? "end" : "start"}>{name}</text>
              </g>
            );
          })}
        </svg>
      </figure>
      <h2 className="story-h">The ten busiest days</h2>
      <ul className="count-bars">
        {busiest.map((d) => (
          <li key={d.day}>
            <span>{new Date(`${d.day}T12:00:00Z`).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}{STORMS[d.day] ? <small> · {STORMS[d.day]}</small> : null}</span>
            <span className="bar-line"><i className="s2" style={{ width: `${Math.round((d.claims / most) * 1000) / 10}%`, background: "var(--story-2)" }} />{d.claims.toLocaleString("en-US")}</span>
          </li>
        ))}
      </ul>
    </StoryShell>
  );
}
