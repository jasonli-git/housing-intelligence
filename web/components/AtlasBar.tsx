import Link from "next/link";

import { HoverMenu } from "@/components/HoverMenu";
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
const item = (href: string, name: string) => <Link className="bar-menu-item" href={href}><b>{name}</b></Link>;

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
      <HoverMenu className="atlas-bar-menu">
        <summary><span className="bar-menu-icon" aria-hidden="true"><i /><i /></span><span className="atlas-bar-menu-word">Menu</span></summary>
        <div className="atlas-bar-menu-panel">
          <div className="atlas-bar-menu-search"><PlaceSearch /></div>
          <span className="bar-menu-group">Explore</span>
          {item("/", "Home")}
          {item("/compare", "Compare")}
          {item("/stories", "Stories")}
          <span className="bar-menu-group">Tools</span>
          {item("/tax", "Property tax lookup")}
          <span className="bar-menu-group">About this data</span>
          <a className="bar-menu-item" href="#site-foot"><b>Sources &amp; notices</b></a>
          <div className="atlas-bar-menu-licence"><LicenceLine /></div>
        </div>
      </HoverMenu>
      <ThemeToggle />
    </nav>
  );
}
