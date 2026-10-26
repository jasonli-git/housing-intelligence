"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import styles from "./PlaceSectionNav.module.css";

export type PlaceSection = { id: string; label: string };

/** One set of destinations for desktop anchors, the phone picker and scroll position. */
export function PlaceSectionNav({ sections }: { sections: PlaceSection[] }) {
  const nav = useRef<HTMLElement>(null);
  const [available, setAvailable] = useState(sections);
  const [current, setCurrent] = useState(sections[0]?.id ?? "");

  useEffect(() => {
    let frame = 0;
    const update = () => {
      const bar = document.querySelector(".bar")?.getBoundingClientRect().height ?? 0;
      nav.current?.style.setProperty("--place-nav-top", `${bar}px`);
      const offset = bar + (nav.current?.getBoundingClientRect().height ?? 0) + 24;
      const present = sections.filter(section => {
        const target = document.getElementById(section.id);
        return target && getComputedStyle(target).display !== "none";
      });
      setAvailable(previous => previous.map(s => s.id).join() === present.map(s => s.id).join() ? previous : present);
      const passed = present.filter(section => {
        const target = document.getElementById(section.id)!;
        return target.getClientRects().length && target.getBoundingClientRect().top <= offset;
      });
      setCurrent(passed.at(-1)?.id ?? present[0]?.id ?? "");
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
    update();
    // Any deep link but main itself: the skip link's #main-content must leave focus on
    // main, not move it to the page's first heading.
    const followHash = () => {
      const id = location.hash.slice(1);
      if (id && !(document.getElementById(id) instanceof HTMLElement && document.getElementById(id)!.tagName === "MAIN")) go(id, false);
    };
    followHash();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("hashchange", followHash);
    const resize = new ResizeObserver(schedule);
    if (nav.current) resize.observe(nav.current);
    const bar = document.querySelector(".bar");
    if (bar) resize.observe(bar);
    // The shared source footer may finish streaming after the main page hydrates.
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("hashchange", followHash);
      resize.disconnect();
      observer.disconnect();
    };
  }, [sections]);

  function go(id: string, recordHistory = true) {
    const target = document.getElementById(id);
    if (!target) return;
    if (target instanceof HTMLDetailsElement) target.open = true;
    for (let parent = target.parentElement; parent; parent = parent.parentElement) {
      if (parent instanceof HTMLDetailsElement) parent.open = true;
    }
    const focus = target instanceof HTMLDetailsElement ? target.querySelector<HTMLElement>(":scope > summary") ?? target : target.matches("h1,h2,h3,summary") ? target : target.querySelector<HTMLElement>("h1,h2,h3,summary") ?? target;
    if (!focus.hasAttribute("tabindex")) focus.tabIndex = -1;
    focus.focus({ preventScroll: true });
    const offset = (document.querySelector(".bar")?.getBoundingClientRect().height ?? 0)
      + (nav.current?.getBoundingClientRect().height ?? 0) + 16;
    if (recordHistory && location.hash !== `#${id}`) history.pushState(null, "", `#${id}`);
    window.scrollTo({ top: Math.max(0, target.getBoundingClientRect().top + window.scrollY - offset),
      behavior: !recordHistory || window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    if (sections.some(section => section.id === id)) setCurrent(id);
  }

  function follow(event: MouseEvent<HTMLAnchorElement>, id: string) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    event.preventDefault();
    go(id);
  }

  return <nav ref={nav} className={styles.navigation} aria-label="Place sections">
    <div className={styles.links}>{available.map(section => <a key={section.id} href={`#${section.id}`}
      aria-current={current === section.id ? "location" : undefined} onClick={event => follow(event, section.id)}>{section.label}</a>)}</div>
    <label className={styles.picker}><span>On this page</span><select aria-label="Jump to a place section" value={current}
      onChange={event => go(event.target.value)}>{available.map(section => <option key={section.id} value={section.id}>{section.label}</option>)}</select></label>
  </nav>;
}
