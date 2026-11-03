import Link from "next/link";

import { BarSearchReveal } from "@/components/BarSearchReveal";
import { PlaceSearch } from "@/components/PlaceSearch";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { AffordabilityControl } from "@/components/HousingModeToggle";
import { LicenceLine } from "@/components/LicenceLine";

const REPOSITORY = "https://github.com/jasonli-git/housing-intelligence";

/**
 * The site's bar, the same on every page (#461): wordmark and code link, the four main
 * destinations, a Tools menu, search, the non-commercial terms (#128) and the theme
 * button (#292). Every rule for it lives in `app/site-bar.css`.
 */
export function Masthead({
  affordability,
  taxActive = false,
  guideActive = false,
  helpActive = false,
  atlasActive = false,
  compareActive = false,
  search = true,
}: {
  affordability: AffordabilityControl;
  /** On the property-tax lookup itself, whose link the bar marks as the current page. */
  taxActive?: boolean;
  /** On the buyer's guide itself. */
  guideActive?: boolean;
  helpActive?: boolean;
  atlasActive?: boolean;
  /** On the compare page. */
  compareActive?: boolean;
  /** On the home page, a selector for its own large search: the bar's appears only once
   *  the reader has scrolled past it. False leaves the bar without one. */
  search?: boolean | { after: string };
}) {
  // One menu on every page (#461): three destinations in the bar, the tools under one
  // button. Below 1100px the three move into that button too.
  const primaryLinks = <>
    <Link className="bar-link" href="/atlas" aria-current={atlasActive ? "page" : undefined}>Map</Link>
    <Link className="bar-link" href="/compare" aria-label="Compare places" aria-current={compareActive ? "page" : undefined}>Compare</Link>
    <Link className="bar-link" href="/stories">Charts</Link>
  </>;
  const toolLinks = <>
    {affordability.kind === "hidden" ? null : affordability.kind === "disabled" ?
      <button className="bar-budget" type="button" disabled title={affordability.reason} aria-label={`Budget. ${affordability.reason}`}>Budget</button> :
      <Link className="bar-budget" href="/afford?county=all" aria-current={affordability.kind === "route" && affordability.active ? "page" : undefined} aria-label="Find places within my budget across all New Jersey">Budget</Link>}
    <Link className="bar-link" href="/guide" aria-current={guideActive ? "page" : undefined}>Buyer’s guide</Link>
    <Link className="bar-link" href="/tax" aria-current={taxActive ? "page" : undefined}>Property tax</Link>
    <Link className="bar-link" href="/help" aria-current={helpActive ? "page" : undefined}>Housing help</Link>
  </>;
  return (
    <nav className="bar print-hide" aria-label="Sites">
      <div className="bar-inner">
        <div className="bar-trail">
          <Link className="wordmark" href="/">
            <img className="housing-mark" src="/icon.svg" width="24" height="24" alt="" />
            <span className="wordmark-text">Housing</span>
          </Link>
          <a
            className="bar-icon"
            href={REPOSITORY}
            rel="noreferrer noopener"
            target="_blank"
            title="The code behind this site, on GitHub"
            aria-label="The code behind this site, on GitHub (opens in a new tab)"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
          </a>
        </div>
        <div className="bar-controls bar-desktop-tools">{primaryLinks}</div>
        <details className="bar-tool-menu">
          <summary><span className="bar-menu-wide">Tools</span><span className="bar-menu-narrow">Menu</span> <span aria-hidden="true">⌄</span></summary>
          <div className="bar-controls">
            <div className="bar-menu-primary">{primaryLinks}</div>
            {toolLinks}
          </div>
        </details>
        {search === true ? <PlaceSearch /> : search ? <BarSearchReveal target={search.after}><PlaceSearch /></BarSearchReveal> : null}
        {/* The non-commercial terms (#128) ride in the bar now, still on every page. */}
        <LicenceLine />
        <ThemeToggle />
      </div>
    </nav>
  );
}
