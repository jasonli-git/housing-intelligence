"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ThemedShot } from "./ThemedShot";
import { STORIES } from "@/lib/stories";
import { COLLECTIONS, EDITOR_PICKS, FEATURED_STORY, collectionFor, findStories, storyBySlug, storyPreview, storySlug, type Story } from "@/lib/storyLibrary";

const FEATURED_CHOICES = [FEATURED_STORY, ...EDITOR_PICKS.filter((slug) => slug !== FEATURED_STORY)].map(storyBySlug);
const MAP_COVERS = new Set(["the-wawa-line", "the-pizza-bagel-line", "the-starbucks-index", "the-leafy-premium", "living-higher", "what-quiet-costs", "where-you-can-see-the-stars", "pavement-or-lawn", "where-the-workday-goes", "hometown-famous"]);

function Cover({ story, title = false }: { story: Story; title?: boolean }) {
  return <div className="library-cover" data-topic={collectionFor(story)} data-art={MAP_COVERS.has(storySlug(story)) ? "map" : "chart"}>
    {/* A cropped detail of the actual chart, not fabricated quantitative artwork. */}
    <ThemedShot name={`stories/${storySlug(story)}`} width={788} height={489} className="library-chart-detail" />
    {title && <div className="library-poster-title"><h3>{story.title}</h3><span className="library-cover-open" aria-hidden="true">↗</span></div>}
  </div>;
}

function StoryCard({ story }: { story: Story }) {
  return <Link className="library-card" href={story.href} prefetch={false}>
    <Cover story={story} title />
    <p>{storyPreview(story)}</p>
  </Link>;
}

function StoryRail({ id, title, stories, viewAll }: {
  id: string; title: string; stories: Story[]; viewAll?: () => void;
}) {
  const track = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const measure = () => setEdges({ start: el.scrollLeft <= 5, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 });
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => { el.removeEventListener("scroll", measure); observer.disconnect(); };
  }, []);
  function move(direction: number) {
    const el = track.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * .85, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }
  return <section className="library-rail" aria-labelledby={`${id}-heading`}>
    <header className="library-rail-head">
      <div><h2 id={`${id}-heading`}>{title}</h2></div>
      <div className="library-rail-actions">
        {viewAll && <button className="library-view-all" onClick={viewAll}>View all <span aria-hidden="true">↗</span></button>}
      </div>
    </header>
    <div className="library-rail-frame">
      <ul ref={track} id={`${id}-track`} className="library-track" aria-label={title} onKeyDown={(event) => {
      if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
      const links = Array.from(event.currentTarget.querySelectorAll<HTMLAnchorElement>("a"));
      const index = links.indexOf(document.activeElement as HTMLAnchorElement);
      if (index < 0) return;
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? links.length - 1 : Math.max(0, Math.min(links.length - 1, index + (event.key === "ArrowRight" ? 1 : -1)));
      links[next]?.focus();
    }}>
      {stories.map((story) => <li key={story.href}><StoryCard story={story} /></li>)}
      </ul>
      <div className="library-rail-controls">
        <button className="library-arrow" aria-label={`Previous stories in ${title}`} aria-controls={`${id}-track`} disabled={edges.start} onClick={() => move(-1)}>‹</button>
        <button className="library-arrow" aria-label={`Next stories in ${title}`} aria-controls={`${id}-track`} disabled={edges.end} onClick={() => move(1)}>›</button>
      </div>
    </div>
  </section>;
}

export function StoryLibrary() {
  const [mode, setMode] = useState<"curated" | "all">("curated");
  const [topic, setTopic] = useState("all");
  const [query, setQuery] = useState("");
  const [featureIndex, setFeatureIndex] = useState(0);
  const featured = FEATURED_CHOICES[featureIndex];
  const results = findStories(query, topic);
  const directory = useRef<HTMLDivElement>(null);
  function showCollection(id: string) {
    setTopic(id); setQuery(""); setMode("all");
    requestAnimationFrame(() => {
      directory.current?.focus({ preventScroll: true });
      directory.current?.scrollIntoView({ block: "start", behavior: "instant" });
    });
  }
  return <div className="story-library">
    <div className="library-toolbar" ref={directory} tabIndex={-1}>
      <div role="group" aria-label="Story browsing view" className="library-modes">
        <button aria-pressed={mode === "curated"} onClick={() => setMode("curated")}>Discover</button>
        <button aria-pressed={mode === "all"} onClick={() => setMode("all")}>All stories <span>{STORIES.length}</span></button>
      </div>
      <span className="library-scope">New Jersey</span>
    </div>
    {mode === "curated" ? <>
      <article className="library-feature" aria-label="Featured story">
        <div className="library-feature-art" key={`art-${featured.href}`}><Cover story={featured} /></div>
        <div className="library-feature-copy" key={featured.href}>
          <span className="library-eyebrow">Featured</span>
          <h2>{storySlug(featured) === "the-wawa-line" ? "The Wawa\nline." : featured.title}</h2>
          <p>{storyPreview(featured)}</p>
          <Link className="library-feature-cta" href={featured.href} prefetch={false} aria-label={`Explore ${featured.title}`}>Explore <span aria-hidden="true">↗</span></Link>
        </div>
        <div className="library-feature-switcher" role="group" aria-label="Featured stories">
          {FEATURED_CHOICES.map((story, i) => <button key={story.href} aria-label={`Feature ${story.title}`} title={story.title} aria-pressed={featureIndex === i} onClick={() => setFeatureIndex(i)}>
            <ThemedShot name={`stories/${storySlug(story)}`} width={788} height={489} className="library-feature-thumb" />
          </button>)}
        </div>
      </article>
      <StoryRail id="editors" title="Editor’s picks" stories={EDITOR_PICKS.map(storyBySlug)} />
      {COLLECTIONS.map((c) => <StoryRail key={c.id} id={c.id} title={c.title} stories={c.stories.map(storyBySlug)} viewAll={() => showCollection(c.id)} />)}
      <div className="library-end"><button onClick={() => showCollection("all")}>All {STORIES.length} stories ↑</button></div>
    </> : <section className="library-directory" aria-labelledby="library-directory-heading">
      <h2 id="library-directory-heading">{topic === "all" ? "All stories" : COLLECTIONS.find((c) => c.id === topic)?.title}</h2>
      <div className="library-filters">
        <label>Search stories<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <label>Collection<select value={topic} onChange={(event) => setTopic(event.target.value)}><option value="all">All topics</option>{COLLECTIONS.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
      </div>
      <p className="library-result-count" role="status">{results.length} {results.length === 1 ? "story" : "stories"}{query ? ` matching “${query}”` : ""}</p>
      {results.length ? <ul className="library-grid">{results.map((story) => <li key={story.href}><StoryCard story={story} /></li>)}</ul> : <div className="library-empty"><p>No matches. Try another search or collection.</p><button onClick={() => { setQuery(""); setTopic("all"); }}>Show all stories</button></div>}
    </section>}
  </div>;
}
