import type { Metadata } from "next";
import Link from "next/link";

import { Crumbs, Kind } from "@/components/Crumbs";
import { Masthead } from "@/components/Masthead";
import { pageMetadata } from "@/lib/meta";
import { STORIES } from "@/lib/stories";
import { ThemedShot } from "@/components/ThemedShot";
import "../horizon-theme.css";
import "./stories.css";

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
            <Crumbs trail={[{ href: "/", label: "United States" }, { href: "/states/new-jersey", label: "New Jersey" }]} here="Visual stories" />
            <Kind kind="story" />
            <h1 className="page-title">Visual stories</h1>
            <p className="story-lede">New Jersey&rsquo;s housing figures, drawn to answer one question each.</p>
          </div>
        </header>
        <ul className="stories-grid">
          {STORIES.map((s) => (
            <li key={s.href}>
              <Link href={s.href}>
                <ThemedShot name={`stories/${s.href.split("/").pop()}`} width={788} height={489} />
                <b>{s.title}</b>
                <span>{s.blurb}</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
