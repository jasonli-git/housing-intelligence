import type { Metadata } from "next";

import { StoryShell } from "@/components/StoryShell";
import { pageMetadata } from "@/lib/meta";
import { storyShapes, storyTowns } from "@/lib/storyData";
import "../../horizon-theme.css";
import "../stories.css";

export const metadata: Metadata = pageMetadata({
  title: "The pizza–bagel line — Housing",
  description: "How far from New York the bagel shop reaches: every New Jersey town's bagel shops against its pizzerias.",
  path: "/stories/the-pizza-bagel-line",
});

const MAP_W = 560, BANDS = 8;
const BAGEL = "osm_bagel_count", PIZZA = "osm_pizza_count";

export default async function PizzaBagelPage() {
  const [towns, map] = await Promise.all([storyTowns([BAGEL, PIZZA]), storyShapes("municipality", MAP_W)]);
  const byId = new Map(towns.map((t) => [t.id, t]));
  const centres = new Map(map.shapes.map((s) => [s.id, s.centre]));
  const height = map.projector.height;
  const bands = Array.from({ length: BANDS }, (_, i) => ({ i, bagel: 0, pizza: 0, counties: new Map<string, number>() }));
  for (const t of towns) {
    const c = centres.get(t.id);
    if (!c) continue;
    const b = bands[Math.min(BANDS - 1, Math.floor((c[1] / height) * BANDS))];
    b.bagel += t.values[BAGEL] ?? 0;
    b.pizza += t.values[PIZZA] ?? 0;
    b.counties.set(t.countyName, (b.counties.get(t.countyName) ?? 0) + 1);
  }
  // A band is named by the two counties most of its towns are in.
  const bandName = (b: (typeof bands)[number]) => [...b.counties].sort((x, y) => y[1] - x[1]).slice(0, 2).map(([c]) => c).join(" · ");
  const share = (t: (typeof towns)[number]) => {
    const g = t.values[BAGEL] ?? 0, p = t.values[PIZZA] ?? 0;
    return g + p >= 2 ? g / (g + p) : null;
  };
  const total = { bagel: bands.reduce((a, b) => a + b.bagel, 0), pizza: bands.reduce((a, b) => a + b.pizza, 0) };
  const north = bands.slice(0, 3), south = bands.slice(-3);
  const ratio = (bs: typeof bands) => bs.reduce((a, b) => a + b.pizza, 0) / Math.max(1, bs.reduce((a, b) => a + b.bagel, 0));
  return (
    <StoryShell
      title="The pizza–bagel line"
      lede={<>Pizza is everywhere in New Jersey: {total.pizza.toLocaleString("en-US")} pizzerias against {total.bagel.toLocaleString("en-US")} bagel shops. But the bagel shop is a New York habit, and it thins out with distance from the city. In the northern bands of the map there is a bagel shop for every {ratio(north).toFixed(1)} pizzerias; in the south, one for every {ratio(south).toFixed(1)}. Darker towns lean bagel.</>}
      note={<>OpenStreetMap, © OpenStreetMap contributors, available under the Open Database License; the counts here are offered under the same licence. A bagel shop is a place tagged with the cuisine or named for bagels; a pizzeria the same for pizza, and a shop that is both counts as a bagel shop. Towns with fewer than two of either are drawn grey. Volunteer-mapped, so a place nobody added is missing, more often in rural towns.</>}
    >
      <div className="story-two">
        <figure className="story-figure" tabIndex={0}>
          <p className="ladder-key"><span><i style={{ background: "var(--story-2)" }} />Mostly bagels</span><span><i style={{ background: "var(--story-2)", opacity: 0.25 }} />Mostly pizza</span><span><i className="typical" style={{ opacity: 0.2 }} />Too few to say</span></p>
          <svg className="map" viewBox={`0 0 ${MAP_W} ${height}`} role="img" aria-label="Map of New Jersey's towns shaded by bagel shops' share of bagel shops and pizzerias, darker in the north near New York.">
            {map.shapes.map((s) => {
              const t = byId.get(s.id), sh = t ? share(t) : null;
              return <path key={s.id} d={s.d} className={`town ${sh === null ? "muted" : "s2"}`} fillOpacity={sh === null ? 1 : 0.12 + sh * 1.6}><title>{t ? `${t.name}: ${t.values[BAGEL] ?? 0} bagel, ${t.values[PIZZA] ?? 0} pizza` : s.name}</title></path>;
            })}
          </svg>
        </figure>
        <div>
          <h2 className="story-h">Pizzerias for each bagel shop, north to south</h2>
          <p className="story-note">Each bar is a band across the map, at the height of the band beside it.</p>
          <ul className="count-bars">
            {bands.filter((b) => b.bagel + b.pizza > 0).map((b) => {
              const r = b.pizza / Math.max(1, b.bagel);
              return (
                <li key={b.i}>
                  <span>{bandName(b)}<small> {b.i === 0 ? "· north" : b.i === BANDS - 1 ? "· south" : ""}</small></span>
                  <span className="bar-line"><i style={{ width: `${Math.min(100, (r / 12) * 100)}%`, background: "var(--story-1)" }} />{b.bagel ? r.toFixed(1) : "no bagels"}</span>
                  <small>{b.bagel} bagel · {b.pizza} pizza</small>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </StoryShell>
  );
}
