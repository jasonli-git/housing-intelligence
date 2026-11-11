import { expect, it } from "vitest";

import { STORIES } from "./stories";
import { storySlug } from "./storyLibrary";
import { STORY_TOOLS } from "./storyTools";

it("names a tool only for stories that exist, and only tools the site has", () => {
  const slugs = new Set(STORIES.map((story) => storySlug(story)));
  for (const [slug, tool] of Object.entries(STORY_TOOLS)) {
    expect(slugs.has(slug), slug).toBe(true);
    expect(["/tax", "/atlas?level=municipality&measure=sr1a_median_sale_price&view=latest&budget=1", "/guide", "/guide/numbers", "/compare", "/atlas", "/help"]).toContain(tool.href);
  }
});
