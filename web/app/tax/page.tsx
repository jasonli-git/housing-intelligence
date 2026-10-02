import type { Metadata } from "next";

import { Crumbs, Kind } from "@/components/Crumbs";
import { Masthead } from "@/components/Masthead";
import { type Town, TaxLookup } from "@/components/TaxLookup";
import { api, artifactUrl } from "@/lib/api";

export const metadata: Metadata = {
  title: "Property tax lookup — Housing",
  description:
    "Find a New Jersey property by address or block and lot: its assessment, last year's tax, and how it compares with its town.",
};

/**
 * Property tax: what you'd actually pay (Milestone 37). The towns ride in the page; each
 * town's parcels are a file in object storage, fetched when a reader chooses the town —
 * 3 million parcels as pages would break the static host's file cap 154 times over
 * (ARCHITECTURE #289).
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
      <main className="shell atlas-page atlas-tool">
        <header className="page-head" data-kind="tool">
          <div>
            <Crumbs trail={[{ href: "/", label: "New Jersey" }]} here="Property tax lookup" />
            <Kind kind="tool" />
            <h1 className="page-title">Property tax lookup</h1>
            <p className="meta">
              Any property in New Jersey, by address or by block and lot: what it is
              assessed at, what it paid in tax last year, what that assessment implies at
              the state’s ratio, and how it compares with the rest of its town — from the
              state’s own assessment records. Owner names are never shown.
            </p>
          </div>
        </header>
        <TaxLookup towns={towns} artifactUrl={artifactUrl} />
      </main>
    </>
  );
}
