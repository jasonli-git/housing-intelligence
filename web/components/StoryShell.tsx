import Link from "next/link";
import type { ReactNode } from "react";

import { Crumbs, Kind } from "@/components/Crumbs";
import { Masthead } from "@/components/Masthead";

/** A visual story's page: the bar, the trail back to the index, the title and lede, the figure, the notes. */
export function StoryShell({ title, lede, note, children }: { title: string; lede: ReactNode; note: ReactNode; children: ReactNode }) {
  return (
    <>
      <Masthead affordability={{ kind: "route" }} />
      <main id="main-content" tabIndex={-1} className="shell horizon-page stories-page" data-region-level="stories">
        <header className="page-head">
          <div>
            <Crumbs trail={[{ href: "/", label: "United States" }, { href: "/stories", label: "Visual stories" }]} here={title} />
            <Kind kind="story" />
            <h1 className="page-title">{title}</h1>
            <p className="story-lede">{lede}</p>
          </div>
        </header>
        {/* The first screenful of this is what the home page shows of the story (capture-readme.mjs). */}
        <div data-story-shot>{children}</div>
        <p className="story-note">{note} <Link href="/stories">More visual stories →</Link></p>
      </main>
    </>
  );
}
