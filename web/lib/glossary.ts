/**
 * The inline glossary: terms defined where they appear rather than on a page of their
 * own (Milestone 18).
 *
 * Kept to the words a reader meets on these pages and cannot be expected to know. The
 * metric labels were rewritten into plain English at Milestone 21, so what is left is
 * the vocabulary of the sources themselves — survey and program names, and HUD's
 * standards. Definitions are the reader's, not the pipeline's: what a figure measures,
 * not how it was loaded.
 */

export type Term = {
  key: string;
  title: string;
  definition: string;
  /** Exact, case-sensitive phrases that mark the term in running text. */
  phrases: string[];
};

export const TERMS: readonly Term[] = [
  {
    key: "acs",
    title: "ACS",
    phrases: ["ACS"],
    definition:
      "American Community Survey: the Census Bureau’s rolling survey. Figures here are " +
      "five-year estimates, so “2023” means the survey years 2019–2023, not a count taken " +
      "that year.",
  },
  {
    key: "chas",
    title: "CHAS",
    phrases: ["CHAS"],
    definition:
      "Comprehensive Housing Affordability Strategy: HUD’s special tabulation of ACS " +
      "microdata, counting households by the share of their income that goes on housing.",
  },
  {
    key: "fmr",
    title: "Fair Market Rent",
    phrases: ["Fair Market Rent"],
    definition:
      "HUD’s estimate of what a modest home rents for in an area, set near the 40th " +
      "percentile of recent movers’ rents. It sets Housing Choice Voucher payments.",
  },
  {
    key: "ami",
    title: "Area median income",
    phrases: ["Area median income", "area median income", "AMI"],
    definition:
      "HUD’s median family income for an area. HUD sets the income limits that decide " +
      "who qualifies for housing programs from it.",
  },
  {
    key: "zhvi",
    title: "Home value index",
    phrases: ["Home value index"],
    definition:
      "Zillow Home Value Index (ZHVI): Zillow’s estimate of the typical value of homes in " +
      "the middle third of the market, smoothed and seasonally adjusted.",
  },
  {
    key: "zori",
    title: "Observed rent index",
    phrases: ["Observed rent index"],
    definition:
      "Zillow Observed Rent Index (ZORI): the typical rent asked for homes listed for rent, " +
      "smoothed and seasonally adjusted.",
  },
  {
    key: "modiv",
    title: "MOD-IV",
    phrases: ["MOD-IV"],
    definition:
      "New Jersey’s property tax assessment records, kept by the Division of Taxation: a " +
      "record for every parcel, with its assessed value, property class and year built.",
  },
];

export type Segment = { text: string; term?: Term };

function escape(phrase: string): string {
  return phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const MATCHERS = TERMS.flatMap((term) =>
  term.phrases.map((phrase) => ({ term, pattern: new RegExp(`\\b${escape(phrase)}\\b`) })),
);

/**
 * `text` split at the terms in it, so a component can render each as a definition.
 *
 * `defined` carries the keys already defined on this page: a term is marked the first
 * time it appears and read as plain text after that, because an underline on every "ACS"
 * in a table is noise rather than help. Pass one set per page and let this fill it.
 */
export function withTerms(text: string, defined: Set<string> = new Set()): Segment[] {
  let earliest: { term: Term; index: number; length: number } | null = null;
  for (const { term, pattern } of MATCHERS) {
    if (defined.has(term.key)) continue;
    const match = pattern.exec(text);
    if (match && (earliest === null || match.index < earliest.index)) {
      earliest = { term, index: match.index, length: match[0].length };
    }
  }
  if (earliest === null) return text ? [{ text }] : [];

  defined.add(earliest.term.key);
  const before = text.slice(0, earliest.index);
  const matched = text.slice(earliest.index, earliest.index + earliest.length);
  const after = text.slice(earliest.index + earliest.length);
  return [
    ...(before ? [{ text: before }] : []),
    { text: matched, term: earliest.term },
    ...withTerms(after, defined),
  ];
}
