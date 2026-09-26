import { api } from "@/lib/api";
import { PRECISION, pack, type MapFile } from "@/lib/mapdata";
import { WINDOWS } from "@/lib/windows";

/**
 * Everything the map draws, written to `map.json` at build beside the pages.
 *
 * One file rather than data in the page, for the reason `search.json` exists: a client
 * component's props ride in the flight payload, which is written four times per page,
 * and the three layers are about 48,000 coordinates (ARCHITECTURE #161, #143).
 *
 * The values are each measure's most recent reading, by region — a *value* ranking, not
 * a change ranking, because the map's height channel is a magnitude and its color
 * channel a ratio, and both are levels rather than movements. Change stays where it
 * already is, in the ranking beside the map.
 */
export const dynamic = "force-static";

export async function GET() {
  const [backdrop, counties, towns, wideTowns, catalog, townRegions] =
    await Promise.all([
      api.backdrop(),
      api.geo("county"),
      api.geo("municipality"),
      // The same towns at 0.001 degrees, for the whole-state view (`municipalityWide`).
      api.geo("municipality", 0.001),
      api.metrics(),
      // For the parent county alone: two Washington townships share a name *and* a legal
      // type, so only the county separates them, and `/geo` carries no parent (#70, #143).
      api.regions("level=municipality&state=NJ&limit=1000"),
    ]);

  const values: MapFile["values"] = {};
  const changes: MapFile["changes"] = {};
  // A survey measure's margins beside its figures (Milestone 28), to four significant
  // figures: the page prints fewer, and full precision would only add weight.
  const margins: NonNullable<MapFile["margins"]> = {};
  const changeMargins: NonNullable<MapFile["changeMargins"]> = {};
  const trim = (margin: number) => Number(margin.toPrecision(4));
  await Promise.all(
    (catalog ?? []).map(async (metric) => {
      const byRegion: Record<string, number> = {};
      const marginBy: Record<string, number> = {};
      await Promise.all(
        // Both levels into one table: the map switches between them as the reader zooms,
        // and region ids are unique across levels, so they cannot collide.
        ["county", "municipality"].map(async (level) => {
          // 1000 rather than a page: 564 municipalities have to arrive whole, or the
          // map would shade the first 25 and leave the state blank.
          const ranking = await api.values(metric.metric_id, level);
          for (const item of ranking?.items ?? []) {
            byRegion[item.region_id] = item.value;
            if (item.margin_of_error != null) marginBy[item.region_id] = trim(item.margin_of_error);
          }
        }),
      );
      if (Object.keys(byRegion).length > 0) values[metric.metric_id] = byRegion;
      if (Object.keys(marginBy).length > 0) margins[metric.metric_id] = marginBy;

      // And the movement over each window the page offers, which is what the map
      // colors by. Rounded to a tenth of a percent — the precision the page prints —
      // because at full precision these are four times the bytes.
      const byWindow: Record<string, Record<string, number>> = {};
      const marginsByWindow: Record<string, Record<string, number>> = {};
      await Promise.all(
        WINDOWS.map(async ({ key }) => {
          const overWindow: Record<string, number> = {};
          const marginOver: Record<string, number> = {};
          await Promise.all(
            ["county", "municipality"].map(async (level) => {
              const ranking = await api.rankings(
                metric.metric_id,
                level,
                key,
                1000,
              );
              for (const item of ranking?.items ?? []) {
                overWindow[item.region_id] = Math.round(item.value * 10) / 10;
                // Rounded as the change is: the page prints both to a tenth.
                if (item.margin_of_error != null)
                  marginOver[item.region_id] = Math.round(item.margin_of_error * 10) / 10;
              }
            }),
          );
          if (Object.keys(overWindow).length > 0) byWindow[key] = overWindow;
          if (Object.keys(marginOver).length > 0) marginsByWindow[key] = marginOver;
        }),
      );
      if (Object.keys(byWindow).length > 0)
        changes[metric.metric_id] = byWindow;
      if (Object.keys(marginsByWindow).length > 0)
        changeMargins[metric.metric_id] = marginsByWindow;
    }),
  );

  const countyName = new Map(
    (counties?.features ?? []).map((feature) => [
      feature.properties.region_id,
      feature.properties.name,
    ]),
  );
  const parentOf = new Map<number, number | null>(
    (townRegions?.items ?? []).map((region) => [
      region.region_id,
      region.parent_id,
    ]),
  );

  // Both town layers carry the same names, so they are labelled the same way.
  const named = (collection: typeof towns) =>
    (collection ? pack(collection, "region_id") : []).map((outline) => {
      const parent = parentOf.get(Number(outline.id));
      const county = typeof parent === "number" ? countyName.get(parent) : undefined;
      const label = outline.label ?? outline.name;
      return {
        ...outline,
        ...(typeof parent === "number" ? { parent } : {}),
        ...(county ? { label: `${label}, ${county}` } : {}),
      };
    });

  const file: MapFile = {
    precision: PRECISION,
    nation: { noun: "state", outlines: backdrop ? pack(backdrop, "code") : [] },
    county: {
      noun: "county",
      outlines: counties ? pack(counties, "region_id") : [],
    },
    municipality: { noun: "municipality", outlines: named(towns) },
    municipalityWide: { noun: "municipality", outlines: named(wideTowns) },
    values,
    changes,
    margins,
    changeMargins,
  };
  return Response.json(file);
}
