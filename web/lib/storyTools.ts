/**
 * The tool behind a story's chart (#492; Director Note "Product shape", point 1): a story
 * shows every town at once, and the tool answers the same question for the reader's own
 * place or household. Only stories with a tool that really does that are listed.
 */
export type StoryTool = { href: string; label: string };

const TAX: StoryTool = { href: "/tax", label: "Look up a property’s tax bill" };
const BUDGET: StoryTool = { href: "/atlas?level=municipality&measure=sr1a_median_sale_price&view=latest&budget=1", label: "See the towns within your budget" };
const GUIDE: StoryTool = { href: "/guide/numbers", label: "Work out the cost of buying with your own numbers" };
const CHECKS: StoryTool = { href: "/guide", label: "Get briefed on a town before an offer" };
const COMPARE: StoryTool = { href: "/compare", label: "Compare towns side by side" };
const MAP: StoryTool = { href: "/atlas", label: "Explore every town on the map" };
const HELP: StoryTool = { href: "/help", label: "Find housing help" };

export const STORY_TOOLS: Record<string, StoryTool> = {
  "same-house-different-tax-bill": TAX,
  "the-true-monthly-cost": GUIDE,
  "the-mortgage-market": GUIDE,
  "income-and-home-value": BUDGET,
  "price-ladder": BUDGET,
  "priciest-and-cheapest": BUDGET,
  "who-feels-housing-costs": HELP,
  "pricier-towns": COMPARE,
  "the-long-commute-premium": COMPARE,
  "water-you-can-check": CHECKS,
  "sites-and-cleanup": CHECKS,
  "the-flood-claims-calendar": CHECKS,
  "the-leafy-premium": MAP,
  "what-quiet-costs": MAP,
  "living-higher": MAP,
  "pavement-or-lawn": MAP,
  "where-you-can-see-the-stars": MAP,
};
