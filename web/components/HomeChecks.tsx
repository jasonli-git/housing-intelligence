import type { PacketLevel } from "@/lib/api";
import Link from "next/link";
import { homeChecks } from "@/lib/homeChecks";
import { periodLabel } from "@/lib/periods";

export function HomeChecks({ levels, taxHref = "/tax" }: { levels: PacketLevel[]; taxHref?: string }) {
  return <section className="home-checks" aria-labelledby="home-checks-rules-heading">
    <h3 id="home-checks-rules-heading">What should I check before moving?</h3>
    <ul>{homeChecks(levels).map((check) => <li key={check.id}>
      <strong>{check.title}</strong><p>{check.text}</p>
      {check.id === "tax" && <Link href={taxHref}>Look up the property's tax bill ↗</Link>}
      {check.metricId && check.periodEnd && <small>Based on the area's published figure · {periodLabel(check.periodEnd, check.metricId)}</small>}
    </li>)}</ul>
    <p className="home-checks-note">Area figures cannot describe a particular property. These checks do not establish its condition or safety.</p>
  </section>;
}
