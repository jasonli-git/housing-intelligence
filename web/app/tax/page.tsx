import type { Metadata } from "next";

import { Crumbs, Kind } from "@/components/Crumbs";
import { Masthead } from "@/components/Masthead";
import { type Town, TaxLookup } from "@/components/TaxLookup";
import { api, artifactUrl } from "@/lib/api";
import { pageMetadata } from "@/lib/meta";

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
  const [municipalities, counties] = await Promise.all([
    api.regions("level=municipality&state=NJ&limit=1000"),
    api.regions("level=county&state=NJ&limit=100"),
  ]);
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
      <main id="main-content" tabIndex={-1} className="shell atlas-page atlas-tool quiet-county quiet-tax">
        <header className="page-head" data-kind="tool">
          <div>
            <Crumbs trail={[{ href: "/", label: "United States" }, { href: "/states/new-jersey", label: "New Jersey" }]} here="Property tax lookup" />
            <Kind kind="tool" />
            <h1 className="page-title">Find a property.<br />See its tax picture.</h1>
            <p className="meta tax-intro">Search New Jersey’s assessment records for a property’s value, tax and town comparison.</p>
            <details className="tax-about"><summary>About this lookup</summary><p className="meta">
              Type an address anywhere in New Jersey — no need to know which town it is in
              — or a block and lot with its town: what the property is assessed at, what
              it paid in tax last year, what that assessment implies at the state’s ratio,
              and how it compares with the rest of its town, from the state’s own
              assessment records. Owner names are never shown.
            </p></details>
          </div>
        </header>
        <TaxLookup towns={towns} artifactUrl={artifactUrl} />
      </main>
    </>
  );
}
