import type { Observation } from "./api";
import { hasUnplaced, ownClaimsUsable } from "./hazards";

export type FloodStoryData = { region_id: number; claims: Observation[]; paid: Observation[]; unplaced: Observation[]; newest: number | null; place: string | null; unseparable: boolean; estimated: boolean };
type Reader = (id: number, metric: string) => Promise<Observation[]>;
/** Same county fallback and newest-dataset-year rules used on the original place page. */
export async function loadFloodStory(place: { region_id: number; level: string }, county: { region_id: number; name: string } | null, stateId: number | null, read: Reader): Promise<FloodStoryData> {
  const [[claims, paid, unplaced], state] = await Promise.all([
    Promise.all(["fema_flood_claims", "fema_flood_claims_paid", "fema_flood_claims_unplaced"].map(m => read(place.region_id, m))),
    stateId === null ? [] : read(stateId, "fema_flood_claims"),
  ]);
  const newest = state.length ? Math.max(...state.map(o => Number(o.period_end.slice(0,4)))) : null;
  if (place.level === "municipality" && county && !ownClaimsUsable(claims, unplaced)) {
    const [countyClaims, countyPaid] = await Promise.all([read(county.region_id,"fema_flood_claims"),read(county.region_id,"fema_flood_claims_paid")]);
    return { region_id:place.region_id, claims:countyClaims, paid:countyPaid, unplaced:[], newest, place:county.name, unseparable:hasUnplaced(unplaced), estimated:false };
  }
  return { region_id:place.region_id, claims, paid, unplaced:place.level === "municipality" ? unplaced : [], newest, place:null, unseparable:false, estimated:place.level === "municipality" };
}
