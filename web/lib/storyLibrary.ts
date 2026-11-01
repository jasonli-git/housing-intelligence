import { STORIES } from "./stories";

export type Story = (typeof STORIES)[number];
/**
 * Stories a place page now tells for each town (the infographic mockup). Their pages stay
 * published and linked from place pages; the library keeps the statewide patterns.
 */
export const ON_PLACE_PAGES: ReadonlySet<string> = new Set(["who-feels-housing-costs", "the-mortgage-market", "is-new-jersey-building", "price-ladder", "the-true-monthly-cost", "what-the-housing-is", "who-moves-in", "your-towns-time-machine", "what-a-house-buys-in-land", "sites-and-cleanup", "where-internet-reaches", "water-you-can-check", "when-the-power-goes-out", "health-in-context", "living-higher", "how-big-the-houses-are", "same-house-different-tax-bill", "where-the-workday-goes", "where-students-go", "the-winter-empty-shore", "income-and-home-value", "how-long-homes-sit", "the-hottest-counties", "is-today-unusual"]);
export const LIBRARY_STORIES = STORIES.filter((story) => !ON_PLACE_PAGES.has(story.href.split("/").at(-1)!));
export const COLLECTIONS = [
  { id: "jersey", title: "Only in New Jersey", description: "The state’s unmistakable character.", stories: ["the-wawa-line", "boroughitis", "the-pizza-bagel-line", "diner-capital", "whats-in-a-name", "the-starbucks-index", "court-circle-lane", "hometown-famous"] },
  { id: "money", title: "What your money buys", description: "Beyond the asking price.", stories: ["twin-towns", "priciest-and-cheapest", "pricier-towns", "the-long-commute-premium"] },
  { id: "place", title: "The feel of a place", description: "Trees, streets, space and quiet.", stories: ["the-leafy-premium", "what-quiet-costs", "where-you-can-see-the-stars", "pavement-or-lawn", "when-the-town-was-built"] },
  { id: "surface", title: "Look beneath the surface", description: "The patterns you might otherwise miss.", stories: ["the-flood-claims-calendar", "how-data-gets-rewritten"] },
] as const;

export type CollectionId = (typeof COLLECTIONS)[number]["id"];
/**
 * The library's front (owner, 2026-10-24): a featured story every New Jerseyan has an
 * opinion on, then one pick from each collection, mixing chart types, and one a buyer
 * can act on. The featured story is not repeated among the picks.
 */
export const FEATURED_STORY = "the-wawa-line";
export const FEATURED_HEADLINE = ["Where South Jersey", "begins."] as const;
export const EDITOR_PICKS = ["twin-towns", "the-flood-claims-calendar", "boroughitis", "pricier-towns", "where-you-can-see-the-stars", "when-the-town-was-built"];
export const storySlug = (story: Story) => story.href.split("/").at(-1)!;

/** Short library previews; full story descriptions and search vocabulary stay intact. */
export const STORY_PREVIEWS: Record<string, string> = {
  "health-in-context":"Health estimates, with their actual geography and uncertainty.",
  "sites-and-cleanup":"What cleanup records say about a place—and what they cannot say about a home.",
  "when-the-power-goes-out":"Annual outages, with and without major events. Utility records, not town rankings.",
  "where-internet-reaches":"Fiber and wired offers. Different places, dates and denominators.",
  "where-students-go":"Public or private: where the children who live here go to school.",
  "who-feels-housing-costs": "Housing-cost burden across income bands. Explore renters and owners.",
  "pricier-towns": "Which town traits go with higher home values?",
  "price-ladder": "Starter homes, typical values and recent sales on one scale.",
  "priciest-and-cheapest": "Each county’s most and least expensive towns and ZIPs.",
  "income-and-home-value": "Home values against household incomes. Find your town.",
  "who-moves-in": "Who moves between counties, and what arrivals earn.",
  "where-the-workday-goes": "Where residents work beyond their hometown.",
  "is-new-jersey-building": "Homes permitted, completed and demolished by county.",
  "what-the-housing-is": "The age and mix of each town’s homes.",
  "the-true-monthly-cost": "Mortgage, taxes, insurance and utilities by town.",
  "same-house-different-tax-bill": "How local tax rates change the yearly bill.",
  "the-mortgage-market": "Which loans get made, and why applications are denied.",
  "water-you-can-check": "Water violations, PFAS results and lead service lines.",
  "is-today-unusual": "Today’s prices and incomes against each county’s history.",
  "whats-in-a-name": "Do “Lake” towns cost more than “Park” towns?",
  "the-long-commute-premium": "Why longer commutes go with pricier towns.",
  "twin-towns": "Similar incomes, homes and commutes. Different home values.",
  "what-a-house-buys-in-land": "Home values per acre, from city lots to the Pinelands.",
  "your-towns-time-machine": "When typical home values crossed $500,000 and $1 million.",
  "the-winter-empty-shore": "Shore towns with homes kept for the summer.",
  "the-wawa-line": "The Wawa–QuickChek divide, and home values on either side.",
  "the-starbucks-index": "What a town’s shops reveal about its home values.",
  "diner-capital": "Where the diners are, per resident.",
  "the-leafy-premium": "Tree cover around homes, and how it relates to price.",
  "court-circle-lane": "What street names reveal about a town’s age and prices.",
  "living-higher": "How high homes sit above sea level, and what they cost.",
  "what-quiet-costs": "Transport noise around homes, and the price of quieter towns.",
  "where-you-can-see-the-stars": "Dark skies over homes, and what they cost.",
  "how-data-gets-rewritten": "When publishers revise their figures, and by how much.",
  "boroughitis": "The incorporation history behind New Jersey’s 564 towns.",
  "the-flood-claims-calendar": "Insured flood claims since 1978, day by day.",
  "how-long-homes-sit": "How long listings wait for a buyer, by county and month.",
  "when-the-town-was-built": "Each county’s homes by the decade they were built.",
  "how-big-the-houses-are": "Building footprints, from above.",
  "pavement-or-lawn": "Paved ground around homes, and how it relates to price.",
  "the-hottest-counties": "Summer days above 90°F, then and now.",
  "the-pizza-bagel-line": "Bagel shops versus pizzerias, north to south.",
  "hometown-famous": "Notable people born in each town, relative to its size.",
};

export const storyPreview = (story: Story) => STORY_PREVIEWS[storySlug(story)] ?? story.blurb;

export function storyBySlug(slug: string): Story {
  const story = STORIES.find((s) => storySlug(s) === slug);
  if (!story) throw new Error(`Unknown visual story: ${slug}`);
  return story;
}

export function collectionFor(story: Story): CollectionId {
  return COLLECTIONS.find((c) => (c.stories as readonly string[]).includes(storySlug(story)))!.id;
}

export function findStories(query: string, collection: string = "all"): Story[] {
  const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return LIBRARY_STORIES.filter((s) => {
    if (collection !== "all" && collectionFor(s) !== collection) return false;
    const text = `${s.title} ${storyPreview(s)} ${s.blurb}`.toLocaleLowerCase();
    return words.every((word) => text.includes(word));
  });
}
