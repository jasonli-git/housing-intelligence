import type { Metadata } from "next";
import Link from "next/link";

import { StoryShell } from "@/components/StoryShell";
import { api } from "@/lib/api";
import { pageMetadata } from "@/lib/meta";
import { regionPath } from "@/lib/placeRoutes";
import { each, storyShapes, storyTownRegions } from "@/lib/storyData";
import { leadingDestination } from "@/lib/stories";
import "../../horizon-theme.css";
import "../stories.css";

export const metadata: Metadata = pageMetadata({
  title: "Where the workday goes — Housing",
  description: "Each New Jersey town's leading place of work outside itself: New York City, Philadelphia, or one of the state's job centres.",
  path: "/stories/where-the-workday-goes",
});

const MAP_W = 620;
const pct = (v: number) => `${Math.round(v * 100)}%`;

export default async function WhereTheWorkdayGoesPage() {
  const [towns, map] = await Promise.all([storyTownRegions(), storyShapes("municipality", MAP_W)]);
  const work = await each(towns, (t) => api.workDestinations(t.region_id));
  const centres = new Map(map.shapes.map((s) => [s.id, s.centre]));
  const names = new Map(towns.map((t) => [t.region_id, t.name]));
  const nyc = map.projector.point([-73.98, 40.72]), philadelphia = map.projector.point([-75.16, 39.95]);
  const leads = work.flatMap((w) => {
    const lead = w ? leadingDestination(w.destinations, w.region_id) : null;
    if (!w || !lead) return [];
    const kind = lead.name === "New York City" ? "s2" : lead.name === "Philadelphia" ? "s3" : lead.region_id ? "s1" : null;
    const to = lead.name === "New York City" ? nyc : lead.name === "Philadelphia" ? philadelphia : lead.region_id ? centres.get(lead.region_id) : undefined;
    const from = centres.get(w.region_id);
    return kind && to && from ? [{ id: w.region_id, kind, from, to, lead, year: w.year }] : [];
  });
  const byTown = new Map(leads.map((l) => [l.id, l]));
  // The places most towns send the largest share of their out-of-town workers to.
  const centresRanked = [...leads.reduce((m, l) => m.set(l.lead.name, [...(m.get(l.lead.name) ?? []), l]), new Map<string, typeof leads>())]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 12);
  const year = leads[0]?.year;
  return (
    <StoryShell
      title="Where the workday goes"
      lede="Each line runs from a town to the place more of its working residents travel to than any other outside the town itself. Orange lines run to New York City, green to Philadelphia, blue to a job centre in New Jersey."
      note={<>The Census Bureau&rsquo;s LEHD Origin-Destination Employment Statistics, {year}: where residents of each town hold their primary job. It counts jobs covered by unemployment insurance, so federal workers and the self-employed are missing, and a job&rsquo;s location is its employer&rsquo;s address, which for a company with many sites can be its head office. Line width follows the share of residents working there.</>}
    >
      <div className="story-two">
        <figure className="story-figure">
          <p className="ladder-key">
            <span><i style={{ background: "var(--story-2)" }} />New York City</span>
            <span><i style={{ background: "var(--story-3)" }} />Philadelphia</span>
            <span><i style={{ background: "var(--story-1)" }} />A New Jersey town</span>
          </p>
          <svg className="map" viewBox={`0 0 ${MAP_W} ${map.projector.height}`} role="img" aria-label="Map of New Jersey's towns, each joined by a line to its leading place of work. The leading destinations are listed beside it.">
            {map.shapes.map((s) => {
              const l = byTown.get(s.id);
              return <path key={s.id} d={s.d} className={`town ${l?.kind ?? "muted"}`} fillOpacity={0.35}><title>{l ? `${names.get(s.id)}: ${pct(l.lead.share)} work in ${l.lead.name}` : names.get(s.id)}</title></path>;
            })}
            {leads.map((l) => (
              <line key={l.id} x1={l.from[0]} y1={l.from[1]} x2={l.to[0]} y2={l.to[1]} className={`flow ${l.kind}`} strokeWidth={Math.max(0.6, l.lead.share * 8)} strokeOpacity={0.55} />
            ))}
            {centresRanked.filter(([, ls]) => ls[0].lead.region_id && ls.length >= 8).map(([name, ls]) => {
              const c = centres.get(ls[0].lead.region_id!);
              return c ? <text key={name} className="place" x={c[0] + 5} y={c[1] + 4}>{name.replace(/ township.*$/, "")}</text> : null;
            })}
            <text className="place" x={nyc[0] - 4} y={nyc[1] - 8} textAnchor="end">New York City</text>
            <text className="place" x={philadelphia[0] + 6} y={philadelphia[1] + 4}>Philadelphia</text>
          </svg>
          
        </figure>
        <div>
          <h2 className="story-h">The leading destinations</h2>
          <p className="story-note">Bar: how many towns send more workers here than anywhere else.</p>
          <ul className="count-bars">
            {centresRanked.map(([name, ls]) => {
              const most = [...ls].sort((a, b) => b.lead.share - a.lead.share)[0];
              const id = most.lead.region_id;
              return (
                <li key={name}>
                  <span>{id ? <Link href={regionPath(id)}>{name}</Link> : name}</span>
                  <span className="bar-line"><i className={most.kind} style={{ width: `${Math.round((ls.length / centresRanked[0][1].length) * 1000) / 10}%`, background: `var(--story-${most.kind.slice(1)})` }} />{ls.length}</span>
                  <small>most reliant: <Link href={regionPath(most.id)}>{names.get(most.id)}</Link> {pct(most.lead.share)}</small>
                </li>
              );
            })}
          </ul>
          <p className="story-note">{leads.length} towns have a leading destination outside themselves.</p>
        </div>
      </div>
    </StoryShell>
  );
}
