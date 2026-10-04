/** Need, reported delivery and application routes are separate answers. */
export type HousingRecord = {
  source_id: string; kind: string; record_id: string; region_id: number; place: string;
  snapshot: string; release_id: number; fetched_at: string; source_url: string;
  payload: {
    name?: string; address?: string; city?: string; zip?: string; phone?: string;
    units?: number | null; low_income_units?: number | null; completed?: boolean | null;
    completed_for_summary?: boolean;
    completion_date?: string | null; earliest_controls_end?: string | null;
    bedrooms?: Record<string, number | null>; bedrooms_5plus?: number | null; senior_units?: number | null;
    special_needs_units?: number | null; placed_in_service?: number | null;
    present_need?: number | null; prospective_need?: number | null;
    reported?: boolean; balance?: number | null; table_as_of?: string; metadata_cutoff?: string;
    property_id?: string; status?: string; program?: string; contract_end?: string | null;
    targeted_seniors?: boolean; targeted_disability?: boolean;
    coverage_through?: number; service_year_status?: string;
    no_longer_monitored?: boolean | null; affordability_years?: number | null;
    resyndicated?: boolean | null;
    location_scope?: string;
  };
};
export type AffordableHousing = {
  region_id: number; level: string; records: HousingRecord[];
  county_inventory_region_id: number | null; limitations: string[];
  overview: boolean; stats: Record<string, number | null>;
};
export function reportedSum(rows: HousingRecord[], field: keyof HousingRecord["payload"]): number | null {
  const values = rows.map((r) => r.payload[field]).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  return values.length ? values.reduce((a, b) => a + b, 0) : null;
}
export function contractsFor(property: HousingRecord, records: HousingRecord[]) {
  return records.filter((r) => r.kind === "hud_contract" && r.payload.property_id === property.record_id);
}
export function soonAfterSnapshot(end: string | null | undefined, snapshot: string): boolean {
  if (!end) return false;
  const cutoff = `${Number(snapshot.slice(0, 4)) + 5}${snapshot.slice(4)}`;
  return end >= snapshot && end <= cutoff;
}
export function reportedEnds(row: HousingRecord, records: HousingRecord[]): string[] {
  return row.kind === "hud_property"
    ? contractsFor(row, records).flatMap((c) => c.payload.contract_end ? [c.payload.contract_end] : [])
    : row.payload.earliest_controls_end ? [row.payload.earliest_controls_end] : [];
}
export const APPLICATION_ROUTES = [
  {label: "Find listed affordable homes", agency: "NJ Housing Resource Center", url: "https://www.nj.gov/njhrc/", note: "Listings and application contacts; confirm availability with the administrator."},
  {label: "Check state voucher enrollment", agency: "NJ DCA", url: "https://www.nj.gov/dca/dhcr/offices/vouchers.shtml", note: "Check official openings, waiting lists and application instructions."},
  {label: "Find a housing authority", agency: "HUD’s New Jersey directory", url: "https://www.hud.gov/sites/dfiles/PIH/documents/PHA_Contact_Report_NJ.pdf", note: "Ask which areas it serves and whether its waiting list is open."},
] as const;

export function inventoryUrl(artifacts: string, api: string, id: number): string {
  const root = artifacts.replace(/\/$/, "");
  const suffix = root === api.replace(/\/$/, "") ? "" : ".json";
  return `${root}/regions/${id}/affordable-housing${suffix}`;
}
