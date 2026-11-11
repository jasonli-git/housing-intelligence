"use client";
import { useEffect } from "react";

/** #497: old `/help?q=<town>` links (place pages, shared) land on the records lookup. */
export function HelpRedirect() {
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) window.location.replace(`/affordable-housing?town=${encodeURIComponent(q)}`);
  }, []);
  return null;
}
