import type { Metadata } from "next";
import Link from "next/link";

import { StoryShell } from "@/components/StoryShell";
import { pageMetadata } from "@/lib/meta";
import { regionPath } from "@/lib/placeRoutes";
import { latestFor, storyCounties, storyTowns } from "@/lib/storyData";
import "../../horizon-theme.css";
import "../stories.css";

export const metadata: Metadata = pageMetadata({
  title: "Diner capital — Housing",
  description: "Where New Jersey's diners are, county by county and town by town, per resident.",
  path: "/stories/diner-capital",
});

/** Towns smaller than this are left off the per-resident list, where one diner would top it. */
const MIN_PEOPLE = 5_000;

export default async function DinerCapitalPage() {
  const counties = await storyCounties();
  const ids = [...counties.keys()];
  const [byCounty, towns] = await Promise.all([
    latestFor(["osm_diner_count", "osm_starbucks_count", "acs_population"], "county", ids),
    storyTowns(["osm_diner_count", "acs_population"]),
  ]);
  const rows = ids
    .map((id) => {
      const v = byCounty.get(id) ?? {};
      const people = v.acs_population ?? 0;
      return { id, name: counties.get(id)!, diners: v.osm_diner_count ?? 0, starbucks: v.osm_starbucks_count ?? 0, per: people ? ((v.osm_diner_count ?? 0) / people) * 100_000 : 0 };
    })
    .sort((a, b) => b.per - a.per);
  const total = rows.reduce((t, r) => t + r.diners, 0);
  const max = Math.max(...rows.map((r) => r.per));
  const townRows = towns
    .filter((t) => (t.values.acs_population ?? 0) >= MIN_PEOPLE && (t.values.osm_diner_count ?? 0) > 0)
    .map((t) => ({ t, per: (t.values.osm_diner_count! / t.values.acs_population!) * 10_000 }))
    .sort((a, b) => b.per - a.per)
    .slice(0, 15);
  const townMax = Math.max(...townRows.map((r) => r.per));
  const moreDiners = rows.filter((r) => r.diners > r.starbucks).length;
  return (
    <StoryShell
      title="Diner capital"
      lede={<>New Jersey calls itself the diner capital of the world. {total} diners are mapped across its 21 counties, and in {moreDiners} of them there are still more diners than Starbucks. For every 100,000 residents, {rows[0]?.name}, {rows[1]?.name} and {rows[2]?.name} have the most.</>}
      note={<>Diners: restaurants in OpenStreetMap tagged cuisine=diner or named one, © OpenStreetMap contributors, available under the Open Database License; the counts are offered under the same licence. Volunteer-mapped: a diner nobody tagged as one is missing, so every figure here is a floor. Residents: the Census Bureau&rsquo;s five-year American Community Survey. Towns under {MIN_PEOPLE.toLocaleString("en-US")} people are left off the town list.</>}
    >
      <div className="story-two">
        <div>
          <h2 className="story-h">Diners per 100,000 residents, by county</h2>
          <ul className="count-bars">
            {rows.map((r) => (
              <li key={r.id}>
                <span><Link href={regionPath(r.id)}>{r.name}</Link></span>
                <span className="bar-line"><i style={{ width: `${Math.round((r.per / max) * 1000) / 10}%`, background: "var(--story-2)" }} />{r.per.toFixed(1)}</span>
                <small>{r.diners} diners · {r.starbucks} Starbucks</small>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="story-h">The most diners per resident, by town</h2>
          <ul className="count-bars">
            {townRows.map((r) => (
              <li key={r.t.id}>
                <span><Link href={regionPath(r.t.id)}>{r.t.name}</Link></span>
                <span className="bar-line"><i style={{ width: `${Math.round((r.per / townMax) * 1000) / 10}%`, background: "var(--story-2)" }} />{r.per.toFixed(1)} per 10,000</span>
                <small>{r.t.values.osm_diner_count} diners · {Math.round(r.t.values.acs_population!).toLocaleString("en-US")} people · {r.t.countyName}</small>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </StoryShell>
  );
}
