import Link from "next/link";
import type { ReactNode } from "react";

import { Crumbs, Kind } from "@/components/Crumbs";
import { Masthead } from "@/components/Masthead";
import { StoryShortcuts } from "@/components/StoryShortcuts";

/** A visual story's page: the bar, the trail back to the index, the title and lede, the shortcuts, the figure, the notes. */
export function StoryShell({ title, lede, note, children, focus }: { title: string; lede: ReactNode; note: ReactNode; children: ReactNode; focus?: ReactNode }) {
  return (
    <>
      <Masthead affordability={{ kind: "route" }} />
      <main id="main-content" tabIndex={-1} className="shell horizon-page stories-page" data-region-level="stories">
        <header className="page-head">
          <div>
            <Crumbs trail={[{ href: "/", label: "Home" }, { href: "/stories", label: "Visual stories" }]} here={title} />
            <Kind kind="story" />
            <h1 className="page-title">{title}</h1>
            {!focus && <p className="story-lede">{lede}</p>}
          </div>
        </header>
        <StoryShortcuts />
        {focus}
        {focus && <><h2 className="story-h" id="story-statewide">Across New Jersey</h2><p className="story-lede">{lede}</p></>}
        <div data-story-shot>{children}</div>
        <p className="story-note" id="story-sources">{note} <Link href="/stories">More visual stories →</Link></p>
      </main>
    </>
  );
}
