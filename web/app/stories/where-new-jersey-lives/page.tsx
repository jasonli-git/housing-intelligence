import type { Metadata } from "next";

import Link from "next/link";

import { StoryShell } from "@/components/StoryShell";
import { api } from "@/lib/api";
import { pageMetadata } from "@/lib/meta";
import { regionPath } from "@/lib/placeRoutes";
import { storyCounties, storyPoints, storyTownRegions } from "@/lib/storyData";
import { ringsOf } from "@/lib/storyMap";
import "../../horizon-theme.css";
import "../stories.css";
import "./spikes.css";

export const metadata: Metadata = pageMetadata({
  title: "Where New Jersey lives — Housing",
  description: "New Jersey's 9.3 million people as spikes rising from the map: the height of each is how many people live on that patch of ground.",
  path: "/stories/where-new-jersey-lives",
});

type Cell = [number, number, number];
type Ring = [number, number][];
const W = 820, PAD = 16, TILT = 0.5, HMAX = 300, ROT = -45, SHOWN = 12, CELL_KM = 1.6;
/** Towns named on the 3D view, as the Census names them. */
const LABELS = ["Newark city", "Jersey City city", "Trenton city", "Camden city", "New Brunswick city", "Toms River township", "Atlantic City city"];
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

export default async function WhereNewJerseyLivesPage() {
  const [{ points }, counties, towns, countyGeo, townGeo] = await Promise.all([
    storyPoints("where-new-jersey-lives"), storyCounties(), storyTownRegions(), api.geo("county", "NJ", 0.003), api.geo("municipality", "NJ", 0.001),
  ]);
  const cells: Cell[] = points.filter((p) => p.series === "cells").map((p) => { const [lon, lat] = p.x.split(",").map(Number); return [lon, lat, p.y]; });
  const rings: Ring[] = (countyGeo?.features ?? []).flatMap((f) => ringsOf(f.geometry as Parameters<typeof ringsOf>[0]));
  if (!cells.length || !rings.length) {
    return <StoryShell title="Where New Jersey lives" lede="Where New Jersey's people live, square by square." note="Population: the U.S. Census Bureau's 2020 Census."><p className="story-note">This story is waiting for its data.</p></StoryShell>;
  }
  const land = new Map(points.filter((p) => p.series === "town_land").map((p) => [p.region_id, p.y]));
  const byId = new Map(towns.map((t) => [t.region_id, t]));
  const crowded = points.filter((p) => p.series === "town_people" && p.region_id !== null && (land.get(p.region_id) ?? 0) > 0 && byId.has(p.region_id))
    .map((p) => { const t = byId.get(p.region_id!)!; return { id: t.region_id, name: t.name_lsad ?? t.name, county: counties.get(t.parent_id ?? -1) ?? "", pop: p.y, perSqMi: p.y / land.get(p.region_id)! }; })
    .sort((a, b) => b.perSqMi - a.perSqMi);
  const total = cells.reduce((a, c) => a + c[2], 0);
  const landSqMi = [...land.values()].reduce((a, b) => a + b, 0);
  // A label sits at the mean of its town's outline points.
  const centres = new Map((townGeo?.features ?? []).map((f) => {
    const pts = ringsOf(f.geometry as Parameters<typeof ringsOf>[0]).flat();
    return [Number(f.properties?.region_id), [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length] as [number, number]];
  }));
  const named = LABELS.flatMap((label) => {
    const t = towns.find((r) => r.name_lsad === label), c = t && centres.get(t.region_id);
    return c ? [{ name: label.replace(/ (city|township)$/, ""), lon: c[0], lat: c[1] }] : [];
  });

  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const ring of rings) for (const [lon, lat] of ring) {
    minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon); minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
  }
  const k = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const scale = (W - 2 * PAD) / ((maxLon - minLon) * k);
  const cellPx = (CELL_KM / 111.32) * scale;
  const max = Math.max(...cells.map((c) => c[2]));

  // 3D: the ground turned so the camera looks from over the ocean, to the south-east, then tilted away from
  // the reader, spikes standing on it, drawn far to near so nearer spikes overlap farther ones.
  const turn = (ROT * Math.PI) / 180, cLon = (minLon + maxLon) / 2, cLat = (minLat + maxLat) / 2;
  const rotate = ([lon, lat]: [number, number]): [number, number] => {
    const gx = (lon - cLon) * k, gy = lat - cLat;
    return [gx * Math.cos(turn) - gy * Math.sin(turn), gx * Math.sin(turn) + gy * Math.cos(turn)];
  };
  const turned = rings.flat().map(rotate);
  const [minU, maxU] = [Math.min(...turned.map((p) => p[0])), Math.max(...turned.map((p) => p[0]))];
  const [minV, maxV] = [Math.min(...turned.map((p) => p[1])), Math.max(...turned.map((p) => p[1]))];
  const s3 = (W - 2 * PAD) / (maxU - minU);
  const tiltTop = HMAX + PAD;
  const tilted = (p: [number, number]): [number, number] => { const [u, v] = rotate(p); return [PAD + (u - minU) * s3, tiltTop + (maxV - v) * s3 * TILT]; };
  const tiltH = Math.round(tiltTop + (maxV - minV) * s3 * TILT + PAD);
  const depth = (c: Cell) => rotate([c[0], c[1]])[1];
  const outline = (rs: [number, number][][], project: (p: [number, number]) => [number, number]) =>
    rs.map((ring) => ring.map((p, i) => { const [x, y] = project(p); return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`; }).join("") + "Z").join("");
  const ground = (project: (p: [number, number]) => [number, number]) => outline(rings, project);
  const spikes = [...cells].filter((c) => c[2] >= 150).sort((a, b) => depth(b) - depth(a));
  const half = (CELL_KM / 111.32) * s3 * 0.32;
  const heightOf = (pop: number) => Math.max(0.6, (pop / max) * HMAX);
  // Each label stands just above the tallest spike within two squares of its town.
  const near = (lon: number, lat: number) => Math.max(0, ...cells.filter((c) => Math.abs(c[0] - lon) < 0.04 && Math.abs(c[1] - lat) < 0.03).map((c) => heightOf(c[2])));
  const labels = named.map((l) => { const [x, y] = tilted([l.lon, l.lat]); return { ...l, x, y, top: y - near(l.lon, l.lat) - 10 }; });
  const REF = 10_000, refH = heightOf(REF);
  // The frame starts just above the tallest spike or label, so no empty sky is drawn.
  const skyTop = Math.floor(Math.min(...spikes.map((c) => tilted([c[0], c[1]])[1] - heightOf(c[2])), ...labels.map((l) => l.top - 12)) - PAD);

  // Flat: the same cells from straight above, shaded in bands.
  const flat = ([lon, lat]: [number, number]): [number, number] => [PAD + (lon - minLon) * k * scale, PAD + (maxLat - lat) * scale];
  const flatH = Math.round(PAD * 2 + (maxLat - minLat) * scale);
  const BANDS = [{ to: 500, o: 0.08, label: "under 500" }, { to: 2_000, o: 0.25, label: "500–2,000" }, { to: 8_000, o: 0.5, label: "2,000–8,000" }, { to: 20_000, o: 0.78, label: "8,000–20,000" }, { to: Infinity, o: 1, label: "20,000+" }];

  // Half the people: the fewest cells that hold half the state, as a share of its land.
  const sorted = [...cells].sort((a, b) => b[2] - a[2]);
  let run = 0, n = 0;
  while (run < total / 2) run += sorted[n++][2];
  const cellSqMi = (CELL_KM * CELL_KM) / 2.589988;
  const halfShare = (n * cellSqMi) / landSqMi;
  const shown = crowded.slice(0, SHOWN);
  const top = shown[0]?.perSqMi ?? 1;
  const peak = sorted[0];

  return (
    <StoryShell
      title="Where New Jersey lives"
      takeaway={<><b>Half of New Jersey lives on {Math.round(halfShare * 100)}% of its land.</b> The tallest spike, in Union City and West New York, holds {fmt(peak[2])} people on one square of ground a mile across.</>}
      lede={<>New Jersey is the most crowded state in the country, but not evenly. Each spike stands on a square of ground about a mile across ({CELL_KM} km), and its height is how many people live there: {fmt(total)} in all, at the 2020 Census.</>}
      note={<>Population: the U.S. Census Bureau&rsquo;s 2020 Census, every block&rsquo;s count placed at its centre and summed into squares {CELL_KM} km a side, and each town&rsquo;s land summed from its blocks. A spike is people where they live, not where they work, so office districts look empty. Heights are to scale; the tilted view shortens distances running away from the reader, which the flat map does not.</>}
    >
      <div className="spike-switch">
        <div className="spike-views" role="radiogroup" aria-label="View">
          <input type="radio" name="spike-view" id="spike-3d" defaultChecked />
          <label htmlFor="spike-3d">3D</label>
          <input type="radio" name="spike-view" id="spike-flat" />
          <label htmlFor="spike-flat">Flat</label>
        </div>
        <figure className="story-figure spike-3d" tabIndex={0} data-share-chart>
          <svg viewBox={`0 ${skyTop} ${W} ${tiltH - skyTop}`} role="img" aria-label={`Spike map of New Jersey: a spike for each square of ground, as tall as its population. Hudson County's spikes rise far above the rest; the tallest holds ${fmt(peak[2])} people.`}>
            <path d={ground(tilted)} className="spike-ground" />
            <path d={ground(tilted)} className="spike-county" />
            {spikes.map(([lon, lat, pop]) => {
              const [x, y] = tilted([lon, lat]);
              const h = heightOf(pop);
              return <path key={`${lon},${lat}`} d={`M${(x - half).toFixed(1)} ${y.toFixed(1)}L${x.toFixed(1)} ${(y - h).toFixed(1)}L${(x + half).toFixed(1)} ${y.toFixed(1)}Z`} className="spike" fillOpacity={0.35 + 0.65 * Math.min(1, h / 60)}><title>{`${fmt(pop)} people`}</title></path>;
            })}
            {labels.map((l) => (
              <g key={l.name} className="spike-label">
                <line x1={l.x} x2={l.x} y1={l.y} y2={l.top + 4} />
                <text x={l.x} y={l.top}>{l.name}</text>
              </g>
            ))}
            <g className="spike-ref" transform={`translate(${PAD + 8} ${skyTop + PAD + refH + 8})`}>
              <path d={`M${-half} 0L0 ${-refH}L${half} 0Z`} className="spike" />
              <text x={half + 6} y={-refH / 2}>{fmt(REF)} people</text>
            </g>
          </svg>
          <p className="story-note">Each spike&rsquo;s height is the number of people living on its square. Seen from over the ocean, to the south-east, tilted.</p>
        </figure>
        <figure className="story-figure spike-flat" tabIndex={0}>
          <p className="ladder-key">{BANDS.map((b) => <span key={b.label}><i style={{ background: "var(--story-2)", opacity: b.o }} />{b.label}</span>)}</p>
          <svg viewBox={`0 0 ${W} ${flatH}`} className="map" role="img" aria-label="Flat map of New Jersey shaded by people on each square of ground, darkest in Hudson County.">
            <path d={ground(flat)} className="spike-ground" />
            {cells.map(([lon, lat, pop]) => {
              const [x, y] = flat([lon, lat]);
              const b = BANDS.find((band) => pop < band.to)!;
              return <rect key={`${lon},${lat}`} x={(x - cellPx / 2).toFixed(1)} y={(y - cellPx / 2).toFixed(1)} width={cellPx.toFixed(1)} height={cellPx.toFixed(1)} fill="var(--story-2)" fillOpacity={b.o}><title>{`${fmt(pop)} people`}</title></rect>;
            })}
            <path d={ground(flat)} className="spike-county" />
          </svg>
          <p className="story-note">People on each square, in bands, seen from straight above.</p>
        </figure>
      </div>
      <h2 className="story-h">The most crowded towns</h2>
      <ul className="count-bars">
        {shown.map((t) => (
          <li key={t.id}>
            <span><Link href={regionPath(t.id)}>{t.name}</Link><small> · {t.county}</small></span>
            <span className="bar-line"><i style={{ width: `${Math.round((t.perSqMi / top) * 1000) / 10}%`, background: "var(--story-2)" }} />{fmt(t.perSqMi)}</span>
            <small>{fmt(t.pop)} people</small>
          </li>
        ))}
      </ul>
      <p className="story-note">People per square mile of land, 2020 Census.</p>
    </StoryShell>
  );
}
