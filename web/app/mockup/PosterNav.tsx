"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./poster.module.css";

/** Every part of the page by what it answers, staying under the masthead and marking the one being read. */
export function PosterNav({ links }: { links: { id: string; label: string }[] }) {
  const [active, setActive] = useState(links[0]?.id);
  const bar = useRef<HTMLElement>(null);
  const heldUntil = useRef(0);
  useEffect(() => {
    const read = () => {
      if (Date.now() < heldUntil.current) return;
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
  // On a phone the bar scrolls sideways, so the current link is kept in view.
  useEffect(() => {
    const el = bar.current, link = el?.querySelector<HTMLElement>("[aria-current]");
    if (el && link) el.scrollTo({ left: link.offsetLeft - (el.clientWidth - link.offsetWidth) / 2, behavior: "smooth" });
  }, [active]);
  return <nav ref={bar} className={styles.topics} aria-label="On this page">
    {links.map(({ id, label }) => <a key={id} href={`#${id}`} aria-current={active === id ? "location" : undefined} onClick={() => { heldUntil.current = Date.now() + 900; setActive(id); }}>{label}</a>)}
  </nav>;
}
