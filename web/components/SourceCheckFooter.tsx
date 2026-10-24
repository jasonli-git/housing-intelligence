import { SiteStatus } from "@/components/SiteStatus";

/** Outside source attribution so check status remains available if its data is absent. */
export function SourceCheckFooter() {
  return <nav className="site-check-footer" aria-label="Source check status">
    <SiteStatus />
  </nav>;
}
