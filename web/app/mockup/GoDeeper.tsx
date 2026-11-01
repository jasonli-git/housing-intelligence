"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { ThemedShot } from "@/components/ThemedShot";
import styles from "./poster.module.css";

export type DeepStory = { topic: string; title: string; headline: string; source: string; href: string; slug: string; group: string };
const GROUPS = ["All", "Money", "Homes", "People", "Surroundings"];

/** The town's stories as the Visual Stories page shows them: covers, filters, search and a rail. */
export function GoDeeper({ name, stories }: { name: string; stories: DeepStory[] }) {
  const [group, setGroup] = useState("All");
  const [query, setQuery] = useState("");
  const track = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  const shown = useMemo(() => {
    const words = query.trim().toLowerCase();
    return stories.filter((story) => (group === "All" || story.group === group) && (!words || `${story.title} ${story.headline}`.toLowerCase().includes(words)));
  }, [stories, group, query]);
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const measure = () => setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => { el.removeEventListener("scroll", measure); observer.disconnect(); };
  }, [shown.length]);
  const move = (direction: number) => track.current?.scrollBy({ left: direction * track.current.clientWidth * 0.85, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });

  return <>
    <div className={styles.deepHead}>
      <h2>Go deeper on {name}</h2>
      <Link href="/stories">All visual stories</Link>
    </div>
    <div className={styles.deepTools}>
      <div role="group" aria-label="Story topics" className={styles.chips}>{GROUPS.map((item) => <button key={item} type="button" aria-pressed={group === item} onClick={() => setGroup(item)}>{item}</button>)}</div>
      <input type="search" aria-label={`Search stories about ${name}`} placeholder="Search stories" value={query} onChange={(event) => setQuery(event.target.value)} />
    </div>
    {shown.length === 0 ? <p className={styles.caption}>No stories match.</p> : <div className={styles.deepRail}>
      <button type="button" aria-label="Previous stories" disabled={edges.start} onClick={() => move(-1)}>‹</button>
      <ul ref={track} aria-label={`Stories about ${name}`}>
        {shown.map((story) => <li key={story.topic}><Link href={story.href} prefetch={false}>
          <ThemedShot name={`stories/${story.slug}`} width={1440} height={900} className={styles.deepCover} />
          <span>{story.title}</span><strong>{story.headline}</strong><small>{story.source}</small>
        </Link></li>)}
      </ul>
      <button type="button" aria-label="Next stories" disabled={edges.end} onClick={() => move(1)}>›</button>
    </div>}
  </>;
}
