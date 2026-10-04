"use client";
import { useEffect, useState } from "react";
import { PERSONAL_EVENT, readPersonal, writePersonal, type Personal } from "@/lib/costScenario";
import { HOUSEHOLD_EVENT, readHousehold, writeHousehold, type Household } from "@/lib/household";

/** Shared personal inputs, hydrated after SSR; home-specific fields never enter this store. */
export function useBudgetScenario(enabled = true) {
  const [personal, setPersonal] = useState<Personal>({});
  const [household, setHousehold] = useState<Household>({});
  useEffect(() => {
    if (!enabled) return;
    const load = () => { setPersonal(readPersonal()); setHousehold(readHousehold()); };
    const personalChanged = (event: Event) => setPersonal((event as CustomEvent<Personal>).detail);
    const householdChanged = (event: Event) => setHousehold((event as CustomEvent<Household>).detail);
    load();
    window.addEventListener("storage", load);
    window.addEventListener(PERSONAL_EVENT, personalChanged);
    window.addEventListener(HOUSEHOLD_EVENT, householdChanged);
    return () => {
      window.removeEventListener("storage", load);
      window.removeEventListener(PERSONAL_EVENT, personalChanged);
      window.removeEventListener(HOUSEHOLD_EVENT, householdChanged);
    };
  }, [enabled]);
  return { personal, household,
    savePersonal(next: Personal) { setPersonal(next); writePersonal(next); },
    saveHousehold(next: Household) { setHousehold(next); writeHousehold(next); },
  };
}
