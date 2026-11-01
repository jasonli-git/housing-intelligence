"use client";

import { useEffect, useState } from "react";

import styles from "./poster.module.css";

/** The page's few sections, staying under the masthead and marking the one being read. */
export function PosterNav({ links }: { links: { id: string; label: string }[] }) {
  const [active, setActive] = useState(links[0]?.id);
  useEffect(() => {
    const read = () => {
      const line = 140;
      // Panels sharing a row share a top, and the earlier one is the row's lead.
      const tops = links.map(({ id }) => ({ id, top: document.getElementById(id)?.getBoundingClientRect().top ?? Infinity })).filter(({ top }) => top <= line);
      const nearest = Math.max(...tops.map(({ top }) => top));
      setActive(tops.find(({ top }) => top === nearest)?.id ?? links[0]?.id);
    };
    read();
    window.addEventListener("scroll", read, { passive: true });
    return () => window.removeEventListener("scroll", read);
  }, [links]);
  return <nav className={styles.topics} aria-label="On this page">
    {links.map(({ id, label }) => <a key={id} href={`#${id}`} aria-current={active === id ? "location" : undefined}>{label}</a>)}
  </nav>;
}
