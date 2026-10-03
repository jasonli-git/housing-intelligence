import type { ReactNode } from "react";

/** Supporting methodology stays accessible without crowding the main answer. */
export function ReaderDetails({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="reader-details">
      <summary>{title}</summary>
      <div className="reader-details-body">{children}</div>
    </details>
  );
}
