import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { POSTING_ORDER, REVIEWS, renderStoryRegister } from "./storyRegister";
import { storySlug } from "./storyLibrary";
import { STORIES } from "./stories";

const FILE = resolve(__dirname, "../../docs/STORIES.md");

it("keeps docs/STORIES.md as storyRegister.ts writes it", () => {
  const text = renderStoryRegister();
  // `npm run stories:register` rewrites the file; otherwise a hand edit or a stale copy fails.
  if (process.env.UPDATE_STORY_REGISTER) writeFileSync(FILE, text);
  expect(readFileSync(FILE, "utf8")).toBe(text);
});

it("reviews only stories that exist, and dates every review", () => {
  const slugs = new Set(STORIES.map(storySlug));
  for (const [slug, review] of Object.entries(REVIEWS)) {
    expect(slugs.has(slug), slug).toBe(true);
    expect(review.reviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(review.sources.length, slug).toBeGreaterThan(0);
  }
});

it("names only sources config/sources.yml defines", () => {
  const config = readFileSync(resolve(__dirname, "../../config/sources.yml"), "utf8");
  for (const review of Object.values(REVIEWS)) for (const source of review.sources) {
    expect(config, source.id).toMatch(new RegExp(`^  ${source.id}:`, "m"));
  }
});

it("posts only stories that exist, each once, on Fridays in date order", () => {
  const slugs = new Set(STORIES.map(storySlug));
  for (const p of POSTING_ORDER) {
    expect(slugs.has(p.slug), p.slug).toBe(true);
    expect(new Date(`${p.date}T12:00:00Z`).getUTCDay(), p.date).toBe(5);
  }
  expect(new Set(POSTING_ORDER.map((p) => p.slug)).size).toBe(POSTING_ORDER.length);
  const dates = POSTING_ORDER.map((p) => p.date);
  expect(dates).toEqual([...dates].sort());
});
