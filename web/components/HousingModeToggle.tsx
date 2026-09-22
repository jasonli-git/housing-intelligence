"use client";

import { useEffect, useState } from "react";

export const HOUSING_MODE_EVENT = "housing:mode";

function affordabilityFromLocation() {
  return window.location.pathname === "/afford" || new URLSearchParams(window.location.search).get("mode") === "afford";
}

/** Global mode switch: local on the NJ page, a direct route everywhere else. */
export function HousingModeToggle() {
  const [afford, setAfford] = useState(false);

  useEffect(() => {
    const read = () => setAfford(affordabilityFromLocation());
    const custom = (event: Event) => setAfford((event as CustomEvent<string>).detail === "afford");
    read();
    window.addEventListener("popstate", read);
    window.addEventListener(HOUSING_MODE_EVENT, custom);
    return () => {
      window.removeEventListener("popstate", read);
      window.removeEventListener(HOUSING_MODE_EVENT, custom);
    };
  }, []);

  const change = () => {
    const onHome = window.location.pathname === "/";
    if (!onHome) {
      window.location.assign(afford ? "/" : "/?mode=afford");
      return;
    }
    const next = !afford;
    const url = new URL(window.location.href);
    if (next) url.searchParams.set("mode", "afford");
    else url.searchParams.delete("mode");
    window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
    setAfford(next);
    window.dispatchEvent(new CustomEvent(HOUSING_MODE_EVENT, { detail: next ? "afford" : "state" }));
  };

  return (
    <button className="bar-mode" type="button" role="switch" aria-checked={afford} onClick={change}>
      <span>Affordability</span>
      <span className="bar-mode-track" aria-hidden="true"><span /></span>
    </button>
  );
}

