import { AffordableHousing } from "@/components/AffordableHousing";
import { Crumbs, Kind } from "@/components/Crumbs";
import { Masthead } from "@/components/Masthead";
import { api } from "@/lib/api";
import { pageMetadata } from "@/lib/meta";
import "../tool-pages.css";
import "../horizon-theme.css";
import "../help-horizon.css";

export const metadata = pageMetadata({
  title: "Housing help — Housing",
  description: "Official New Jersey housing assistance routes and reported affordable properties, with sources and limits.",
  path: "/help",
});

export default async function HousingHelpPage() {
  const states = await api.regions("level=state&state=NJ&limit=1");
  const state = states?.items[0];
  const data = state ? await api.affordableHousing(state.region_id) : null;
  return <>
    <Masthead affordability={{kind: "route"}} helpActive />
    <main id="main-content" tabIndex={-1} className="shell atlas-page atlas-tool housing-help-page horizon-page" data-region-level="help">
      <header className="page-head" data-kind="tool">
        <div>
        <Crumbs trail={[{href: "/", label: "United States"}]} here="Housing help" />
        <Kind kind="tool" />
        <h1 className="page-title">Need help with housing?</h1>
        <p className="tool-subtitle">Find the right official office, then look up affordable properties. New Jersey only, for now.</p>
        </div>
      </header>
      <AffordableHousing data={data} tool inventoryHref="/help/inventory.json" />
    </main>
  </>;
}
