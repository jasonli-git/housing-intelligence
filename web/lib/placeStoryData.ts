import { createHash } from "node:crypto";
import { api } from "./api";
import { makePlaceStoryRecord, storyHistoryMetrics, summarizePlaceStory, type PlaceStoryRecord, type PlaceStoryTopic } from "./placeStories";
import { loadFloodStory } from "./placeFloodStory";
import { displayName } from "./names";
import { coveredState } from "./states";

export function stampPlaceStory(record: PlaceStoryRecord): PlaceStoryRecord {
  // Include derived wording too; bump the version when changing chart-only semantics.
  return { ...record, snapshot: createHash("sha256").update(JSON.stringify({ version: 1, record: { ...record, snapshot: "" }, summary: summarizePlaceStory(record) })).digest("hex").slice(0, 16) };
}
export async function initialPlaceStory(topic: PlaceStoryTopic): Promise<PlaceStoryRecord> {
  const id = 224; // Explicit local pilot, not a default for other readers' selections.
  const [region, packet, water, destinations, history, pressure, migration, utilities, utilityInquiry, community] = await Promise.all([
    api.region(id), api.packet(id, "5y"), topic === "water" ? api.waterSystems(id) : null,
    topic === "commute" ? api.workDestinations(id) : null,
    Promise.all(storyHistoryMetrics(topic).map(async metricId => ({ metricId, observations: (await api.observations(id, metricId))?.observations ?? [] }))),
    topic === "pressure" ? api.housingPressure(id) : null,
    topic === "migration" ? api.migration(id) : null,
    topic === "utilities" ? api.utilities(id):null,
    topic === "utilities" ? api.freshness().then(f=>f?.sources.find(s=>s.source_id==="nj_bpu_reports")?.inquiries?.at(-1)??null):null,
    topic === "broadband" ? api.community(id):null,
  ]);
  if (!region || !packet) throw new Error("Princeton story pilot requires its published packet");
  const county = topic === "past" ? region.ancestors.find(a => a.level === "county") : undefined;
  const countyHistory = county ? { region_id: county.region_id, name: `${county.name.replace(/ County$/, "")} County`, data: await api.persistence(county.region_id) } : null;
  const floodCounty=region.ancestors.find(a=>a.level==="county");
  const flood=topic==="flood" ? await loadFloodStory(region,floodCounty?{region_id:floodCounty.region_id,name:displayName(floodCounty)}:null,region.ancestors.find(a=>a.level==="state")?.region_id??coveredState(region.state_code)?.regionId??null,async(id,metric)=>(await api.observations(id,metric))?.observations??[]):null;
  const place = { region_id: id, name: region.name, level: region.level, state_code: region.state_code, geoid: region.geoid, ...(county ? { county_id: county.region_id } : {}) };
  return stampPlaceStory(makePlaceStoryRecord(topic, place, packet.levels, { metrics: topic === "market" ? packet.metrics : [], history, water, destinations, pressure, migration, countyHistory, flood, utilities, utilityInquiry, community }));
}
