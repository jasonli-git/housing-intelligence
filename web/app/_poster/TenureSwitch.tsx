"use client";

import { useEffect, useState } from "react";

import acts from "./acts.module.css";

export type Tenure = "buy" | "rent";

/** Runs before first paint, so a link that says `?for=rent` never flashes the buying view. */
export const TENURE_SCRIPT = `try{if(new URLSearchParams(location.search).get("for")==="rent")document.getElementById("main-content").dataset.tenure="rent"}catch(e){}`;

/** Buying or renting: which reader the header and the cost acts answer. The choice lives
 *  in the address (`?for=rent`), like Compare's places, so a link carries it and nothing
 *  is kept in the browser. Both views are in the page; CSS shows one. */
export function TenureSwitch() {
  const [tenure, setTenure] = useState<Tenure>("buy");
  useEffect(() => {
    if (document.getElementById("main-content")?.dataset.tenure === "rent") setTenure("rent");
  }, []);
  const choose = (next: Tenure) => {
    setTenure(next);
    const main = document.getElementById("main-content");
    if (main) { if (next === "rent") main.dataset.tenure = "rent"; else delete main.dataset.tenure; }
    const url = new URL(window.location.href);
    if (next === "rent") url.searchParams.set("for", "rent"); else url.searchParams.delete("for");
    window.history.replaceState(null, "", url);
  };
  return <div className={acts.tenure} role="group" aria-label="Show figures for">
    <span aria-hidden="true">Show figures for</span>
    <div>
      <button type="button" aria-pressed={tenure === "buy"} onClick={() => choose("buy")}>Buying</button>
      <button type="button" aria-pressed={tenure === "rent"} onClick={() => choose("rent")}>Renting</button>
    </div>
  </div>;
}
