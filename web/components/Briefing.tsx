"use client";

/**
 * A town's briefing as a deck (#498, #511; a town's own page since Milestone 62,
 * ARCHITECTURE #520). The slides are built on the server (`briefingSlides.tsx`) and arrive
 * as props, so every slide's text is in the page's HTML; this only moves between them, by
 * arrow keys, buttons, the progress bar or a sideways swipe, with speaker notes and full
 * screen.
 *
 * A Full page | Briefing switch sits on every slide. An address with a section anchor
 * (`/nj/hoboken#tax`) was written for the full page, which held that address until
 * Milestone 62, so it is sent there.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Slide } from "./briefingSlides";

export function Briefing({ name, slides, fullHref }: { name: string; slides: Slide[]; fullHref: string }) {
  const [i, setI] = useState(0);
  const [notes, setNotes] = useState(false);
  const [full, setFull] = useState(false);
  const touch = useRef<[number, number] | null>(null);
  // Presentation mode covers the window itself, and also asks the browser for true full
  // screen where it allows it (an embedded or locked-down browser may refuse silently).
  const fullNow = useRef(false);
  const toggleFull = useCallback(() => {
    const on = !fullNow.current;
    fullNow.current = on;
    setFull(on);
    if (on) void document.documentElement.requestFullscreen?.().catch(() => {});
    else if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  }, []);
  useEffect(() => {
    const change = () => { if (!document.fullscreenElement) { fullNow.current = false; setFull(false); } };
    document.addEventListener("fullscreenchange", change); return () => document.removeEventListener("fullscreenchange", change);
  }, []);
  useEffect(() => {
    document.documentElement.style.overflow = full ? "hidden" : "";
    return () => { document.documentElement.style.overflow = ""; };
  }, [full]);

  useEffect(() => {
    const toFull = () => {
      const { hash } = window.location;
      if (!hash || hash === "#main-content") return false;
      window.location.replace(`${fullHref}${hash}`);
      return true;
    };
    window.addEventListener("hashchange", toFull);
    if (!toFull()) {
      // ?slide=N opens the deck at slide N, so a link can point at one slide.
      const n = Number(new URLSearchParams(window.location.search).get("slide"));
      if (Number.isInteger(n) && n > 1) setI(Math.min(n, slides.length) - 1);
    }
    return () => window.removeEventListener("hashchange", toFull);
  }, [fullHref, slides.length]);

  const go = useCallback((n: number) => setI((cur) => Math.max(0, Math.min(slides.length - 1, cur + n))), [slides.length]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") { e.preventDefault(); go(1); }
      if (e.key === "ArrowLeft" || e.key === "PageUp") go(-1);
      if (e.key === "f" || e.key === "F") toggleFull();
      if (e.key === "Escape") { fullNow.current = false; setFull(false); }
      if (e.key === "n" || e.key === "N") setNotes((v) => !v);
    };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, [go, toggleFull]);

  const s = slides[i];
  const sections = [...new Set(slides.map((x) => x.section))];
  return <section className="bf-deck" data-full={full} data-notes={notes} aria-roledescription="slideshow" aria-label={`Briefing: ${name}`}>
    <header className="bf-top">
      <span><b>{name}</b><span className="bf-word"> briefing</span></span>
      <nav className="bf-views" aria-label="View"><Link href={fullHref}>Full page</Link><span aria-current="page">Briefing <small>{slides.length} slides</small></span></nav>
    </header>
    {/* Each step names its slide's conclusion, so the whole briefing reads as a list too. */}
    <ol className="bf-progress" aria-label="Slides" style={{ gridTemplateColumns: `repeat(${slides.length}, 1fr)` }}>{slides.map((x, n) => <li key={x.key}><button type="button" aria-current={n === i ? "step" : undefined} data-flag={x.flagged} onClick={() => setI(n)} title={x.kicker}><span className="visually-hidden">{x.kicker}: {x.headline}</span></button></li>)}</ol>
    <div className="bf-frame">
    <article className="bf-slide" data-plain={s.plain} key={s.key} onTouchStart={(e) => { touch.current = [e.touches[0].clientX, e.touches[0].clientY]; }} onTouchEnd={(e) => {
      // A sideways swipe moves a slide; an upward scroll is left alone.
      const [x0, y0] = touch.current ?? [0, 0]; touch.current = null;
      const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
    }} aria-roledescription="slide" aria-label={`${i + 1} of ${slides.length}: ${s.kicker}`}>
      <nav className="bf-sections" aria-hidden="true">{sections.map((x) => <span key={x} data-on={x === s.section}>{x}</span>)}</nav>
      <p className="bf-kicker">{s.kicker}{s.flagged && <em>Worth a closer look</em>}</p>
      <h2 className="bf-headline">{s.headline}</h2>
      <div className="bf-main">
        {s.figure && <div className="bf-figure"><b>{s.figure.value}</b><span>{s.figure.label}</span>{s.standing && <small className="bf-standing" data-mark={s.standing.mark}>{s.standing.words}</small>}{s.figure.versus && <small className="bf-versus">{s.figure.versus}</small>}</div>}
        <div className="bf-body">{s.body}</div>
      </div>
      {s.why && <p className="bf-why"><b>Context</b>{s.why}</p>}
      <footer className="bf-foot"><span>{s.source ?? ""}</span><span>{name} · {i + 1} / {slides.length}</span></footer>
    </article>
    {i === 0 && <p className="bf-swipe-hint">Swipe to move between slides</p>}
    </div>
    <nav className="bf-nav" aria-label="Slide controls">
      <button type="button" onClick={() => go(-1)} disabled={i === 0}>← Previous</button>
      <span className="bf-tools">
        <button type="button" className="bf-tool" aria-pressed={notes} onClick={() => setNotes(!notes)} title="Speaker notes (N)">Notes</button>
        <button type="button" className="bf-tool" aria-pressed={full} onClick={toggleFull} title="Full screen (F)">{full ? "Exit full screen" : "Full screen"}</button>
        <span>{i + 1} / {slides.length}</span>
      </span>
      <button type="button" className="bf-next-button" onClick={() => go(1)} disabled={i === slides.length - 1}>{i === slides.length - 1 ? "End" : `Next: ${slides[i + 1].kicker} →`}</button>
    </nav>
    {notes && <aside className="bf-notes" aria-label="Speaker notes"><b>Notes · {s.kicker}</b>{s.notes ?? <p>No notes for this slide.</p>}</aside>}
  </section>;
}
