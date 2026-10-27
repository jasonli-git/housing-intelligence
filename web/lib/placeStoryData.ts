import { createHash } from "node:crypto";
import { api } from "./api";
import { makePlaceStoryRecord, storyHistoryMetrics, summarizePlaceStory, type PlaceStoryRecord, type PlaceStoryTopic } from "./placeStories";

export function stampPlaceStory(record: PlaceStoryRecord): PlaceStoryRecord {
  // Include derived wording too; bump the version when changing chart-only semantics.
  return { ...record, snapshot: createHash("sha256").update(JSON.stringify({ version: 1, record: { ...record, snapshot: "" }, summary: summarizePlaceStory(record) })).digest("hex").slice(0, 16) };
}
export async function initialPlaceStory(topic: PlaceStoryTopic): Promise<PlaceStoryRecord> {
  const id = 224; // Explicit local pilot, not a default for other readers' selections.
  const [region, packet, water, destinations, history, pressure, migration] = await Promise.all([
    api.region(id), api.packet(id, "5y"), topic === "water" ? api.waterSystems(id) : null,
    topic === "commute" ? api.workDestinations(id) : null,
    Promise.all(storyHistoryMetrics(topic).map(async metricId => ({ metricId, observations: (await api.observations(id, metricId))?.observations ?? [] }))),
    topic === "pressure" ? api.housingPressure(id) : null,
    topic === "migration" ? api.migration(id) : null,
  ]);
  if (!region || !packet) throw new Error("Princeton story pilot requires its published packet");
  const county = topic === "past" ? region.ancestors.find(a => a.level === "county") : undefined;
  const countyHistory = county ? { region_id: county.region_id, name: `${county.name.replace(/ County$/, "")} County`, data: await api.persistence(county.region_id) } : null;
  const place = { region_id: id, name: region.name, level: region.level, state_code: region.state_code, geoid: region.geoid, ...(county ? { county_id: county.region_id } : {}) };
  return stampPlaceStory(makePlaceStoryRecord(topic, place, packet.levels, { metrics: topic === "market" ? packet.metrics : [], history, water, destinations, pressure, migration, countyHistory }));
}
