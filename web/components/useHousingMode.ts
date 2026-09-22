"use client";

import { useCallback, useSyncExternalStore } from "react";

import { housingModeAt, type HousingMode } from "@/lib/housingMode";

export const HOUSING_MODE_EVENT = "housing:mode";

function readHousingMode(): HousingMode {
  return housingModeAt(window.location.pathname, window.location.search);
}

function subscribeHousingMode(changed: () => void) {
  const sync = () => {
    document.documentElement.dataset.housingMode = readHousingMode();
    changed();
  };
  window.addEventListener("popstate", sync);
  window.addEventListener(HOUSING_MODE_EVENT, sync);
  return () => {
    window.removeEventListener("popstate", sync);
    window.removeEventListener(HOUSING_MODE_EVENT, sync);
  };
}

/** One URL-backed mode subscription shared by the masthead and both local workspaces. */
export function useHousingMode(initial: HousingMode = "state") {
  const serverSnapshot = useCallback(() => initial, [initial]);
  return useSyncExternalStore(subscribeHousingMode, readHousingMode, serverSnapshot);
}

/** Change a local workspace and preserve every unrelated query parameter and hash. */
export function pushHousingMode(mode: HousingMode) {
  const url = new URL(window.location.href);
  if (mode === "afford") url.searchParams.set("mode", "afford");
  else url.searchParams.delete("mode");
  window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
  document.documentElement.dataset.housingMode = mode;
  window.dispatchEvent(new Event(HOUSING_MODE_EVENT));
}
