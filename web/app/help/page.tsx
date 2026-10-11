import { AffordableHousing } from "@/components/AffordableHousing";
import { Crumbs, Kind } from "@/components/Crumbs";
import { Masthead } from "@/components/Masthead";
import { api } from "@/lib/api";
import { pageMetadata } from "@/lib/meta";
import "../tool-pages.css";

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
    <Masthead affordability={{kind: "route"}} />
    <main id="main-content" tabIndex={-1} className="shell atlas-page atlas-tool housing-help-page">
      <header className="page-head" data-kind="tool">
        <Crumbs trail={[{href: "/", label: "United States"}]} here="Housing help" />
        <Kind kind="tool" />
        <h1 className="page-title">Find housing help.</h1>
        <p className="tool-subtitle">Where to apply. What’s listed. Who to contact.</p>
        <p className="meta">Coverage: New Jersey. More states are not available yet.</p>
      </header>
      <p className="table-note">Listed properties are not a live vacancy list. Confirm availability and eligibility with the programme or property.</p>
      <AffordableHousing data={data} />
    </main>
  </>;
}
