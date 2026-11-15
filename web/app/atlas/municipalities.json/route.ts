import { api, regionsWithData } from "@/lib/api";
import { pack } from "@/lib/mapdata";
export const dynamic="force-static";
export async function GET() {
  // New Jersey's towns for the atlas (Director Note "Visualizing the data", 2026-10-22).
  const [geometry, regions]=await Promise.all([api.geo("municipality","NJ",.0005), regionsWithData()]);
  // MOCK (2026-11-15): a name several towns share carries its county, "Franklin township
  // (Somerset)", as the place search does (lib/search.ts `shownNames`).
  if (geometry) {
    const county=new Map(regions.filter(r=>r.level==="county").map(r=>[r.region_id,r.name.replace(/ County$/,"")]));
    const parent=new Map(regions.map(r=>[r.region_id,r.parent_id]));
    const label=(p: Record<string, unknown>)=>String(p.name_lsad ?? p.name);
    const count=new Map<string, number>();
    for (const f of geometry.features) count.set(label(f.properties),(count.get(label(f.properties))??0)+1);
    for (const f of geometry.features) {
      const where=county.get(parent.get(Number(f.properties.region_id)) ?? -1);
      if ((count.get(label(f.properties))??0)>1 && where) f.properties.name_lsad=`${label(f.properties)} (${where})`;
    }
  }
  return Response.json({outlines:geometry ? pack(geometry,"region_id") : []});
}
