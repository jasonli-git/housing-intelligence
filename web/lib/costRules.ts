/**
 * The published rules and stated rules of thumb the cost of owning is worked out with
 * (Milestone 33), each with where it comes from and when it was last checked.
 *
 * Kept apart from the arithmetic in `ownership.ts` so a rule that changes — HUD revises
 * FHA's premiums, New Jersey its transfer fees — is one edit here, and so the page can
 * cite each one beside the figure it produced. A rule is never a figure about this
 * place: it applies to every place alike, and the cards say so. `reviewed` is when the
 * rule was last read at its source; a reader can see how old the reading is.
 */

export type Rule = { label: string; source: string; url: string; reviewed: string };

/** FHA's premiums at 3.5% down (HUD Mortgagee Letter 2023-05, in force since 2023-03-20). */
export const FHA = {
  /** The upfront premium, a share of the base loan, financed into the loan as it usually is. */
  upfront: 0.0175,
  /**
   * The yearly premium for a loan over 15 years with more than 95% borrowed, which 3.5%
   * down always is: 0.55% up to the base loan threshold, 0.75% above it, for the life of
   * the loan.
   */
  annualAtOrBelow: 0.0055,
  annualAbove: 0.0075,
  /** The base loan amount above which the higher premium applies, as the letter sets it. */
  baseLoanThreshold: 726_200,
  rule: {
    label: "FHA mortgage insurance premiums",
    source: "HUD Mortgagee Letter 2023-05",
    url: "https://www.hud.gov/sites/dfiles/OCHCO/documents/2023-05hsgml.pdf",
    reviewed: "2026-10-01",
  } satisfies Rule,
} as const;

/**
 * HUD caps an FHA loan at a limit it sets county by county each year. The page does not
 * hold the limits, so where the card prices an FHA loan it says so and links HUD's lookup
 * rather than presenting a loan HUD may not insure.
 */
export const FHA_LIMITS: Rule = {
  label: "FHA loan limits by county",
  source: "HUD",
  url: "https://entp.hud.gov/idapp/html/hicostlook.cfm",
  reviewed: "2026-10-01",
};

/** The down payment that means an FHA loan rather than a conventional one. */
export const FHA_DOWN = 3.5;

/**
 * Conventional mortgage insurance, below 20% down: Freddie Mac's range of about $30 to
 * $70 a month for every $100,000 borrowed. It turns on credit score and down payment, so
 * the card shows the range and uses its middle until the reader enters a quote.
 */
export const PMI = {
  lowPerHundredK: 30,
  highPerHundredK: 70,
  rule: {
    label: "Typical private mortgage insurance",
    source: "Freddie Mac, “Breaking down PMI”",
    url: "https://myhome.freddiemac.com/buying/breaking-down-pmi",
    reviewed: "2026-10-01",
  } satisfies Rule,
} as const;

/** Closing costs: 2% to 5% of the price, the CFPB's range, not counting the down payment. */
export const CLOSING = {
  low: 0.02,
  high: 0.05,
  rule: {
    label: "Typical closing costs",
    source: "Consumer Financial Protection Bureau",
    url: "https://www.consumerfinance.gov/owning-a-home/prepare/determine-your-down-payment/",
    reviewed: "2026-10-01",
  } satisfies Rule,
} as const;

/**
 * Upkeep: 1% of the price a year, a rule of thumb rather than a measurement — no public
 * source gives what homes here cost to keep up. The reader can change it.
 */
export const UPKEEP_PCT = 1;
export const UPKEEP_RULE: Rule = {
  label: "Upkeep, a rule of thumb",
  source: "A common budgeting rule, not a measurement of homes here",
  url: "",
  reviewed: "2026-10-01",
};

/**
 * An agent's commission when selling, in the long view only: an assumption the reader
 * sets. Since the 2024 settlement of the National Association of Realtors' commission
 * cases, commissions are negotiated case by case and no public source reports them.
 */
