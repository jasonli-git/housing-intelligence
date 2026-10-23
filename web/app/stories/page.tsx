import type { Metadata } from "next";

import { Crumbs, Kind } from "@/components/Crumbs";
import { Masthead } from "@/components/Masthead";
import { pageMetadata } from "@/lib/meta";
import { StoryLibrary } from "@/components/StoryLibrary";
import "../horizon-theme.css";
import "./stories.css";
import "./story-cards.css";
import "./library.css";

export const metadata: Metadata = pageMetadata({
  title: "Visual stories — Housing",
  description: "New Jersey's housing figures drawn as stories: prices and incomes, who moves and where people work, what gets built, what a month costs, taxes, mortgages, water, and how data gets revised.",
  path: "/stories",
});


export default function StoriesPage() {
  return (
    <>
      <Masthead affordability={{ kind: "route" }} />
      <main id="main-content" tabIndex={-1} className="shell horizon-page stories-page" data-region-level="stories">
        <header className="page-head">
          <div>
            <Crumbs trail={[{ href: "/", label: "United States" }]} here="Visual stories" />
            <Kind kind="story" />
            <h1 className="page-title">Visual stories</h1>
          </div>
        </header>
        <StoryLibrary />
      </main>
    </>
  );
}
