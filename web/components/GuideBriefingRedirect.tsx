"use client";
import { useEffect } from "react";

/** #498: `/guide/briefing` links (from the mock) land on `/guide`, keeping `?place=`. */
export function GuideBriefingRedirect() {
  useEffect(() => { window.location.replace(`/guide${window.location.search}`); }, []);
  return <p className="meta">Opening the Buyer’s guide… <a href="/guide">Go now</a></p>;
}