export const COMMISSION_PCT = 5;

/**
 * New Jersey's realty transfer fee, paid by the seller: dollars per $500 of the price in
 * each band, on one schedule up to $350,000 and another above (N.J.S.A. 46:15-7).
 */
const RTF_UP_TO_350K: ReadonlyArray<readonly [number, number]> = [
  [150_000, 2.0],
  [200_000, 3.35],
  [350_000, 3.9],
];
const RTF_ABOVE_350K: ReadonlyArray<readonly [number, number]> = [
  [150_000, 2.9],
  [200_000, 4.25],
  [550_000, 4.8],
  [850_000, 5.3],
  [1_000_000, 5.8],
  [Infinity, 6.05],
];

/**
 * The graduated percent fee, the "mansion tax", on one- to four-family homes over $1
 * million: a share of the whole price, paid by the seller since 2025-07-10.
 */
const GRADUATED: ReadonlyArray<readonly [number, number]> = [
  [1_000_000, 0],
  [2_000_000, 0.01],
  [2_500_000, 0.02],
  [3_000_000, 0.025],
  [3_500_000, 0.03],
  [Infinity, 0.035],
];

export const NJ_TRANSFER_RULE: Rule = {
  label: "New Jersey realty transfer fee and graduated percent fee",
  source: "NJ Division of Taxation",
  url: "https://www.nj.gov/treasury/taxation/lpt/rtffaqs.shtml",
  reviewed: "2026-10-01",
};

/** What a seller pays New Jersey on a sale at `price`: the transfer fee and any graduated fee. */
export function njSellerFees(price: number): number {
  if (price <= 0) return 0;
  const schedule = price <= 350_000 ? RTF_UP_TO_350K : RTF_ABOVE_350K;
  let fee = 0;
  let floor = 0;
  for (const [ceiling, perFiveHundred] of schedule) {
    const inBand = Math.min(price, ceiling) - floor;
    if (inBand <= 0) break;
    fee += (inBand / 500) * perFiveHundred;
    floor = ceiling;
  }
  const graduated = GRADUATED.find(([ceiling]) => price <= ceiling)?.[1] ?? 0;
  return fee + price * graduated;
}

/** A New Jersey landlord may take at most a month and a half's rent as a deposit. */
export const DEPOSIT_MONTHS = 1.5;
export const DEPOSIT_RULE: Rule = {
  label: "New Jersey's cap on a security deposit",
  source: "N.J.S.A. 46:8-21.2",
  url: "https://www.nj.gov/dca/codes/publications/pdf_lti/secty_deposit_bulletin.pdf",
  reviewed: "2026-10-01",
};

/**
 * Property tax relief and help buying, as links and never as a subtraction: who
 * qualifies turns on a household's age, income and history, which the page cannot know.
 */
export const RELIEF: ReadonlyArray<Rule> = [
  {
    label: "ANCHOR property tax relief",
    source: "NJ Division of Taxation",
    url: "https://www.nj.gov/treasury/taxation/anchor/",
    reviewed: "2026-10-01",
  },
  {
    label: "Stay NJ and the Senior Freeze, for homeowners 65 and over",
    source: "NJ Division of Taxation",
    url: "https://www.nj.gov/treasury/taxation/staynj/",
    reviewed: "2026-10-01",
  },
  {
    label: "Help buying a first home",
    source: "NJ Housing and Mortgage Finance Agency",
    url: "https://www.nj.gov/dca/hmfa/homebuyers-and-renters/homebuyers/",
    reviewed: "2026-10-01",
  },
];

/** FEMA's flood map, for whether a home sits where lenders require flood insurance. */
export const FLOOD_MAP: Rule = {
  label: "FEMA flood map",
  source: "Federal Emergency Management Agency",
  url: "https://msc.fema.gov/portal/home",
  reviewed: "2026-10-01",
};
