/**
 * The states the site publishes in full, and where each one's own page is (2026-10-21,
 * ARCHITECTURE #407). The one list every page and tool reads to say what is covered,
 * which tools enumerate, and where a place's state links, so adding a state is an entry
 * here rather than a search for "New Jersey". A state's name alone (`stateName`) is
 * vocabulary, never a claim of coverage.
 */
export type CoveredState = {
  code: string;
  name: string;
  path: string;
  regionId: number;
  /** Where the home map's pointer to the state sits, [longitude, latitude]. */
  locator: readonly [number, number];
};

export const COVERED_STATES: ReadonlyArray<CoveredState> = [
  { code: "NJ", name: "New Jersey", path: "/states/new-jersey", regionId: 1, locator: [-74.5, 40] },
];

/** The state the home map points to and flies into. With several covered, the first:
 * a home map for several states is a design of its own, not yet made. */
export const PRIMARY_STATE: CoveredState = COVERED_STATES[0];

/** The covered states' names as a reader lists them: "A", "A and B", "A, B and C". */
export function coveredNames(): string {
  const names = COVERED_STATES.map((state) => state.name);
  return names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/** The covered state with this postal code, or null. */
export function coveredState(code: string | null | undefined): CoveredState | null {
  const upper = code?.toUpperCase();
  return COVERED_STATES.find((state) => state.code === upper) ?? null;
}

/** The crumb for a place's state: its own page where the state is covered, else none. */
export function stateCrumbs(code: string | null | undefined): { href: string; label: string }[] {
  const state = coveredState(code);
  return state ? [{ href: state.path, label: state.name }] : [];
}
