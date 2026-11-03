"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { StoryCard, StoryCover } from "./StoryCard";
import { COLLECTIONS, EDITOR_PICKS, LIBRARY_STORIES, FEATURED_HEADLINE, FEATURED_STORY, findStories, storyBySlug, storyPreview, type Story } from "@/lib/storyLibrary";

// New Jersey's outline from the site's own states layer, simplified, for "Only in New Jersey".
const NJ_SHAPE = "M7.8 19.2L6.7 20.7L5.9 22.3L3.9 24L1.7 19.7L0 17.8L.3 16.7L0 16.1L.8 14.8L1.6 14.1L3 13.8L3.1 13.1L6 11.3L4.2 9L3.6 8.8L3.5 7.6L2.6 7.3L2.6 5.7L3.2 5.3L3.6 4.6L3.1 3.4L4.2 2.5L5.5 .3L6.2 0L11.9 3.4L10.8 6.6L9.8 6.7L9.3 7.9L9.5 8.2L11.3 7.8L11.9 8.2L11.9 9.8L10.9 15L9.1 18.3L8.5 19Z";

/** A rail's title; the Jersey collection's names the state in the state's blue, with its shape. */
function RailTitle({ title }: { title: string }) {
  const [before, state] = title.split(/(New Jersey)$/);
  if (!state) return <>{title}</>;
  return <>{before}<span className="library-state">{state}</span><svg className="library-state-shape" viewBox="0 0 11.9 24" aria-hidden="true"><path d={NJ_SHAPE} /></svg></>;
}

function StoryRail({ id, title, stories, viewAll }: {
  id: string; title: string; stories: Story[]; viewAll?: () => void;
}) {
  const track = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    // Scroll snapping may settle on the track's 3px focus-outline inset.
    const measure = () => setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
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
  return <section className={id === "editors" ? "library-rail library-rail-picks" : "library-rail"} aria-labelledby={`${id}-heading`}>
    <header className="library-rail-head">
      <div><h2 id={`${id}-heading`}><RailTitle title={title} /></h2></div>
      {viewAll && <div className="library-rail-actions">
        <button className="library-view-all" onClick={viewAll}>View all <span aria-hidden="true">↗</span></button>
      </div>}
    </header>
    <div className="library-rail-stage">
    <button className="library-arrow library-arrow-previous" aria-label={`Previous stories in ${title}`} aria-controls={`${id}-track`} disabled={edges.start} onClick={() => move(-1)}>‹</button>
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
    <button className="library-arrow library-arrow-next" aria-label={`Next stories in ${title}`} aria-controls={`${id}-track`} disabled={edges.end} onClick={() => move(1)}>›</button>
    </div>
  </section>;
}

export function StoryLibrary() {
  const [mode, setMode] = useState<"curated" | "all">("curated");
  const [topic, setTopic] = useState("all");
  const [query, setQuery] = useState("");
  const featured = storyBySlug(FEATURED_STORY);
  const results = findStories(query, topic);
  const directory = useRef<HTMLDivElement>(null);
  // Searching or picking a collection swaps the rails for a grid of matches; clearing
  // both, or "Discover", brings the rails back.
  const browsing = mode === "all" || query.trim() !== "" || topic !== "all";
  function showCollection(id: string) {
    setTopic(id); setQuery(""); setMode("all");
    requestAnimationFrame(() => {
      directory.current?.focus({ preventScroll: true });
      directory.current?.scrollIntoView({ block: "start", behavior: "instant" });
    });
  }
  function discover() { setTopic("all"); setQuery(""); setMode("curated"); }
  return <div className="story-library">
    <div className="library-toolbar" ref={directory} tabIndex={-1}>
      <div className="library-filters" role="search">
        <label>Search stories<input type="search" value={query} placeholder="Wawa, flood, commute…" onChange={(event) => setQuery(event.target.value)} /></label>
        <label>Collection<select value={topic} onChange={(event) => setTopic(event.target.value)}><option value="all">All topics</option>{COLLECTIONS.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
      </div>
      {browsing && <button className="library-discover" onClick={discover}>← Discover</button>}
    </div>
    {!browsing ? <>
      <Link className="library-feature" href={featured.href} prefetch={false}>
        <div className="library-feature-copy">
          <span className="library-eyebrow">Featured</span>
          <h2>{FEATURED_HEADLINE[0]}<br />{FEATURED_HEADLINE[1]}</h2>
          <p>{storyPreview(featured)}</p>
        </div>
        <StoryCover story={featured} shot={`stories/${FEATURED_STORY}-chart`} />
      </Link>
      <StoryRail id="editors" title="Editor’s picks" stories={EDITOR_PICKS.map(storyBySlug)} />
      {COLLECTIONS.map((c) => <StoryRail key={c.id} id={c.id} title={c.title} stories={c.stories.map(storyBySlug)} viewAll={() => showCollection(c.id)} />)}
      <div className="library-end"><button onClick={() => showCollection("all")}>See all {LIBRARY_STORIES.length} stories</button></div>
    </> : <section className="library-directory" aria-labelledby="library-directory-heading">
      <h2 id="library-directory-heading">{query.trim() ? `Results for “${query.trim()}”` : topic === "all" ? "All stories" : COLLECTIONS.find((c) => c.id === topic)?.title}</h2>
      <p className="library-result-count" role="status">{results.length} {results.length === 1 ? "story" : "stories"}{query ? ` matching “${query}”` : ""}</p>
      {results.length ? <ul className="library-grid">{results.map((story) => <li key={story.href}><StoryCard story={story} /></li>)}</ul> : <div className="library-empty"><p>No matches. Try another search or collection.</p><button onClick={() => { setQuery(""); setTopic("all"); setMode("all"); }}>Show all stories</button></div>}
    </section>}
  </div>;
}
