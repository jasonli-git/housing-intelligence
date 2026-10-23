import type { Metadata } from "next";

import { StoryShell } from "@/components/StoryShell";
import { pageMetadata } from "@/lib/meta";
import { storyTowns } from "@/lib/storyData";
import "../../horizon-theme.css";
import "../stories.css";

export const metadata: Metadata = pageMetadata({
  title: "Boroughitis — Housing",
  description: "Why New Jersey has 564 towns: every municipality by the year it was incorporated, and the 1890s rush of new boroughs.",
  path: "/stories/boroughitis",
});

const W = 880, L = 30, R = 20, DOT = 6, FROM = 1660, TO = 1960;
const YEAR = "wikidata_incorporated_year";
/** A town's legal type is the last word of its Census name ("Haworth borough"). */
const TYPES = [
  { key: "borough", label: "Borough", slot: "s2" },
  { key: "township", label: "Township", slot: "s1" },
  { key: "city", label: "City", slot: "s3" },
  { key: "town", label: "Town or village", slot: "s4" },
] as const;
const kind = (name: string) => {
  const last = name.split(" ").at(-1) ?? "";
  return TYPES.find((t) => t.key === last)?.key ?? (last === "village" ? "town" : null);
};

export default async function BoroughitisPage() {
  const towns = (await storyTowns([YEAR])).filter((t) => t.values[YEAR] !== undefined);
  const x = (y: number) => L + ((Math.max(FROM, Math.min(TO, y)) - FROM) / (TO - FROM)) * (W - L - R);
  // A beeswarm: each town stacked over its year, alternating above and below the axis.
  const stacks = new Map<number, number>();
  const dots = [...towns].sort((a, b) => a.values[YEAR]! - b.values[YEAR]!).map((t) => {
    const y = Math.round(t.values[YEAR]!);
    const col = Math.round(x(y) / DOT);
    const n = stacks.get(col) ?? 0;
    stacks.set(col, n + 1);
    return { t, y, cx: col * DOT, k: kind(t.name), level: n % 2 ? -Math.ceil(n / 2) : Math.ceil(n / 2) };
  });
  const reach = Math.max(1, ...dots.map((d) => Math.abs(d.level)));
  const MID = reach * DOT + 24, H = MID * 2 + 30;
  const decade = (from: number) => dots.filter((d) => d.k === "borough" && d.y >= from && d.y < from + 10).length;
  const peak = new Map<number, number>();
  for (const d of dots) peak.set(d.y, (peak.get(d.y) ?? 0) + 1);
  const [busiestYear, busiestCount] = [...peak].sort((a, b) => b[1] - a[1])[0] ?? [1894, 0];
  const boroughs = towns.filter((t) => kind(t.name) === "borough").length;
  return (
    <StoryShell
      title="Boroughitis"
      lede={<>New Jersey has 564 municipalities, more for its size than almost any state, and most of the split happened in one burst. In the 1890s a law let any neighbourhood that wanted its own school district become a borough, and hundreds did: {decade(1890)} boroughs in that decade alone, {busiestCount} towns in {busiestYear}. Each dot is a town, at the year it was incorporated, coloured by what it became.</>}
      note={<>Incorporation dates: Wikidata&rsquo;s inception for each municipality (CC0), the date it was incorporated or set off from another, which for a colonial township can be the date it was first named. {564 - towns.length} towns have no date recorded and are not drawn; {boroughs} of the {towns.length} drawn are boroughs. Types are today&rsquo;s, from the Census Bureau&rsquo;s names, so a town that became a city later is drawn as a city. Years before {FROM} are gathered at the left edge.</>}
    >
      <figure className="story-figure" tabIndex={0}>
        <p className="ladder-key">{TYPES.map((t) => <span key={t.key}><i style={{ background: `var(--story-${t.slot.slice(1)})` }} />{t.label}</span>)}</p>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Beeswarm of ${towns.length} New Jersey towns by the year each was incorporated, coloured by type, with a dense cluster of boroughs in the 1890s.`}>
          <g className="grid" aria-hidden="true">
            {Array.from({ length: (TO - FROM) / 50 + 1 }, (_, i) => FROM + i * 50).map((y) => <g key={y}><line x1={x(y)} x2={x(y)} y1={12} y2={H - 24} /><text x={x(y)} y={H - 8} textAnchor="middle">{y}</text></g>)}
          </g>
          <rect x={x(1890)} y={12} width={x(1900) - x(1890)} height={H - 36} className="muted" fillOpacity={0.4} aria-hidden="true" />
          {dots.map((d) => (
            <circle key={d.t.id} cx={d.cx} cy={MID - d.level * DOT} r={DOT / 2 - 0.4} className={d.k ? TYPES.find((t) => t.key === d.k)!.slot : "muted"}>
              <title>{`${d.t.name}, ${d.t.countyName}: ${d.y}`}</title>
            </circle>
          ))}
          <text className="place" x={x(1895)} y={24} textAnchor="middle">The borough rush</text>
        </svg>
      </figure>
      <h2 className="story-h">Boroughs incorporated, by decade</h2>
      <ul className="count-bars">
        {[1860, 1870, 1880, 1890, 1900, 1910, 1920, 1930].map((d) => (
          <li key={d}><span>{d}s</span><span className="bar-line"><i style={{ width: `${Math.round((decade(d) / Math.max(1, decade(1890))) * 1000) / 10}%`, background: "var(--story-2)" }} />{decade(d)}</span></li>
        ))}
      </ul>
    </StoryShell>
  );
}
