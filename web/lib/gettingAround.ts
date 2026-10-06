/**
 * Getting around (Milestone 45, ARCHITECTURE #313-#314): the rules the page's section
 * reads by, kept apart from the component so each is tested alone.
 *
 * - Where residents work is a share of their *jobs* in LODES, which leaves out the
 *   self-employed and counts a second job twice; the five places add to the whole.
 * - Nearness to transit is a share of 2020's homes within a straight-line walk of a
 *   stop. It is never called service: how often anything calls there is not in it.
 * - Commute time and mode are the ACS's (Milestone 34), shown beside them unchanged.
 */

import type { PacketLevel } from "@/lib/api";
import { shareText } from "@/lib/hazards";

export type WorkShare = { key: string; label: string; share: number };

export type WorkPicture = {
  jobs: number;
  /** The year LODES counted the jobs. */
  year: number;
  /** Where the jobs are, largest first; together they are every job. */
  shares: WorkShare[];
};

const value = (levels: PacketLevel[], id: string) =>
  levels.find((l) => l.metric_id === id)?.value ?? null;

/**
 * Where a place's residents work, as five or six shares that add to one. The home
 * county's share includes the town's own, so a town's is split into the two. Null where
 * LODES's shares are not published: residents holding under 100 jobs.
 */
export function workPicture(levels: PacketLevel[], level: string, name: string): WorkPicture | null {
  const jobsRow = levels.find((l) => l.metric_id === "lodes_resident_jobs");
  const county = value(levels, "lodes_work_home_county_share");
  if (!jobsRow || county === null) return null;
  const town = level === "municipality" ? value(levels, "lodes_work_same_town_share") : null;
  const rows: WorkShare[] = [
    ...(town !== null
      ? [
          { key: "town", label: `in ${name}`, share: town },
          { key: "county", label: "elsewhere in the county", share: Math.max(0, county - town) },
        ]
      : [{ key: "county", label: level === "county" ? "in the county" : "in their home county", share: county }]),
    { key: "nj", label: "elsewhere in New Jersey", share: value(levels, "lodes_work_other_nj_share") ?? 0 },
    { key: "nyc", label: "in New York City", share: value(levels, "lodes_work_nyc_share") ?? 0 },
    { key: "pa", label: "in Pennsylvania", share: value(levels, "lodes_work_pennsylvania_share") ?? 0 },
    { key: "other", label: "in other states", share: value(levels, "lodes_work_other_state_share") ?? 0 },
  ];
  return {
    jobs: jobsRow.value,
    year: Number(jobsRow.period_end.slice(0, 4)),
    shares: rows.filter((r) => r.share > 0).sort((a, b) => b.share - a.share),
  };
}

export type TransitPicture = { rail: number | null; bus: number | null; any: number | null };

export function transitPicture(levels: PacketLevel[]): TransitPicture | null {
  const picture = {
    rail: value(levels, "transit_rail_homes_share"),
    bus: value(levels, "transit_bus_homes_share"),
    any: value(levels, "transit_any_homes_share"),
  };
  return picture.rail === null && picture.bus === null ? null : picture;
}

export type CommutePicture = {
  minutes: number | null;
  hourPlus: number | null;
  droveAlone: number | null;
  transit: number | null;
  walked: number | null;
  fromHome: number | null;
};

export function commutePicture(levels: PacketLevel[]): CommutePicture | null {
  const picture = {
    minutes: value(levels, "acs_mean_commute_minutes"),
    hourPlus: value(levels, "acs_commute_60plus_share"),
    droveAlone: value(levels, "acs_commute_drove_alone_share"),
    transit: value(levels, "acs_commute_transit_share"),
    walked: value(levels, "acs_commute_walked_share"),
    fromHome: value(levels, "acs_work_from_home_share"),
  };
  return Object.values(picture).every((v) => v === null) ? null : picture;
}

/** "75% of homes", "none of the homes": a share of homes as a sentence's subject. */
export function ofHomes(share: number): string {
  return share === 0 ? "none of the homes" : `${shareText(share)} of homes`;
}

/** A sentence's first letter in capitals, for one that opens on a share ("none drive"). */
export function sentence(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
