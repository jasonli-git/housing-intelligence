"use client";

import { useEffect, useState } from "react";

const SECTIONS = [
  ["Housing at a glance", ".atlas-local > .quiet-profile"],
  ["Costs to own & rent", ".region-standard-content > .cost, #quiet-cost, .report > .cost"],
  ["Your household & plans", ".quiet-tool-group, .region-standard-content > .household"],
  ["Highlights & rankings", ".region-standard-content > .consumer-feature-what_stands_out, .region-standard-content > .standouts-disclosure, #quiet-highlights"],
  ["Before choosing a home", "#home-checks-heading"],
  ["Local market", "#local-market-heading"],
  ["Is this unusual here?", "#how-unusual-heading"],
  ["Who is moving here", "#who-is-moving-heading"],
  ["Explore the evidence", "#region-detailed-data"],
  ["Statewide overview", "#state-overview"],
  ["State profile", ".nj-page > .state-ticker, .nj-page .quiet-state-profile"],
  ["Find your place", "#nj-explore"],
  ["Compare counties", "#county-comparison"],
  ["Housing help", "#housing-assistance"],
  ["Statewide evidence", "#state-detailed-data"],
  ["Choose a place", "#guide-place-heading"],
  ["Your household", "#guide-household-heading"],
  ["Can I afford to buy?", "#guide-afford-heading"],
  ["Rent or buy?", "#guide-rent-heading"],
  ["Before an offer", "#guide-checks-heading"],
  ["Your budget", ".budget-explorer > .afford-controls"],
  ["Check one place", ".budget-place-check"],
  ["Compare places", ".budget-comparison"],
  ["Towns within reach", ".budget-town-results"],
] as const;

type Destination = { label: string; selector: string; target: HTMLElement };

/** Include closed native disclosures, but never CSS-hidden alternate page modes. */
function available(target: HTMLElement): boolean {
  for (let node: HTMLElement | null = target; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (node.hidden || style.display === "none" || style.visibility === "hidden") return false;
  }
  return true;
}

export function pageDestinations(): Destination[] {
  const main = document.querySelector("main") ?? document;
  const found: Destination[] = [];
  for (const [label, selector] of SECTIONS) {
    const target = main.querySelector<HTMLElement>(selector);
    if (label === "Is this unusual here?" && target?.closest("#local-price-history")) continue;
    if (target && available(target)) found.push({ label, selector, target });
  }
  for (const target of main.querySelectorAll<HTMLElement>("[data-jump-label][id], .legal-page > section > h2[id]")) {
    const label = target.dataset.jumpLabel ?? target.textContent;
    if (label && available(target)) found.push({ label, selector: `[id="${target.id}"]`, target });
  }
  return found.filter((item, i) => found.findIndex(other => other.target === item.target) === i)
    .sort((a, b) => a.target.compareDocumentPosition(b.target) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
}

/** Native select, keyboard-friendly focus transfer, and the page's reading order. */
export function SectionJump() {
  const [sections, setSections] = useState<Destination[]>([]);
  const [current, setCurrent] = useState("");
  useEffect(() => {
    let frame = 0;
    let present: Destination[] = [];
    const updateCurrent = () => {
      const bar = document.querySelector(".bar")?.getBoundingClientRect().bottom ?? 0;
      setCurrent(present.filter(s => s.target.getClientRects().length && s.target.getBoundingClientRect().top <= bar + 100).at(-1)?.label ?? "");
    };
    const refresh = () => {
      present = pageDestinations();
      setSections(previous => previous.length === present.length && previous.every((s, i) =>
        s.target === present[i].target && s.label === present[i].label && s.selector === present[i].selector) ? previous : present);
      updateCurrent();
    };
    const scheduleCurrent = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updateCurrent);
    };
    refresh();
    window.addEventListener("scroll", scheduleCurrent, { passive: true });
    window.addEventListener("resize", refresh);
    document.addEventListener("toggle", refresh, true);
    const observer = new MutationObserver(refresh);
    const main = document.querySelector("main");
    if (main) observer.observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", scheduleCurrent);
      window.removeEventListener("resize", refresh);
      document.removeEventListener("toggle", refresh, true);
    };
  }, []);

  return (
    <span className="section-jump-control">
    <svg className="section-jump-mark" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M7 5h9M7 10h9M7 15h9M3 5h.5M3 10h.5M3 15h.5" />
    </svg>
    <select className="section-jump" aria-label="Jump to section" defaultValue="" disabled={!sections.length}
      onFocus={() => setSections(pageDestinations())}
      onChange={(event) => {
        const selected = sections.find(s => s.selector === event.currentTarget.value);
        const target = selected?.target;
        // County tools may live in native disclosures. Reveal their ancestors before
        // measuring or focusing, so the shortcut still reaches a closed section.
        if (target?.isConnected && available(target)) {
          for (let parent = target.parentElement; parent; parent = parent.parentElement) {
            if (parent instanceof HTMLDetailsElement) parent.open = true;
          }
          if (target instanceof HTMLDetailsElement) target.open = true;
          const focus = target.matches("h2, h3, summary") ? target : target.querySelector<HTMLElement>("h2, h3, summary") ?? target;
          if (!focus.hasAttribute("tabindex")) focus.tabIndex = -1;
          focus.focus({ preventScroll: true });
          const bar = document.querySelector(".bar")?.getBoundingClientRect().bottom ?? 0;
          window.scrollTo({ top: Math.max(0, target.getBoundingClientRect().top + window.scrollY - bar - 20),
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
        }
        event.currentTarget.value = "";
      }}>
      <option value="" disabled>{current ? "On this page · " + current : "Jump to a section"}</option>
      {sections.map(({ label, selector }) => <option key={selector} value={selector}>{label}</option>)}
    </select>
    <svg className="section-jump-chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="m6 8 4 4 4-4" /></svg>
    </span>
  );
}
