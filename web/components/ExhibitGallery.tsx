import type { ReactNode } from "react";

/** The field-notes exhibits. The owner removed the pause control (2026-10-14); reduced
 * motion still stops the decorative looping artwork (TODO: WCAG 2.2.2 pause control). */
export function ExhibitGallery({ children }: { children: ReactNode }) {
  return <div className="exhibit-gallery" data-motion="playing">{children}</div>;
}
