"use client";
import Link from "next/link";
import { useEffect, type MouseEvent } from "react";

function revealContext() {
  const target = document.getElementById("local-property-evidence");
  if (!target) return;
  for (let node: HTMLElement | null = target; node; node = node.parentElement) if (node instanceof HTMLDetailsElement) node.open = true;
  requestAnimationFrame(() => {
    target.querySelector<HTMLElement>("summary")?.focus({preventScroll: true});
    const bar = document.querySelector(".bar")?.getBoundingClientRect().bottom ?? 0;
    window.scrollTo({top: target.getBoundingClientRect().top + scrollY - bar - 20, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth"});
  });
}

export function LocalNextSteps({ taxHref }: { taxHref: string }) {
  useEffect(() => { if (location.hash === "#local-property-evidence") revealContext(); }, []);
  const openContext = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    history.pushState(null, "", "#local-property-evidence");
    revealContext();
  };
  const checks = [
    { title: "Confirm schools", url: "https://www.nj.gov/education/schoolperformance/", note: "Ask the district to confirm the address and grade; proximity is not assignment." },
    { title: "Check flood exposure", url: "https://flooddisclosure.nj.gov/", note: "Check the property. A mapped zone—or no recorded claim—is not the whole risk." },
    { title: "Confirm water supply", url: "https://www9.state.nj.us/DEP_WaterWatch_public/", note: "Confirm the supplier and annual report, or whether the home uses a private well." },
    { title: "Check internet", url: "https://broadbandmap.fcc.gov/", note: "Look up the address, then confirm the advertised plan with the provider." },
    { title: "Check nearby sites", url: "https://experience.arcgis.com/experience/f26272f8a41c4aeea77ac6f9b3c80ebb", note: "Use the official contaminated-sites map; area totals do not describe this property." },
  ];
  return <section id="home-checks-heading" className="home-action-checks" aria-labelledby="home-actions-title">
    <h3 id="home-actions-title">Check the actual home</h3>
    <p className="table-note">Area figures explain the place. These checks help you choose the property.</p>
    <ul><li><Link href={taxHref}>Check the tax bill ↗</Link><span>Look up its assessment and reported tax; confirm the current bill.</span></li>
      {checks.map(c => <li key={c.title}><a href={c.url} target="_blank" rel="noreferrer">{c.title} ↗</a><span>{c.note}</span></li>)}
      <li><a href="#local-property-evidence" onClick={openContext}>Check the commute & service providers ↓</a><span>Test the actual journey and confirm utilities at the address; nearby stops do not establish convenient service.</span></li>
      <li><a href="#local-property-evidence" onClick={openContext}>Find public-safety context ↓</a><span>Ask the town which department serves the address. The nearest station may not; county offence records cannot establish street-level safety.</span></li>
    </ul>
  </section>;
}
