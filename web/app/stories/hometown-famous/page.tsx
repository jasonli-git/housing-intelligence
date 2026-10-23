import type { Metadata } from "next";
import Link from "next/link";

import { StoryShell } from "@/components/StoryShell";
import { pageMetadata } from "@/lib/meta";
import { regionPath } from "@/lib/placeRoutes";
import { storyPoints, storyTowns } from "@/lib/storyData";
import "../../horizon-theme.css";
import "../stories.css";

export const metadata: Metadata = pageMetadata({
  title: "Hometown famous — Housing",
  description: "Which New Jersey towns have produced the most notable people for their size, and the best-known person born in each.",
  path: "/stories/hometown-famous",
});

const BIRTHS = "wikidata_notable_births", POP = "acs_population";
const SHOWN = 30, MIN_POP = 5000;

export default async function HometownFamousPage() {
  const [towns, { points }] = await Promise.all([storyTowns([BIRTHS, POP]), storyPoints("hometown-famous")]);
  const famous = new Map(points.map((p) => [p.region_id, p]));
  const rated = towns
    .filter((t) => (t.values[POP] ?? 0) >= MIN_POP && t.values[BIRTHS] !== undefined)
    .map((t) => ({ t, per: (t.values[BIRTHS]! / t.values[POP]!) * 10_000, who: famous.get(t.id) }))
    .sort((a, b) => b.per - a.per);
  const top = rated.slice(0, SHOWN);
  const most = Math.max(1, ...top.map((r) => r.per));
  const stars = [...points].sort((a, b) => b.y - a.y).slice(0, 8);
  const byId = new Map(towns.map((t) => [t.id, t]));
  const total = towns.reduce((a, t) => a + (t.values[BIRTHS] ?? 0), 0);
  return (
    <StoryShell
      title="Hometown famous"
      lede={<>{total.toLocaleString("en-US")} people notable enough for Wikidata were born in a New Jersey town. For its size, which town has produced the most? Each bar is a town&rsquo;s notable births per 10,000 of today&rsquo;s residents, beside the best-known person born there, by how many of Wikipedia&rsquo;s languages carry an article on them.</>}
      note={<>Births: Wikidata (CC0), every person recorded as born in the municipality; towns of {MIN_POP.toLocaleString("en-US")} people or more. Notable means notable to Wikidata&rsquo;s editors, who record athletes, politicians and performers more fully than others and the twentieth century more fully than the eighteenth; a hospital town gathers births from its whole area. Today&rsquo;s population, from the Census Bureau&rsquo;s American Community Survey, divides people born over two centuries, so an old town with few residents now scores high.</>}
    >
      <figure className="story-figure" tabIndex={0}>
        <ul className="count-bars famous">
          {top.map((r) => (
            <li key={r.t.id}>
              <span><Link href={regionPath(r.t.id)}>{r.t.name}</Link><small> · {r.t.countyName}</small></span>
              <span className="bar-line"><i style={{ width: `${Math.round((r.per / most) * 1000) / 10}%`, background: "var(--story-2)" }} />{r.per.toFixed(1)}</span>
              <small>{r.who?.label ?? ""}</small>
            </li>
          ))}
        </ul>
      </figure>
      <h2 className="story-h">The best known of all</h2>
      <ul className="stories-grid famous-grid">
        {stars.map((p) => {
          const t = p.region_id ? byId.get(p.region_id) : undefined;
          return <li key={p.region_id}><div><b>{p.label}</b><span>Born in {t ? <Link href={regionPath(t.id)}>{t.name}</Link> : "New Jersey"} · {p.y} Wikipedia languages</span></div></li>;
        })}
      </ul>
    </StoryShell>
  );
}
