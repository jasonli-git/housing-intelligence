import Link from "next/link";

import { HoverMenu } from "@/components/HoverMenu";
import { BarSearchReveal } from "@/components/BarSearchReveal";
import { PlaceSearch } from "@/components/PlaceSearch";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { AffordabilityControl } from "@/components/HousingModeToggle";
import { LicenceLine } from "@/components/LicenceLine";


/**
 * The site's bar, the same on every page (#461): wordmark, the three main destinations,
 * search, the non-commercial terms (#128) and the theme button (#292). Every rule for it
 * lives in `app/site-bar.css`.
 *
 * One Menu, at every width, lists every destination: the three main ones and the four
 * tools the bar dropped on 2026-11-03 (#492). A tool page passes `title`, and the bar then
 * carries the page's name as its heading, as the housing map's own bar does (#479), in
 * place of the three inline links and of a title block above the tool.
 */
export function Masthead({
  compareActive = false,
  atlasActive = false,
  taxActive = false,
  guideActive = false,
  helpActive = false,
  recordsActive = false,
  calculatorActive = false,
  affordability,
  title,
  search = true,
}: {
  affordability: AffordabilityControl;
  /** On the property-tax lookup itself, whose link the bar marks as the current page. */
  taxActive?: boolean;
  /** On the buyer's guide itself. */
  guideActive?: boolean;
  helpActive?: boolean;
  recordsActive?: boolean;
  calculatorActive?: boolean;
  atlasActive?: boolean;
  /** On the compare page. */
  compareActive?: boolean;
  /** A tool page's name, shown in the bar as the page's `h1`. */
  title?: string;
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
  const current = (on: boolean) => (on ? "page" as const : undefined);
  // MOCK (2026-11-11): the Menu as a grouped panel.
  const item = (href: string, name: string, on = false) => <Link className="bar-link bar-menu-item" href={href} aria-current={current(on)}><b>{name}</b></Link>;
  const toolLinks = <>
    <span className="bar-menu-group">Tools</span>
    {item("/guide", "Buyer’s guide", guideActive)}
    {item("/calculator", "Cost calculator", calculatorActive)}
    {item("/tax", "Property tax lookup", taxActive)}
    {item("/affordable-housing", "Affordable housing records", recordsActive)}
    {item("/help", "Housing help", helpActive)}
  </>;
  const menuMain = <>
    <span className="bar-menu-group">Explore</span>
    {item("/atlas", "Map", atlasActive)}
    {item("/compare", "Compare", compareActive)}
    {item("/stories", "Stories")}
  </>;
  return (
    <>
    <nav className="bar print-hide" aria-label="Sites">
      <div className="bar-inner">
        <div className="bar-trail">
          <Link className="wordmark" href="/">
            <img className="housing-mark" src="/icon.svg" width="24" height="24" alt="" />
            <span className="wordmark-text">Housing</span>
          </Link>
        </div>
        <div className="bar-controls bar-desktop-tools">{primaryLinks}</div>
        <HoverMenu className="bar-tool-menu">
          <summary><span className="bar-menu-icon" aria-hidden="true"><i /><i /></span>Menu</summary>
          <div className="bar-controls"><span className="bar-menu-main">{menuMain}</span>{toolLinks}</div>
        </HoverMenu>
        {search === true ? <PlaceSearch /> : search ? <BarSearchReveal target={search.after}><PlaceSearch /></BarSearchReveal> : null}
        {/* The non-commercial terms (#128) ride in the bar now, still on every page. */}
        <LicenceLine />
        <ThemeToggle />
      </div>
    </nav>
    {/* MOCK (2026-11-11): one bar on every page; a tool's name is the page's heading. */}
    {title && <header className="tool-head"><h1>{title}</h1></header>}
    </>
  );
}
