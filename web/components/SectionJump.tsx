"use client";

import { useEffect, useState } from "react";

const SECTIONS = [
  ["Costs to own & rent", ".region-standard-content > .cost, #quiet-cost"],
  ["For your household", ".region-standard-content > .household, .quiet-disclosure .household"],
  ["Highlights & rankings", ".region-standard-content > .consumer-feature-what_stands_out, .region-standard-content > .standouts-disclosure, #quiet-highlights"],
  ["Before choosing a home", "#home-checks-heading"],
  ["Local market", "#local-market-heading"],
  ["Explore the evidence", "#region-detailed-data"],
  ["Statewide overview", "#state-overview"],
  ["State profile", ".nj-page > .state-ticker, .nj-page .quiet-state-profile"],
  ["Find your place", "#nj-explore"],
  ["Compare counties", "#county-comparison"],
  ["Housing help", "#housing-assistance"],
  ["Statewide evidence", "#state-detailed-data"],
] as const;

/** Only offer sections actually present on this page, including thinner profiles. */
export function SectionJump() {
  const [sections, setSections] = useState<(typeof SECTIONS)[number][]>([]);
  const [current, setCurrent] = useState("");
  useEffect(() => {
    const present = SECTIONS.filter(([, selector]) => document.querySelector(selector));
    setSections(present);
    const update = () => {
      const bar = document.querySelector(".bar")?.getBoundingClientRect().bottom ?? 0;
      const visible = present.map(([label, selector]) => ({ label, target: document.querySelector<HTMLElement>(selector) }))
        .filter(item => item.target?.getClientRects().length)
        .sort((a, b) => a.target!.getBoundingClientRect().top - b.target!.getBoundingClientRect().top);
      setCurrent(visible.filter(item => item.target!.getBoundingClientRect().top <= bar + 100).at(-1)?.label ?? "");
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <span className="section-jump-control">
    <svg className="section-jump-mark" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M7 5h9M7 10h9M7 15h9M3 5h.5M3 10h.5M3 15h.5" />
    </svg>
    <select className="section-jump" aria-label="Jump to section" defaultValue="" disabled={!sections.length}
      onFocus={() => setSections(SECTIONS.filter(([, selector]) => {
        const target = document.querySelector(selector);
        return target && (target.getClientRects().length || target.closest("details")) && getComputedStyle(target).visibility !== "hidden";
      }))}
      onChange={(event) => {
        const target = document.querySelector<HTMLElement>(event.currentTarget.value);
        // County tools may live in native disclosures. Reveal their ancestors before
        // measuring or focusing, so the shortcut still reaches a closed section.
        for (let parent = target?.parentElement; parent; parent = parent.parentElement) {
          if (parent instanceof HTMLDetailsElement) parent.open = true;
        }
        if (target?.getClientRects().length && getComputedStyle(target).visibility !== "hidden") {
          if (target instanceof HTMLDetailsElement) target.open = true;
          const focus = target.querySelector<HTMLElement>("h2, summary") ?? target;
          if (!focus.hasAttribute("tabindex")) focus.tabIndex = -1;
          focus.focus({ preventScroll: true });
          const bar = document.querySelector(".bar")?.getBoundingClientRect().bottom ?? 0;
          window.scrollTo({ top: Math.max(0, target.getBoundingClientRect().top + window.scrollY - bar - 16),
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
        }
        event.currentTarget.value = "";
      }}>
      <option value="" disabled>{current ? "On this page · " + current : "On this page"}</option>
      {sections.map(([label, selector]) => <option key={selector} value={selector}>{label}</option>)}
    </select>
    <svg className="section-jump-chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="m6 8 4 4 4-4" /></svg>
    </span>
  );
}
