"use client";

import Link from "next/link";
import { useId, useState } from "react";
import styles from "./ExplorationResearch.module.css";

type Destination = { id: number; name: string; href: string; label?: string };
/** Filter the complete directory, including destinations beyond the initial preview. */
export function PlaceDirectory({ id, title, destinations, preview = 6, className }: { id: string; title: string; destinations: Destination[];
  /** How many places show before "Show all". */
  preview?: number; className?: string }) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  if (!destinations.length) return null;
  const matches = [...destinations].sort((a,b) => a.name.localeCompare(b.name)).filter(place => place.name.toLowerCase().includes(query.trim().toLowerCase()));
  return <nav className={`${styles.directory}${className ? ` ${className}` : ""}`} id={id} aria-label={title} data-jump-label={title}>
    <div className={styles.directoryHead}>
      <h2>{title}</h2>
      <label htmlFor={inputId}>Find a place<input id={inputId} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Filter by name" /></label>
    </div>
    <p className={styles.count} role="status">{matches.length} of {destinations.length} places</p>
    <ul>{matches.map((place,index) => <li key={place.id} className={!query.trim() && !expanded && index >= preview ? styles.extra : undefined}><Link href={place.href} aria-label={place.label}>{place.name}<span aria-hidden="true">→</span></Link></li>)}</ul>
    {!matches.length && <p>No matching places. Try a shorter name or clear the search.</p>}
    {!query.trim() && matches.length > preview && <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? "Show fewer places" : `Show all ${matches.length} places`}</button>}
  </nav>;
}
