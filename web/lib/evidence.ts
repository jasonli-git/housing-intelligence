/**
 * How strong the evidence behind an answer is (Milestone 49, ARCHITECTURE #329): *strong*,
 * *partial* or *limited*, set by fixed rules from the figures themselves and never by
 * judgement — promoted from the owner's Director Note of the roadmap review, 2026-10-07.
 *
 * A figure is **strong** when it is for this exact place, from the newest edition its
 * source has published, with a margin that is not wide and a sample above the floor. Any
 * one of these makes it **partial**:
 *
 * - its geography is estimated: a town's or ZIP's figure built from census tracts or
 *   blocks by their homes (`tract_homes`, `block_crosswalk`), or a county's figure
 *   standing in for a town's;
 * - it is behind its source's newest edition — this place's figure is older than what
 *   the source has published elsewhere, so its own sample fell short there;
 * - its survey margin is wide, half the estimate or more (a coefficient of variation
 *   above about 30%, the Census's own warning line), or the survey gave none;
 * - it rests on fewer than 50 recorded sales, the bar the site already sets for a
 *   twelve-month sales median.
 *
 * An answer is as strong as its weakest input, and **limited** when an input it needs
 * is missing altogether. Every rule that fired is listed with the label, so the label is
 * never a verdict the reader has to take on trust.
 */

export type Strength = "strong" | "partial" | "limited";

/** The fields of a published figure the rules read: a packet level has them all. */
export type Evidence = {
  metric_id: string;
  value: number;
  period_end: string;
  match_method: string | null;
  margin_of_error?: number | null;
  survey?: boolean;
  source_id?: string;
};

/** Built from a town's tracts or blocks by their homes, not measured for the town. */
export const ESTIMATED_MATCHES: ReadonlySet<string> = new Set(["tract_homes", "block_crosswalk"]);

/** A survey margin this share of the estimate or more is wide. */
export const WIDE_MARGIN = 0.5;

/** Fewer recorded sales than this and a sales figure is partial. */
export const THIN_SALES = 50;

export type Judged = { strength: Strength; reasons: string[] };

export type Context = {
  /** The newest period each metric has anywhere, from the catalog: `{ zhvi_sfr: "2026-08-31" }`. */
  newest?: Record<string, string | null | undefined>;
  /** Recorded sales behind this place's sales figures, where it has them. */
  sales?: number | null;
  /** True when a county's figure is used for a town. */
  standIn?: boolean;
};

const RANK: Record<Strength, number> = { strong: 0, partial: 1, limited: 2 };

/** The weaker of two strengths. */
export function weaker(a: Strength, b: Strength): Strength {
  return RANK[a] >= RANK[b] ? a : b;
}

function year(date: string): string {
  return date.slice(0, 4);
}

/** One figure, judged by the rules above. */
export function judge(figure: Evidence, context: Context = {}): Judged {
  const reasons: string[] = [];
  if (context.standIn) reasons.push("a county figure standing in for the town");
  else if (figure.match_method && ESTIMATED_MATCHES.has(figure.match_method)) {
    reasons.push("estimated for this place from its census areas");
  }
  const newest = context.newest?.[figure.metric_id];
  if (newest && figure.period_end < newest && year(figure.period_end) < year(newest)) {
    reasons.push(`from ${year(figure.period_end)}; the source has published ${year(newest)} elsewhere`);
  }
  if (figure.survey) {
    const margin = figure.margin_of_error;
    if (margin === null || margin === undefined) reasons.push("a survey estimate with no published margin");
    else if (figure.value !== 0 && Math.abs(margin / figure.value) >= WIDE_MARGIN) {
      reasons.push("a survey estimate with a wide margin");
    }
  }
  const sales = context.sales;
  const fromSales = figure.source_id === "nj_sr1a" || figure.metric_id.startsWith("sr1a_");
  if (fromSales && sales !== null && sales !== undefined && sales < THIN_SALES) {
    reasons.push(`fewer than ${THIN_SALES} recorded sales`);
  }
  return { strength: reasons.length ? "partial" : "strong", reasons };
}

/**
 * An answer from several figures: the weakest of them, and limited when one it needs is
 * missing. `needed` names each required input, null where the place has none.
 */
export function judgeAnswer(
  needed: { label: string; figure: Evidence | null; context?: Context }[],
): Judged {
  let strength: Strength = "strong";
  const reasons: string[] = [];
  for (const { label, figure, context } of needed) {
    if (!figure) {
      strength = "limited";
      reasons.push(`no ${label} figure for this place`);
      continue;
    }
    const judged = judge(figure, context);
    strength = weaker(strength, judged.strength);
    reasons.push(...judged.reasons.map((reason) => `${label}: ${reason}`));
  }
  return { strength, reasons };
}

export const STRENGTH_LABEL: Record<Strength, string> = {
  strong: "Strong evidence",
  partial: "Partial evidence",
  limited: "Limited evidence",
};
