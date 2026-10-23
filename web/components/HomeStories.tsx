import Link from "next/link";
import { STORIES } from "@/lib/stories";
import { storyBySlug } from "@/lib/storyLibrary";
import { StoryCard } from "./StoryCard";

const HOME_PICKS = ["the-wawa-line", "twin-towns", "the-flood-claims-calendar"] as const;

export function HomeStories() {
  return <section className="home-stories" aria-labelledby="home-stories-heading">
    <header>
      <div className="home-stories-title"><h2 id="home-stories-heading">Visual stories</h2><span>New Jersey</span></div>
      <Link className="home-stories-all" href="/stories">Browse all {STORIES.length} <span aria-hidden="true">→</span></Link>
    </header>
    <ul className="home-story-track" aria-label="Selected visual stories">
      {HOME_PICKS.map((slug) => <li key={slug}><StoryCard story={storyBySlug(slug)} /></li>)}
    </ul>
  </section>;
}
