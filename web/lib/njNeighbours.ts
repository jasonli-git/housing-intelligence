import land from "@/lib/nj-neighbours.json";
import { unpack, type PackedOutline } from "@/lib/mapdata";
import type { LonLat } from "@/lib/globe";

/**
 * The land round New Jersey, drawn faintly behind its towns so the state sits on water
 * among its neighbours rather than floating on blank paper (owner, 2026-11-09). The union
 * of the Census ZIP Code Tabulation Areas near the state, which follow the shore where
 * TIGER's state outlines run out into the bays; written by `scripts/atlas_neighbours.py`
 * from the landed TIGER Parquet, never fetched and never used as a data geography.
 */
export const NJ_NEIGHBOURS = unpack(land.outlines as PackedOutline[]);

/**
 * A few cities to find one's bearings by, labelled quietly over the map: the state's
 * largest and best-known, and the two neighbouring cities that shape it.
 */
export const ATLAS_CITIES: { name: string; at: LonLat; beyond?: boolean }[] = [
  { name: "Newark", at: [-74.172, 40.736] },
  { name: "Jersey City", at: [-74.063, 40.718] },
  { name: "Paterson", at: [-74.172, 40.917] },
  { name: "New Brunswick", at: [-74.452, 40.486] },
  { name: "Trenton", at: [-74.756, 40.217] },
  { name: "Camden", at: [-75.12, 39.926] },
  { name: "Toms River", at: [-74.198, 39.954] },
  { name: "Atlantic City", at: [-74.423, 39.364] },
  { name: "Cape May", at: [-74.906, 38.935] },
  { name: "New York", at: [-73.97, 40.76], beyond: true },
  { name: "Philadelphia", at: [-75.165, 39.953], beyond: true },
];
