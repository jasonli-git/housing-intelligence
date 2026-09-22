"use client";

import type { KeyboardEvent, MouseEvent } from "react";
import { usePathname } from "next/navigation";

import { pushHousingMode, useHousingMode } from "@/components/useHousingMode";

export type AffordabilityControl =
  | { kind: "local"; fallbackHref?: string }
  | { kind: "route"; active?: boolean }
  | { kind: "disabled"; reason: string };

/**
 * Global affordability control. It is a real link wherever navigation is possible, so
 * it works before hydration and preserves new-tab/modifier-click behavior. Local state
 * and county workspaces intercept only an ordinary primary click.
 */
export function HousingModeToggle({ control }: { control: AffordabilityControl }) {
  const pathname = usePathname();
  const mode = useHousingMode(control.kind === "route" && control.active ? "afford" : "state");
  const afford = control.kind === "disabled" ? false : mode === "afford";

  if (control.kind === "disabled") {
    return (
      <button
        className="bar-mode"
        type="button"
        role="switch"
        aria-checked="false"
        aria-disabled="true"
        title={control.reason}
      >
        <span>Affordability</span>
        <span className="bar-mode-track" aria-hidden="true"><span /></span>
      </button>
    );
  }

  const href = afford
    ? (pathname === "/afford" ? "/" : pathname)
    : control.kind === "local"
      ? (control.fallbackHref ?? "/afford")
      : "/afford";
  const activate = (event: MouseEvent<HTMLAnchorElement>) => {
    if (control.kind !== "local") return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    pushHousingMode(afford ? "state" : "afford");
  };
  const key = (event: KeyboardEvent<HTMLAnchorElement>) => {
    if (event.key !== " ") return;
    event.preventDefault();
    event.currentTarget.click();
  };

  return (
    <a
      className="bar-mode"
      href={href}
      role="switch"
      aria-checked={afford}
      onClick={activate}
      onKeyDown={key}
    >
      <span>Affordability</span>
      <span className="bar-mode-track" aria-hidden="true"><span /></span>
    </a>
  );
}
