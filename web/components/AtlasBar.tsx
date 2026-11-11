import Link from "next/link";

import { LicenceLine } from "@/components/LicenceLine";
import { PlaceSearch } from "@/components/PlaceSearch";
import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * The housing atlas's own bar, in place of the site bar (owner, 2026-11-09): the atlas is
 * a full-screen map, so its bar floats over the map as one slim strip — the way home, the
 * page's name, search, the non-commercial terms (#128), the other destinations and the
 * theme. On a phone, search and the terms move into the menu, where the strip has no room
 * for them (the menu lists every tool, as the site bar's does, #492); both are rendered twice and the stylesheet shows one of each. The site footer,
 * with the notices and sources every page must show (#137), opens from the menu as a panel
 * over the map, since a full-screen map leaves no page below it to scroll to.
 */
export function AtlasBar() {
  return (
    <nav className="atlas-bar print-hide" aria-label="Sites">
      <Link className="atlas-bar-home" href="/">
        <img src="/icon.svg" width="22" height="22" alt="" />
        <span>Housing</span>
      </Link>
      <span className="atlas-bar-sep" aria-hidden="true">/</span>
      <h1 className="atlas-bar-title">Map</h1>
      <div className="atlas-bar-search"><PlaceSearch /></div>
      <div className="atlas-bar-licence"><LicenceLine /></div>
      <details className="atlas-bar-menu">
        <summary><span className="atlas-bar-menu-word">Menu</span> <span aria-hidden="true">⌄</span></summary>
        <div className="atlas-bar-menu-panel">
          <div className="atlas-bar-menu-search"><PlaceSearch /></div>
          <Link href="/">Home</Link>
          <Link href="/compare">Compare places</Link>
          <Link href="/stories">Stories</Link>
          <Link href="/guide">Buyer’s guide</Link>
          <Link href="/tax">Property tax lookup</Link>
          <Link href="/affordable-housing">Affordable housing records</Link>
          <Link href="/help">Housing help</Link>
          <a href="#site-foot">Sources &amp; notices</a>
          <div className="atlas-bar-menu-licence"><LicenceLine /></div>
        </div>
      </details>
      <ThemeToggle />
    </nav>
  );
}
