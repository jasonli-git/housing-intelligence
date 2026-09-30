import Link from "next/link";

/**
 * The Friday schedule describes source checks, which can find nothing new. The footer
 * separately records the snapshot's build date; the linked page carries source dates.
 */
export function SiteStatus() {
  return (
    <Link className="site-status" href="/freshness">
      <span className="site-status-schedule">
        <span className="site-status-kicker">Source checks</span>{" "}scheduled Fridays
      </span>
      <span className="site-status-arrow" aria-hidden="true">→</span>
    </Link>
  );
}
