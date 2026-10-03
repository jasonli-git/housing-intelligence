"use client";

import { useEffect, useState } from "react";

const SECTIONS = [
  ["Costs to own & rent", ".region-standard-content > .cost"],
  ["For your household", ".region-standard-content > .household"],
  ["Highlights & rankings", ".region-standard-content > .consumer-feature-what_stands_out, .region-standard-content > .standouts-disclosure"],
  ["Before choosing a home", "#home-checks-heading"],
  ["Local market", "#local-market-heading"],
  ["Explore the evidence", "#region-detailed-data"],
  ["State profile", ".nj-page > .state-ticker"],
  ["Map & county comparison", "#nj-explore"],
] as const;

/** Only offer sections actually present on this page, including thinner profiles. */
export function SectionJump() {
  const [sections, setSections] = useState<(typeof SECTIONS)[number][]>([]);
  useEffect(() => {
    setSections(SECTIONS.filter(([, selector]) => document.querySelector(selector)));
  }, []);

  return (
    <span className="section-jump-control">
    <svg className="section-jump-mark" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M7 5h9M7 10h9M7 15h9M3 5h.5M3 10h.5M3 15h.5" />
    </svg>
    <select className="section-jump" aria-label="Jump to section" defaultValue="" disabled={!sections.length}
      onFocus={() => setSections(SECTIONS.filter(([, selector]) => {
        const target = document.querySelector(selector);
        return target?.getClientRects().length && getComputedStyle(target).visibility !== "hidden";
      }))}
      onChange={(event) => {
        const target = document.querySelector<HTMLElement>(event.currentTarget.value);
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
      <option value="" disabled>Jump to section</option>
      {sections.map(([label, selector]) => <option key={selector} value={selector}>{label}</option>)}
    </select>
    <svg className="section-jump-chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="m6 8 4 4 4-4" /></svg>
    </span>
  );
}
