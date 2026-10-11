import type { ReactNode } from "react";

/** Supporting methodology stays accessible without crowding the main answer. */
export function ReaderDetails({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <details className={`reader-details ${className}`.trim()}>
      <summary><span>{title}</span><svg className="reader-details-chevron" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m5 8 5 5 5-5" /></svg></summary>
      <div className="reader-details-body">{children}</div>
    </details>
  );
}
