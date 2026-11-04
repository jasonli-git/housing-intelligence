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
    ideas: ["Stays on OpenStreetMap (Milestone 60). Overture, with its duplicates merged and stores only All the Places lists left out, has 292 Wawas but 112 QuickCheks, fewer than OpenStreetMap's 118."],
  },
  "the-pizza-bagel-line": {
    status: "live",
    reviewed: "2026-11-03",
    sources: [
      { id: "overture_places", use: "pizzerias and bagel shops by town (Milestone 60)", asOf: "release 2026-10-21.0, fetched 2026-11-03",
        coverage: "2,696 pizzerias of about 2,700–2,900 (~95%); 737 bagel shops, in 319 towns" },
    ],
    issues: ["The southernmost band (Cape May) rests on 8 bagel shops, so its own ratio is noisy; the headline compares the three northern and three southern bands."],
    ideas: ["Before Milestone 60 it read OpenStreetMap: 1,086 pizzerias (~40%) and 278 bagel shops in 177 towns, north 3.1 against south 7.5 pizzerias per bagel shop; on Overture, 3.1 against 6.0."],
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
      { id: "overture_places", use: "Starbucks, Dunkin', Trader Joe's, Whole Foods, Wawa, QuickChek and diners by town (Milestone 60)", asOf: "release 2026-10-21.0, fetched 2026-11-03",
        coverage: "Starbucks 294 of about 345 (~85%); Dunkin' 810 of about 860 (~94%); Wawa 292 of about 298; QuickChek 112 of about 145 (~77%, stores only All the Places lists left out)" },
      { id: "zillow_zhvi", use: "typical home value, each town against its county", asOf: "through September 2026" },
    ],
    issues: ["Some groups are small: more Starbucks than Dunkin' in 16 towns, Trader Joe's in 13, Whole Foods in 18; the takeaway headlines the 16-town group (+34%)."],
    ideas: ["Revisit which shops the chart compares, and whether a group needs a minimum number of towns (owner, 2026-11-03, after Milestone 60).", "Before Milestone 60 it read OpenStreetMap (Starbucks ~69%, Dunkin' ~74%): more Starbucks than Dunkin' +25%, a Starbucks +5%, a Dunkin' −15%; on Overture +34%, +0% and −17%."],
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
