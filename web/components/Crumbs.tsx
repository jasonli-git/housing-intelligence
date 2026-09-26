import Link from "next/link";

export type Crumb = { href: string; label: string };

/**
 * Where a page sits, as navigation rather than a line of text (Milestone 23): mono labels,
 * "›" between them, a back arrow on the first, and the current page last, unlinked. The
 * owner found "New Jersey / Somerset County / Report" read as generic text.
 */
export function Crumbs({ trail, here }: { trail: Crumb[]; here?: string }) {
  return (
    <nav className="crumbs print-hide" aria-label="Breadcrumb">
      <ol>
        {trail.map((crumb, index) => (
          <li key={crumb.href}>
            <Link href={crumb.href}>
              {index === 0 && <span aria-hidden="true">‹ </span>}
              {crumb.label}
            </Link>
          </li>
        ))}
        {here && <li aria-current="page">{here}</li>}
      </ol>
    </nav>
  );
}

export type PageKind = "state" | "county" | "municipality" | "zip" | "report" | "tool" | "data";

const KIND_LABELS: Record<PageKind, string> = {
  state: "State",
  county: "County",
  municipality: "Municipality",
  zip: "ZIP code",
  report: "Report",
  tool: "Tool",
  // The pages about the data itself — how current it is, what changed (Milestone 27).
  data: "About the data",
};

/** A region level as the kind of page it gets. */
export function kindOf(level: string): PageKind {
  return level === "county" || level === "municipality" || level === "zip" ? level : "state";
}

/**
 * The kind of page, as a small label over its title in the page's accent (Milestone 23):
 * the New Jersey page, region pages, reports and the affordability tool each a little
 * distinct and plainly related. The accent is set by `data-kind` on the page head.
 */
export function Kind({ kind }: { kind: PageKind }) {
  return <p className="kind">{KIND_LABELS[kind]}</p>;
}
