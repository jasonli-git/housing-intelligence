"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { StoryCard, StoryCover } from "./StoryCard";
import { COLLECTIONS, EDITOR_PICKS, LIBRARY_STORIES, FEATURED_HEADLINE, FEATURED_STORY, findStories, storyBySlug, storyPreview, type Story } from "@/lib/storyLibrary";

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
  return <section className="library-rail" aria-labelledby={`${id}-heading`}>
    <header className="library-rail-head">
      <div><h2 id={`${id}-heading`}>{title}</h2></div>
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
      <div className="library-end"><button onClick={() => showCollection("all")}>All {LIBRARY_STORIES.length} stories ↑</button></div>
    </> : <section className="library-directory" aria-labelledby="library-directory-heading">
      <h2 id="library-directory-heading">{topic === "all" ? "All stories" : COLLECTIONS.find((c) => c.id === topic)?.title}</h2>
      <p className="library-result-count" role="status">{results.length} {results.length === 1 ? "story" : "stories"}{query ? ` matching “${query}”` : ""}</p>
      {results.length ? <ul className="library-grid">{results.map((story) => <li key={story.href}><StoryCard story={story} /></li>)}</ul> : <div className="library-empty"><p>No matches. Try another search or collection.</p><button onClick={() => { setQuery(""); setTopic("all"); setMode("all"); }}>Show all stories</button></div>}
    </section>}
  </div>;
}
