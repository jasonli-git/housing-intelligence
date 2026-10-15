import type { Metadata } from "next";

import { Crumbs, Kind } from "@/components/Crumbs";
import { InquiryNote } from "@/components/InquiryNote";
import { Masthead } from "@/components/Masthead";
import { type Town, TaxLookup } from "@/components/TaxLookup";
import { api, artifactUrl } from "@/lib/api";
import { pageMetadata } from "@/lib/meta";
import "../horizon-theme.css";
import "../tax-horizon.css";

export const metadata: Metadata = pageMetadata({
  title: "Property tax lookup — Housing",
  description:
    "Find any New Jersey property by its address, or by block and lot: its assessment, last year's tax, and how it compares with its town.",
  path: "/tax",
});

/**
 * Property tax: what you'd actually pay (Milestone 37), found from one typed address
 * anywhere in the state (Milestone 38). The towns ride in the page, for block-and-lot
 * searches; the street index and each town's parcels are files in object storage,
 * fetched as a search needs them — 3 million parcels as pages would break the static
 * host's file cap 154 times over (ARCHITECTURE #289, #294).
 */
export default async function TaxPage() {
  const [municipalities, counties, freshness] = await Promise.all([
    api.regions("level=municipality&state=NJ&limit=1000"),
    api.regions("level=county&state=NJ&limit=100"),
    api.freshness(),
  ]);
  // MOD-IV's next statewide update, as NJOGIS told the project (#370); none is published.
  const modivInquiry = freshness?.sources.find((s) => s.source_id === "nj_modiv")?.inquiries?.at(-1);
  const countyName = new Map((counties?.items ?? []).map((c) => [c.region_id, c.name]));
  const towns: Town[] = (municipalities?.items ?? [])
    .map((m) => ({
      geoid: m.geoid,
      name: m.name,
      county: countyName.get(m.parent_id ?? -1) ?? "",
    }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.county.localeCompare(b.county));

  return (
    <>
      <Masthead affordability={{ kind: "route" }} taxActive />
      <main id="main-content" tabIndex={-1} className="shell atlas-page atlas-tool quiet-county quiet-tax horizon-page" data-region-level="tax">
        <header className="page-head" data-kind="tool">
          <div>
            <Crumbs trail={[{ href: "/", label: "United States" }, { href: "/states/new-jersey", label: "New Jersey" }]} here="Property tax lookup" />
            <Kind kind="tool" />
            <h1 className="page-title">Property tax lookup</h1>
            <p className="meta tax-intro">Type any New Jersey address to see its tax bill and value. Owner names are never shown.</p>
            {modivInquiry && <InquiryNote inquiry={modivInquiry} />}
          </div>
        </header>
        <TaxLookup towns={towns} artifactUrl={artifactUrl} />
      </main>
    </>
  );
}
