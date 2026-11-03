/**
 * The stories register (CLAUDE.md "Stories register"): what is known about each visual
 * story's sources and standing, kept beside the code and written out to docs/STORIES.md
 * by `npm run stories:register`, which a test holds to this file. A story with no entry
 * here is listed as not yet reviewed.
 */
import { NO_SHARE_CARD } from "./meta";
import { COLLECTIONS, EDITOR_PICKS, FEATURED_STORY, ON_PLACE_PAGES, storySlug } from "./storyLibrary";
import { STORIES } from "./stories";

export type StoryStatus = "live" | "needs review" | "draft";

/** One source a story reads, as it stood when the story was last reviewed. */
type StorySource = {
  /** The id in config/sources.yml. */
  id: string;
  /** What the story takes from it. */
  use: string;
  /** The release the review checked, as an absolute date or period. */
  asOf: string;
  /** How complete it is for this story, against an outside count where one exists. */
  coverage?: string;
};

export type StoryReview = {
  status: StoryStatus;
  reviewed: string;
  sources: StorySource[];
  /** Known problems, open until fixed. */
  issues?: string[];
  /** Possible improvements, not yet decided. */
  ideas?: string[];
};

// Outside counts are third-party store-locator scrapes, not official figures; the trial is
// the Overture comparison of 2026-11-03 (research/story-sources).
export const REVIEWS: Record<string, StoryReview> = {
  "the-wawa-line": {
    status: "live",
    reviewed: "2026-11-03",
    sources: [
      { id: "osm_nj", use: "Wawa and QuickChek stores by town", asOf: "extract fetched 2026-10-30",
        coverage: "Wawa 261 of about 298 (~88%); QuickChek 118 of about 145 (~81%)" },
      { id: "zillow_zhvi", use: "typical home value, each town against its county", asOf: "through September 2026" },
    ],
    ideas: ["Overture Places counts more Wawas (326) and QuickCheks (158) than exist, likely a store's shop and pumps listed twice or closed stores; OpenStreetMap stays the better source here unless duplicates can be merged reliably."],
  },
  "the-pizza-bagel-line": {
    status: "live",
    reviewed: "2026-11-03",
    sources: [
      { id: "osm_nj", use: "pizzerias and bagel shops by town", asOf: "extract fetched 2026-10-30",
        coverage: "1,086 pizzerias of about 2,700–2,900 (~40%); 278 bagel shops, no outside count" },
    ],
    issues: ["Coverage is uneven: OpenStreetMap maps fewer places in rural towns, so the south's ratio rests on fewer shops."],
    ideas: ["Overture Places finds 3,597 pizzerias and 810 bagel shops, bagel shops in 319 towns against 177; the finding holds on it (north 3.8, south 8.1 pizzerias per bagel shop, against 3.1 and 7.2). It overshoots on pizzerias, so it needs a confidence or duplicate filter."],
  },
  "hometown-famous": {
    status: "live",
    reviewed: "2026-11-03",
    sources: [
      { id: "wikidata", use: "people recorded as born in each municipality, and how widely known", asOf: "queried 2026-10-23" },
      { id: "census_acs", use: "today's population, the denominator", asOf: "2018–2022 ACS" },
    ],
    issues: ["Notability follows Wikidata's editors, who record athletes and performers more fully than others; a hospital town gathers births from its area."],
    ideas: ["Pantheon (MIT) is curated but older, smaller and of unclear data licence; Wikidata stays the source, refreshed monthly."],
  },
  "the-starbucks-index": {
    status: "live",
    reviewed: "2026-11-03",
    sources: [
      { id: "osm_nj", use: "Starbucks, Dunkin' and other chains by town", asOf: "extract fetched 2026-10-30",
        coverage: "Starbucks 237 of about 345 (~69%); Dunkin' 642 of about 860 (~74%)" },
      { id: "zillow_zhvi", use: "typical home value, each town against its county", asOf: "through September 2026" },
    ],
    ideas: ["Overture Places is clearly more complete here: Starbucks 296, Dunkin' 853, a Starbucks in 40 more towns and a Dunkin' in 52. Adopting it needs a source adapter, a terms check of its licences and a duplicate rule."],
  },
};

const where = (slug: string) => [
  slug === FEATURED_STORY && "featured",
  EDITOR_PICKS.includes(slug) && "editor's pick",
  ...COLLECTIONS.filter((c) => (c.stories as readonly string[]).includes(slug)).map((c) => c.title),
  ON_PLACE_PAGES.has(slug) && "place pages",
].filter(Boolean).join(", ") || "stories page only";

/** docs/STORIES.md, written from the stories list and the reviews above. */
export function renderStoryRegister(): string {
  const rows = STORIES.map((story) => {
    const slug = storySlug(story), review = REVIEWS[slug];
    return `| [${story.title}](../web/app/stories/${slug}/page.tsx) | ${where(slug)} | ${NO_SHARE_CARD.has(slug) ? "none (no chart until a place is picked)" : "yes"} | ${review?.status ?? "not yet reviewed"} | ${review?.reviewed ?? "—"} |`;
  });
  const details = STORIES.filter((story) => REVIEWS[storySlug(story)]).map((story) => {
    const review = REVIEWS[storySlug(story)];
    return [
      `### ${story.title}`, "",
      `Reviewed ${review.reviewed} · ${review.status}`, "",
      "| Source | Used for | As of | Coverage |", "|---|---|---|---|",
      ...review.sources.map((s) => `| \`${s.id}\` | ${s.use} | ${s.asOf} | ${s.coverage ?? "—"} |`),
      ...(review.issues?.length ? ["", "**Issues**", "", ...review.issues.map((i) => `- ${i}`)] : []),
      ...(review.ideas?.length ? ["", "**Ideas** (not decided)", "", ...review.ideas.map((i) => `- ${i}`)] : []),
    ].join("\n");
  });
  return [
    "# Stories register", "",
    "<!-- Generated from web/lib/storyRegister.ts by `cd web && npm run stories:register`. Edit that file, not this one. -->", "",
    "Every visual story, where it appears and how its sources stood when last reviewed.",
    "Decisions about how the stories are built are in [ARCHITECTURE.md](ARCHITECTURE.md);",
    "open work is in [TODO.md](TODO.md), and ideas here are not decided.", "",
    `## All stories (${STORIES.length})`, "",
    "| Story | Where it appears | Share image | Status | Reviewed |", "|---|---|---|---|---|",
    ...rows, "",
    "## Reviews", "",
    details.join("\n\n"), "",
  ].join("\n");
}
