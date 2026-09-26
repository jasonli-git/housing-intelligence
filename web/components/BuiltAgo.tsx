"use client";

import { useEffect, useState } from "react";

import { builtAgo } from "@/lib/freshness";

/**
 * "(built 3 days ago)", worked out in the reader's browser when the page is read — a
 * static page cannot know at build time how long it will be read for. Nothing is
 * rendered on the server, so there is no mismatch to hydrate over, and `data-volatile`
 * keeps it out of `check-live`'s comparison of the deployed page with the built one.
 */
export function BuiltAgo({ at }: { at: string }) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    setLabel(builtAgo(at, new Date()));
  }, [at]);

  return label ? <span data-volatile> ({label})</span> : null;
}
