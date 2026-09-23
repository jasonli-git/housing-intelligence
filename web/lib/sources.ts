/**
 * The site footer's arrangement of `GET /sources`, and the licence line's wording.
 *
 * Pure, so the grouping is tested rather than eyeballed: the footer is a licence
 * condition (ARCHITECTURE #71), and an institution silently dropped from it is a
 * licence problem, not a layout one.
 */

export type SourceLike = {
  source_id: string;
  name: string;
  publisher: string;
  license: string;
  homepage: string;
  cadence: string;
};

export type Institution<T extends SourceLike> = {
  publisher: string;
  /** The licence every source here shares, or null when they differ. */
  license: string | null;
  sources: T[];
};

/**
 * Sources grouped by publisher, in the order the registry first lists each one.
 *
 * A licence the whole group shares is hoisted to the group, which is where the footer
 * saves its room: most institutions publish everything under one term, and saying it
 * once per dataset was most of the old footer's height.
 */
export function byInstitution<T extends SourceLike>(sources: T[]): Institution<T>[] {
  const groups = new Map<string, T[]>();
  for (const source of sources) {
    groups.set(source.publisher, [...(groups.get(source.publisher) ?? []), source]);
  }
  return [...groups].map(([publisher, members]) => ({
    publisher,
    license: members.every((s) => s.license === members[0].license) ? members[0].license : null,
    sources: members,
  }));
}

/**
 * The name the closed footer gives an institution: the short form its data is known by.
 *
 * Presentation, like the section names in `groups.ts`: the registry's `publisher` is the
 * full name, which the open footer and every report still print, and the closed line has
 * to fit nine of them. A publisher missing here keeps its full name, so a new source is
 * only ever left long, never dropped or mislabelled.
 */
const SHORT_PUBLISHERS: Record<string, string> = {
  "U.S. Census Bureau": "Census Bureau",
  "U.S. Department of Housing and Urban Development": "HUD",
  "Federal Reserve Bank of St. Louis": "St. Louis Fed",
  "Federal Housing Finance Agency": "FHFA",
  "U.S. Bureau of Labor Statistics": "BLS",
  "New Jersey Division of Taxation": "NJ Division of Taxation",
  "NJ Office of Information Technology, Office of GIS (NJOGIS)": "NJOGIS",
  "Internal Revenue Service": "IRS",
};

export function shortPublisher(publisher: string): string {
  return SHORT_PUBLISHERS[publisher] ?? publisher;
}

/** Whether a source's terms forbid commercial use — the line a reader must not miss. */
export function isRestricted(source: { license: string }): boolean {
  return /non-commercial/i.test(source.license);
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/**
 * What follows "Not for commercial use:" at the top of every page, or null when no
 * source restricts it. Named from the sources, so a new restricted one is covered
 * without anyone editing a template.
 */
export function licenceLine(names: string[]): string | null {
  if (names.length === 0) return null;
  const pronoun = names.length === 1 ? "it" : "them";
  return `${joinNames(names)}, and every figure derived from ${pronoun}, reports included.`;
}
