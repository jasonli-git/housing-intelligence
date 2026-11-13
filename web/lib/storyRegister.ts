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
      { id: "overture_places", use: "Wawa and QuickChek stores by town (from 2026-11-03)", asOf: "release 2026-10-21.0, fetched 2026-11-03",
        coverage: "Wawa 292 of about 298 (~98%); QuickChek 112 of about 145 (~77%, stores only All the Places lists left out)" },
      { id: "zillow_zhvi", use: "typical home value, each town against its county", asOf: "through September 2026" },
    ],
    issues: ["The price comparison rests on 23 Wawa-only and 26 QuickChek-only towns: a −4.8% gap with a 95% range of −22% to +16%, so the takeaway calls them alike (ARCHITECTURE #472)."],
    ideas: ["Before 2026-11-03 it read OpenStreetMap: 261 Wawas (~88%) and 118 QuickCheks (~81%), a −2% gap across 10 counties."],
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
      { id: "overture_places", use: "13 chains and kinds of place by town (Milestone 60; list widened 2026-11-03)", asOf: "release 2026-10-21.0, fetched 2026-11-03",
        coverage: "Starbucks 294 of about 345 (~85%); Dunkin' 810 of about 860 (~94%); Wawa 292 of about 298; QuickChek 112 of about 145 (~77%, stores only All the Places lists left out); Wegmans 11 of 11. Against Census County Business Patterns 2023 by county (checked 2026-11-03): laundromats 924 to 586 coin laundries, counties correlating 0.97; golf courses 316 to 199 golf courses and country clubs, 0.76; yoga studios 655 to 1,495 fitness centres of every kind, 0.91. The Census counts only businesses with paid staff and leaves out public courses, so Overture's higher counts are expected. Tennis courts and pawn shops have no matching Census industry and are unchecked" },
      { id: "zillow_zhvi", use: "typical home value, each town against its county", asOf: "through September 2026" },
    ],
    issues: ["A category is Overture's own: a public park's tennis courts count as tennis courts, and a pawn shop includes gold buyers (sampled 2026-11-03)."],
    ideas: ["Before 2026-11-03 the bubbles were 8 chains with groups as small as 13 towns; the list now holds 13 kinds of place, each in 25 to two in three of the towns (ARCHITECTURE #471).", "Before Milestone 60 it read OpenStreetMap (Starbucks ~69%, Dunkin' ~74%): more Starbucks than Dunkin' +25%, a Starbucks +5%, a Dunkin' −15%; on Overture +34%, +0% and −17%."],
  },
  // Editor's picks, reviewed 2026-11-06 from the build deployed that day.
  "pricier-towns": {
    status: "live",
    reviewed: "2026-11-06",
    sources: [
      { id: "zillow_zhvi", use: "typical home value, each town against towns in its county", asOf: "through September 2026", coverage: "388 of 564 towns have a value" },
      { id: "census_acs", use: "work from home, owners, detached, long commutes, old housing, transit, renter strain, big buildings", asOf: "2020–2024 ACS" },
      { id: "census_lodes", use: "share of residents' jobs in New York City", asOf: "2023" },
      { id: "bts_ntm", use: "homes within reach of a rail station", asOf: "current stops" },
      { id: "nj_tax_rates", use: "the Director's Ratio (assessments overdue)", asOf: "2025, published 2026-03-11" },
      { id: "fema_nfhl", use: "share of homes in a flood zone", asOf: "fetched 2026-10-03", coverage: "369 of the 388 towns" },
      { id: "epa_sdwis", use: "homes on a water system with a health-based violation since 2015", asOf: "fetched 2026-10-03" },
      { id: "njdep_kcsl", use: "open contaminated sites", asOf: "fetched 2026-10-30" },
    ],
    issues: [
      "No uncertainty is shown, and three traits rest on small groups: near a train 24 towns (+15%), transit commuters 30 (−5%), big apartment buildings 37 (−17%). The Wawa line shows a 95% range for the same reason (ARCHITECTURE #472).",
      "\"Contaminated sites\" counts sites, not sites per home, so it partly measures a town's size; its priciest examples are Franklin Lakes, Summit and Colts Neck.",
      "\"Many work from home\" (+47%) largely stands in for income and occupation; the note's \"goes with, does not make\" covers it, but it leads the chart.",
    ],
    ideas: ["Show each premium's range, or drop traits under about 50 towns; count contaminated sites per 1,000 homes."],
  },
  "where-you-can-see-the-stars": {
    status: "live",
    reviewed: "2026-11-06",
    sources: [
      { id: "eog_vnl", use: "night-time radiance over each town's homes", asOf: "2024 annual composite, fetched 2026-10-22", coverage: "about 460 m pixels, weighted by each census block's homes" },
      { id: "zillow_zhvi", use: "typical home value, each town against its county", asOf: "through September 2026" },
    ],
    issues: [
      "Radiance seen from orbit stands in for sky darkness, as the note says; the darkest towns are also the most rural, with bigger lots, so \"+6% each time the glow halves\" carries land and quiet with it.",
      "`eog_vnl` is not tracked for new releases (freshness status not_tracked); the 2025 composite will not be noticed.",
    ],
  },
  "boroughitis": {
    status: "live",
    reviewed: "2026-11-06",
    sources: [
      { id: "nj_civil_boundaries", use: "the year each town became its present kind of municipality", asOf: "Bulletin 67 (1969), fetched 2026-11-06", coverage: "536 of 564 towns; 244 of 252 boroughs" },
      { id: "wikidata", use: "inception, for a town the book does not date", asOf: "queried 2026-10-23" },
    ],
    issues: [
      "Towns the book does not date fall back to Wikidata, which can hold a settlement date: Princeton (consolidated 2013) is drawn at 1699 and Verona at 1701. Essex's towns that became townships after 1968 have no book entry under today's type.",
      "The scan's OCR misreads some headings and years; a misread year is left to Wikidata, not guessed.",
    ],
    ideas: [
      "Fixed 2026-11-06 (ARCHITECTURE #476): on Wikidata alone, 9 boroughs were drawn before 1850 (Runnemede 1625, Chatham 1709) and the headline read 48 of 181 boroughs (27%) in the 1890s; with Snyder first it is 76 of 250 (30%), and 34 towns in 1894.",
    ],
  },
  "the-flood-claims-calendar": {
    status: "live",
    reviewed: "2026-11-06",
    sources: [
      { id: "fema_nfip_claims", use: "claims with anything paid, by day of loss, statewide", asOf: "fetched 2026-10-03", coverage: "169,093 claims, 1978 to 2026" },
    ],
    issues: [
      "2026 is a part year (83 claims) and claims arrive months after a loss, so the latest year reads darker than it will be.",
      "Fewer homes were insured before the 1990s, as the note says, so early years understate their floods.",
    ],
  },
  "when-the-town-was-built": {
    status: "live",
    reviewed: "2026-11-06",
    sources: [
      { id: "nj_modiv", use: "one-to-four-family houses (class 2) by year built, counted by decade", asOf: "2024 tax list, published 2025-09-11" },
    ],
    issues: [
      "Class 2 leaves out apartment buildings, so Hudson's and Essex's ridges count only their houses; the note says houses throughout.",
      "An assessor's year for an old house is often an estimate, and only standing houses are counted; the note says both.",
    ],
  },
};

