import Link from "next/link";
import type { ReactNode } from "react";

import { Crumbs, Kind } from "@/components/Crumbs";
import { GardenStateArtwork } from "@/components/GardenStateArtwork";
import { Masthead } from "@/components/Masthead";
import { StoryShortcuts } from "@/components/StoryShortcuts";
import { COLLECTIONS, storySlug } from "@/lib/storyLibrary";
import { STORIES } from "@/lib/stories";

const JERSEY = new Set<string>(COLLECTIONS.find((c) => c.id === "jersey")!.stories);

/** The story itself and the one after it in `STORIES`, wrapping round to the first. */
export function storyAndNext(title: string) {
  const index = STORIES.findIndex((story) => story.title === title);
  return index < 0 ? { story: null, next: null } : { story: STORIES[index], next: STORIES[(index + 1) % STORIES.length] };
}

/** A visual story's page: the bar, the trail back to the index, the title and lede, the
 *  shortcuts, the figure, its sources as a footnote, then the next story. The "Only in New
 *  Jersey" stories carry the place pages' NJ artwork beside their title. */
export function StoryShell({ title, lede, takeaway, note, children, focus }: { title: string; lede: ReactNode;
  /** The story's answer in one sentence, built from the same figures as the chart. */
  takeaway?: ReactNode; note: ReactNode; children: ReactNode; focus?: ReactNode }) {
  const { story, next } = storyAndNext(title);
  return (
    <>
      <Masthead affordability={{ kind: "route" }} />
      <main id="main-content" tabIndex={-1} className="shell horizon-page stories-page" data-region-level="stories" data-story={story ? storySlug(story) : undefined}>
        <header className="page-head">
          {story && JERSEY.has(storySlug(story)) && <GardenStateArtwork header />}
          <div>
            <Crumbs trail={[{ href: "/", label: "Home" }, { href: "/stories", label: "Visual stories" }]} here={title} />
            <Kind kind="story" />
            <h1 className="page-title">{title}</h1>
            {/* With a takeaway, the intro and the takeaway share a row; without one, the intro stands alone. */}
            {takeaway ? <div className="story-open">
              {!focus && <p className="story-lede">{lede}</p>}
              <p className="story-takeaway"><span>The takeaway</span>{takeaway}</p>
            </div> : !focus && <p className="story-lede">{lede}</p>}
          </div>
        </header>
        <StoryShortcuts />
        {focus}
        {focus && <><h2 className="story-h" id="story-statewide">Across New Jersey</h2><p className="story-lede">{lede}</p></>}
        <div data-story-shot>{children}</div>
        <p className="story-sources" id="story-sources"><b>Sources</b> {note}</p>
        <nav className="story-next" aria-label="More visual stories">
          {next && <Link href={next.href} prefetch={false}><span>Next story</span><b>{next.title}</b></Link>}
          <Link href="/stories" prefetch={false}>All visual stories →</Link>
        </nav>
      </main>
    </>
  );
}
