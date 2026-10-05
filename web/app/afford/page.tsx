import type { Metadata } from "next";
import Link from "next/link";

import { AffordExplorer } from "@/components/AffordExplorer";
import { Crumbs, Kind } from "@/components/Crumbs";
import { Masthead } from "@/components/Masthead";
import { affordData } from "@/lib/affordData";

export const metadata: Metadata = {
  title: "What can I afford? — Housing",
  description:
    "The New Jersey counties and municipalities where the typical home is within reach of an income.",
};

/**
 * "What can I afford here" (Milestone 17): an income in, the places within reach out.
 *
 * Every county's and municipality's typical home value, rent and tax bill ride in the
 * page — about 600 places, small enough to answer every change in the browser with no
 * request, and on one page rather than 1,134. The map is the New Jersey page's globe,
 * held at municipal level and painted in three states rather than by quantile — the
 * carry the ROADMAP planned and #144 deferred to Milestone 16.
 */
export default async function AffordPage() {
  // No geometry fetched here any more: the map asks for `map.json` itself (#163).
  const data = await affordData();
  if (!data) {
    return (
      <>
        <Masthead affordability={{ kind: "route", active: true }} />
        <main id="main-content" tabIndex={-1} className="shell atlas-page atlas-tool">
          <h1 className="page-title">What can I afford?</h1>
          <p className="meta">
            The API is unreachable, so there is nothing to show.{" "}
            <Link href="/states/new-jersey">Back to New Jersey</Link>.
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <Masthead affordability={{ kind: "route", active: true }} />
      <main id="main-content" tabIndex={-1} className="shell atlas-page atlas-tool budget-page">
      <header className="page-head" data-kind="tool">
        <div>
          <Crumbs
            trail={[{ href: "/", label: "United States" }, { href: "/states/new-jersey", label: "New Jersey" }]}
            here="What can I afford?"
          />
          <Kind kind="tool" />
          <h1 className="page-title">Find your fit.</h1>
          <p className="meta">
            A budget, a place, a clearer starting point. Compare typical housing costs in New Jersey.
          </p>
        </div>
      </header>
      <AffordExplorer
        {...data}
        appearance="atlas"
      />
      </main>
    </>
  );
}
