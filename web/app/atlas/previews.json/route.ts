import { api } from "@/lib/api";
import { previewShades, type Preview, type PreviewFile } from "@/lib/atlasPreviews";
import { GROUPS } from "@/lib/groups";
export const dynamic="force-static";
/**
 * The atlas's layer tiles (`lib/atlasPreviews.ts`): every catalogued measure's shade for
 * each New Jersey town, worked out at build time so the browser fetches one small file
 * rather than every measure. A measure with no New Jersey figures is simply absent. Same geometry request as `municipalities.json`, for the order.
 */
export async function GET() {
  const [geometry,regions]=await Promise.all([api.geo("municipality","NJ",.0005),api.regions("level=municipality&state=NJ&limit=1000")]);
  // The outlines carry no county; the region list does, for measures shaded by county.
  const parentOf=new Map((regions?.items??[]).map(r=>[r.region_id,r.parent_id??undefined]));
  const towns=(geometry?.features??[]).map(f=>({id:Number(f.properties.region_id),parent:parentOf.get(Number(f.properties.region_id))}));
  const previews:Record<string,Preview>={};
  // The catalogue's groups, without the measures only the visual stories use.
  const metrics=[...new Set(GROUPS.filter(g=>g.key!=="stories").flatMap(g=>g.metrics))];
  await Promise.all(metrics.map(async metric=>{
    const read=async(level:"municipality"|"county")=>new Map(((await api.values(metric,level,1000))?.items??[]).filter(i=>Number.isFinite(i.value)).map(i=>[i.region_id,i.value] as const));
    const byTown=await read("municipality");
    if(byTown.size){previews[metric]={level:"municipality",shades:previewShades(towns,byTown,false)};return;}
    const byCounty=await read("county");
    if(byCounty.size)previews[metric]={level:"county",shades:previewShades(towns,byCounty,true)};
  }));
  return Response.json({towns:towns.map(t=>t.id),previews} satisfies PreviewFile);
}
