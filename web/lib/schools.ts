/**
 * Why a school district shows the results it does (#356). NJDOE publishes results only for
 * districts that run schools, and the state's boundary map can lag a merger, so a
 * district without results of its own is explained from NCES's directory rather than
 * left as a blank that could read as a low score.
 */

import type { CommunityRecord, DistrictStatus, SchoolPerformance } from "@/lib/api";

export type DistrictResults =
  | { kind: "own" }
  | { kind: "merged"; into: string; year: string }
  | { kind: "no_schools"; year: string }
  | { kind: "unexplained" };

export function districtResults(
  boundaryId: string,
  performance: CommunityRecord<SchoolPerformance> | null,
  status: CommunityRecord<DistrictStatus> | null | undefined,
): DistrictResults {
  const successor = status?.payload.successor;
  if (performance && performance.payload.district_id === boundaryId) return { kind: "own" };
  if (performance && successor && performance.payload.district_id === successor.district_id) {
    return { kind: "merged", into: successor.name, year: status!.payload.school_year };
  }
  if (status && status.payload.status !== "Closed" && status.payload.operational_schools === 0) {
    return { kind: "no_schools", year: status.payload.school_year };
  }
  return { kind: "unexplained" };
}

type District = {
  boundary: CommunityRecord<{ district_id: string; name: string; district_type: string }>;
  performance: CommunityRecord<SchoolPerformance> | null;
  status?: CommunityRecord<DistrictStatus> | null;
};

/**
 * The districts as a reader should see them: former districts that closed into the same
 * successor become one entry carrying the successor's results, so a town the old map
 * splits between a merged elementary and secondary district sees those results once.
 */
export function districtCards<T extends District>(districts: T[]): (T & { formerly: T["boundary"][] })[] {
  const cards: (T & { formerly: T["boundary"][] })[] = [];
  const merged = new Map<string, T & { formerly: T["boundary"][] }>();
  for (const d of districts) {
    const results = districtResults(d.boundary.payload.district_id, d.performance, d.status);
    if (results.kind !== "merged") {
      cards.push({ ...d, formerly: [] });
      continue;
    }
    const key = d.performance!.payload.district_id;
    const held = merged.get(key);
    if (held) {
      held.formerly.push(d.boundary);
    } else {
      const card = { ...d, formerly: [d.boundary] };
      merged.set(key, card);
      cards.push(card);
    }
  }
  return cards;
}

