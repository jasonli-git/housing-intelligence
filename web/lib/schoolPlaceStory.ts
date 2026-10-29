import type { CommunityContext } from "./api";
import type { PlaceStoryRecord, PlaceStorySummary } from "./placeStories";
import { districtCards, districtResults } from "./schools";
import { marginLabel } from "./uncertainty";
import { surveyYears } from "./periods";

export const SCHOOL_SHARES = [
  ["acs_k8_private_share", "Kindergarten to grade 8"],
  ["acs_hs_private_share", "Grades 9 to 12"],
  ["acs_k12_private_share", "All grades, K–12"],
] as const;

/** The district names whose boundary covers the place, with merged districts named as
 *  the district they joined. Approximate boundaries, not school assignments. */
export function schoolDistrictNames(community: CommunityContext | null | undefined): string[] {
  return districtCards(community?.districts ?? []).map(d => {
    const r = districtResults(d.boundary.payload.district_id, d.performance, d.status);
    return r.kind === "merged" ? r.into : d.boundary.payload.name;
  });
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

export function schoolsStorySummary(record: PlaceStoryRecord): PlaceStorySummary {
  const missing: PlaceStorySummary = { available: false, headline: "School enrollment unavailable", period: "No matching survey", source: "Census ACS", qualifier: "No other place has been substituted. Missing is not zero.", rows: [] };
  const all = record.levels.find(l => l.metric_id === "acs_k12_private_share" && Number.isFinite(l.value) && l.value >= 0 && l.value <= 1);
  if (!all) return missing;
  const rows = SCHOOL_SHARES.flatMap(([id, label]) => {
    const l = record.levels.find(x => x.metric_id === id && x.period_start === all.period_start && x.period_end === all.period_end);
    return l && Number.isFinite(l.value) && l.value >= 0 && l.value <= 1
      ? [{ label: `${label} · private`, value: l.value, formatted: pct(l.value), margin: marginLabel(l.value, l.margin_of_error ?? null, l.unit, l.metric_id) ?? undefined }] : [];
  });
  const districts = schoolDistrictNames(record.community);
  return { available: true, headline: `${pct(all.value)} of K–12 students who live here attend a private school`, period: surveyYears(all.period_start, all.period_end), source: "Census ACS",
    qualifier: `Where students live, not where schools are. The rest attend public schools: ${districts.length ? `${districts.join(" and ")}, whose boundary covers this place,` : "the local district"} and also charter, county vocational and choice schools, which the survey counts as public. Margins shown are 90%.`,
    rows };
}
