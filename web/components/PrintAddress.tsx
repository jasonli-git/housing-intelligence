"use client";

import { useEffect, useState } from "react";

import { cssString } from "@/lib/print";

/**
 * The address of the page being printed, in the bottom-right margin box of every sheet
 * (see `PrintFooter`). Read in the browser, because the static pages are built without
 * knowing the origin they are served from.
 */
export function PrintAddress() {
  const [address, setAddress] = useState<string | null>(null);
  useEffect(() => {
    setAddress(window.location.href.replace(/^https?:\/\//, ""));
  }, []);
  if (!address) return null;
  return (
    <style>{`@media print {
  @page {
    @bottom-right {
      content: ${cssString(address)};
      font: 7pt/1.3 ui-monospace, monospace; color: #000; vertical-align: top;
      padding-top: 3mm;
    }
  }
}`}</style>
  );
}
