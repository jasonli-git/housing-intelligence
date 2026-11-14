import { Briefing } from "@/components/Briefing";
import { njMedians, slidesFor } from "@/components/briefingSlides";
import { Crumbs } from "@/components/Crumbs";
import { Masthead } from "@/components/Masthead";
import { api } from "@/lib/api";
import { loadPlace } from "@/lib/loadPlace";
import { displayName } from "@/lib/names";
import { fullPath, regionPath } from "@/lib/placeRoutes";
import { stateCrumbs } from "@/lib/states";
import { projector, ringsOf, shapes } from "@/lib/storyMap";
import "../app/tool-pages.css";
import "../app/horizon-theme.css";
import "../app/guide/briefing.css";

/**
 * A New Jersey town's own page: its briefing (ARCHITECTURE #520), with the full page one
 * switch away at `/full`. Rendered into the static export like every page, so the slides'
 * text is in the HTML (#521).
 *
 * The title slide's picture is the state map the full page's hero used to carry: the
 * town's county shaded and the town marked. The full page keeps the animated garden motif.
 */
export async function PlaceBriefing({ regionId }: { regionId: number }) {
  const [catalog, countyGeo, townGeo, nj] = await Promise.all([api.metrics(), api.geo("county", "NJ", 0.002), api.geo("municipality", "NJ", 0.0005), njMedians()]);
  const newest = Object.fromEntries((catalog ?? []).map((m) => [m.metric_id, m.last_period]));
  const data = await loadPlace(regionId, newest);
  const region = await api.region(regionId);
  if (!data || !region) return <>
    <Masthead affordability={{ kind: "route" }} />
    <main id="main-content" tabIndex={-1} className="shell">
      <h1 className="page-title">Region not found</h1>
      <p className="meta">No briefing for region {regionId}, or the API is unreachable.</p>
    </main>
  </>;
  const county = region.ancestors.find((a) => a.level === "county") ?? null;
  const name = displayName(region);
  const frame = countyGeo ? projector(countyGeo.features.flatMap((f) => ringsOf(f.geometry)), 180, 4) : null;
  const counties = countyGeo && frame ? shapes(countyGeo.features, 180, frame).shapes : [];
  const feature = townGeo?.features.find((f) => f.properties.region_id === regionId);
  const town = feature && frame ? shapes([feature], 180, frame).shapes[0] : null;
  const art = frame && town ? <div className="bf-title-art" aria-hidden="true">
    <svg className="bf-title-map" viewBox={`0 0 ${frame.width} ${frame.height}`}>
      {counties.map((c, n) => <path key={`${c.id}-${n}`} d={c.d} fill="currentColor" fillOpacity={c.id === county?.region_id ? 0.5 : 0.16} />)}
      <circle cx={town.centre[0]} cy={town.centre[1]} r="7" fill="var(--bf)" stroke="var(--slide-paper)" strokeWidth="2.5" />
    </svg>
  </div> : null;
  const slides = slidesFor(data, nj, { art, builtAt: new Date(process.env.SITE_BUILT_AT ?? Date.now()) });
  return <>
    <Masthead affordability={{ kind: "route" }} />
    <main id="main-content" tabIndex={-1} className="shell horizon-page bf-page" data-kind="guide">
      <Crumbs trail={[{ href: "/", label: "Home" }, ...stateCrumbs(region.state_code), ...(county ? [{ href: regionPath(county.region_id), label: displayName(county) }] : [])]} here={name} />
      <h1 className="visually-hidden">{name} briefing</h1>
      <Briefing name={data.region.name} slides={slides} fullHref={fullPath(regionId)} />
    </main>
  </>;
}
