import Link from "next/link";

import { BuiltAgo } from "@/components/BuiltAgo";
import { dayLabel } from "@/lib/freshness";

/**
 * The schedule and the age of this static snapshot are different claims. A Friday run
 * can find nothing new and leave the site untouched; neither label asserts that a
 * publisher's figures are current. The linked page carries each source's own dates.
 */
export function SiteStatus() {
  const builtAt = process.env.SITE_BUILT_AT ?? new Date().toISOString();

  return (
    <Link className="site-status" href="/freshness">
      <span className="site-status-schedule">Source checks scheduled Fridays</span>
      {" "}
      <span className="site-status-built">
        Built <time dateTime={builtAt}>{dayLabel(builtAt)}</time>
        <BuiltAgo at={builtAt} />
      </span>
      <span className="site-status-arrow" aria-hidden="true">→</span>
    </Link>
  );
}