/** One week's social post (Director Notes, "Social media lineup"): Fridays at 9 AM ET on X
 *  and Bluesky. "planned" is the owner's order, not yet written or scheduled. */
export type Posting = { date: string; slug: string; state: "posted" | "scheduled" | "planned" };

/** The posting order, approved by the owner on 2026-11-12. Christmas and New Year's Day
 *  (2026-12-25, 2027-01-01) are left free. */
export const POSTING_ORDER: Posting[] = [
  { date: "2026-11-06", slug: "the-starbucks-index", state: "posted" },
  { date: "2026-11-13", slug: "the-wawa-line", state: "scheduled" },
  { date: "2026-11-20", slug: "the-flood-claims-calendar", state: "planned" },
  { date: "2026-11-27", slug: "hometown-famous", state: "planned" },
  { date: "2026-12-04", slug: "when-the-town-was-built", state: "planned" },
  { date: "2026-12-11", slug: "the-pizza-bagel-line", state: "planned" },
  { date: "2026-12-18", slug: "where-you-can-see-the-stars", state: "planned" },
  { date: "2027-01-08", slug: "boroughitis", state: "planned" },
  { date: "2027-01-15", slug: "pricier-towns", state: "planned" },
];

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
    "Every visual story, where it appears, when it is posted to social media and how its",
    "sources stood when last reviewed.",
    "Decisions about how the stories are built are in [ARCHITECTURE.md](ARCHITECTURE.md);",
    "open work is in [TODO.md](TODO.md), and ideas here are not decided.", "",
    `## All stories (${STORIES.length})`, "",
    "| Story | Where it appears | Share image | Status | Reviewed |", "|---|---|---|---|---|",
    ...rows, "",
    "## Posting order", "",
    "One story a week on X and Bluesky, Fridays at 9 AM Eastern; the plan is in",
    "[DIRECTOR_NOTES.md](DIRECTOR_NOTES.md) (\"Social media lineup\"). 2026-12-25 and 2027-01-01 are left free.", "",
    "| Date | Story | State |", "|---|---|---|",
    ...POSTING_ORDER.map((p) => {
      const story = STORIES.find((s) => storySlug(s) === p.slug);
      return `| ${p.date} | [${story?.title ?? p.slug}](../web/app/stories/${p.slug}/page.tsx) | ${p.state} |`;
    }), "",
    "## Reviews", "",
    details.join("\n\n"), "",
  ].join("\n");
}
