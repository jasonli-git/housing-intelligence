import Link from "next/link";

import { BarSearchReveal } from "@/components/BarSearchReveal";
import { PlaceSearch } from "@/components/PlaceSearch";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { AffordabilityControl } from "@/components/HousingModeToggle";
import { LicenceLine } from "@/components/LicenceLine";


/**
 * The site's bar, the same on every page (#461): wordmark, the three main destinations,
 * search, the non-commercial terms (#128) and the theme button (#292). The Tools menu and
 * the code link left it on 2026-11-03; the tools are in the footer, and the props that
 * marked the current tool stay so they can come back without touching every page. Every
 * rule for it lives in `app/site-bar.css`.
 */
export function Masthead({
  compareActive = false,
  atlasActive = false,
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
  // Below 1100px the three destinations move under one Menu button.
  const primaryLinks = <>
    <Link className="bar-link" href="/atlas" aria-current={atlasActive ? "page" : undefined}>Map</Link>
    <Link className="bar-link" href="/compare" aria-label="Compare places" aria-current={compareActive ? "page" : undefined}>Compare</Link>
    <Link className="bar-link" href="/stories">Stories</Link>
  </>;
  return (
    <nav className="bar print-hide" aria-label="Sites">
      <div className="bar-inner">
        <div className="bar-trail">
          <Link className="wordmark" href="/">
            <img className="housing-mark" src="/icon.svg" width="24" height="24" alt="" />
            <span className="wordmark-text">Housing</span>
          </Link>
        </div>
        <div className="bar-controls bar-desktop-tools">{primaryLinks}</div>
        <details className="bar-tool-menu">
          <summary>Menu <span aria-hidden="true">⌄</span></summary>
          <div className="bar-controls">{primaryLinks}</div>
        </details>
        {search === true ? <PlaceSearch /> : search ? <BarSearchReveal target={search.after}><PlaceSearch /></BarSearchReveal> : null}
        {/* The non-commercial terms (#128) ride in the bar now, still on every page. */}
        <LicenceLine />
        <ThemeToggle />
      </div>
    </nav>
  );
}
