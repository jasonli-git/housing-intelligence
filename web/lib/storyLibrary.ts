import { STORIES } from "./stories";

export type Story = (typeof STORIES)[number];
export const COLLECTIONS = [
  { id: "jersey", title: "Only in New Jersey", description: "The state’s unmistakable character.", stories: ["the-wawa-line", "boroughitis", "the-pizza-bagel-line", "diner-capital", "the-winter-empty-shore", "whats-in-a-name", "the-starbucks-index", "court-circle-lane", "hometown-famous"] },
  { id: "money", title: "What your money buys", description: "Beyond the asking price.", stories: ["twin-towns", "the-true-monthly-cost", "price-ladder", "same-house-different-tax-bill", "priciest-and-cheapest", "income-and-home-value", "pricier-towns", "the-mortgage-market", "your-towns-time-machine", "is-today-unusual"] },
  { id: "place", title: "The feel of a place", description: "Trees, streets, space and quiet.", stories: ["the-leafy-premium", "what-quiet-costs", "where-you-can-see-the-stars", "what-a-house-buys-in-land", "what-the-housing-is", "how-big-the-houses-are", "the-long-commute-premium"] },
  { id: "motion", title: "Places in motion", description: "People move. Towns change.", stories: ["who-moves-in", "where-the-workday-goes", "is-new-jersey-building", "how-long-homes-sit", "when-the-town-was-built"] },
  { id: "surface", title: "Look beneath the surface", description: "The patterns you might otherwise miss.", stories: ["the-flood-claims-calendar", "water-you-can-check", "living-higher", "the-hottest-counties", "pavement-or-lawn", "how-data-gets-rewritten"] },
] as const;

export type CollectionId = (typeof COLLECTIONS)[number]["id"];
export const EDITOR_PICKS = ["twin-towns", "the-wawa-line", "the-true-monthly-cost", "the-flood-claims-calendar"];
export const FEATURED_STORY = "twin-towns";
export const storySlug = (story: Story) => story.href.split("/").at(-1)!;

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
  return STORIES.filter((s) => {
    if (collection !== "all" && collectionFor(s) !== collection) return false;
    const text = `${s.title} ${s.blurb}`.toLocaleLowerCase();
    return words.every((word) => text.includes(word));
  });
}
