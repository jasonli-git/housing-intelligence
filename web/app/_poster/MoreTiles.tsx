"use client";

import { type ReactNode, useId, useState } from "react";

import acts from "./acts.module.css";

/** An act's supporting exhibits. On a wide screen they are simply shown; on a phone they
 *  wait behind one button naming them, so the act's lead answer is not a long scroll away. */
export function MoreTiles({ names, children }: { names: string[]; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <>
    <button type="button" className={acts.more} aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
      <span>{open ? "Show less" : `More: ${names.join(", ")}`}</span><span aria-hidden="true">{open ? "−" : "+"}</span>
    </button>
    <div id={id} className={acts.tiles} data-open={open || undefined}>{children}</div>
  </>;
}
