import { describe, expect, it } from "vitest";
import { STORIES } from "./stories";
import { COLLECTIONS, EDITOR_PICKS, FEATURED_STORY, STORY_PREVIEWS, collectionFor, findStories, storyBySlug, storyPreview, storySlug } from "./storyLibrary";

describe("story library curation", () => {
  it("gives every story a concise preview without changing its full description", () => {
    expect(Object.keys(STORY_PREVIEWS).sort()).toEqual(STORIES.map(storySlug).sort());
    for (const story of STORIES) {
      expect(storyPreview(story).length).toBeLessThan(90);
      expect(storyPreview(story).length).toBeLessThan(story.blurb.length);
    }
  });
  it("puts every story in exactly one primary collection", () => {
    const slugs = COLLECTIONS.flatMap((c) => [...c.stories]);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect([...slugs].sort()).toEqual(STORIES.map(storySlug).sort());
    expect(STORIES.every((s) => collectionFor(s))).toBe(true);
  });
  it("uses actual, distinct stories for editorial picks and feature", () => {
    expect(new Set(EDITOR_PICKS).size).toBe(EDITOR_PICKS.length);
    for (const slug of [...EDITOR_PICKS, FEATURED_STORY]) expect(storyBySlug(slug).href).toBe(`/stories/${slug}`);
    expect(() => storyBySlug("missing-story")).toThrow("Unknown visual story");
  });
  it("searches titles and descriptions, ignoring case and extra whitespace", () => {
    expect(findStories("  TAX  ").map(storySlug)).toContain("same-house-different-tax-bill");
    expect(findStories("  homes  income ").length).toBeGreaterThan(0);
    expect(findStories("unfindablequery")).toEqual([]);
    expect(findStories("building footprints").map(storySlug)).toEqual(["how-big-the-houses-are"]);
    expect(findStories(" ")).toHaveLength(STORIES.length);
  });
  it("combines search with collection filtering", () => {
    expect(findStories("", "jersey")).toHaveLength(COLLECTIONS[0].stories.length);
    expect(findStories("Wawa", "money")).toEqual([]);
    expect(findStories("Wawa", "jersey").map(storySlug)).toEqual(["the-wawa-line"]);
  });
});
