import Link from "next/link";

import { dayLabel } from "@/lib/freshness";

/**
 * A figure that changed after this site first published it (ARCHITECTURE #410): when,
 * and what it first said, linked to the revised-figures page that lists every change
 * with its source. A revision is a publisher restating a figure, a source file fetched
 * again, or a figure worked out here whose inputs moved; the mark claims none of them.
 */
export function UpdatedMark({ updated }: { updated: { from: string; on: string } }) {
  return (
    <small className="figure-updated">
      <Link href="/changes">Updated {dayLabel(updated.on)}</Link> · first published as {updated.from}
    </small>
  );
}
