import styles from "@/components/SupportTools.module.css";
import { AffordableLookup, type LookupTown } from "@/components/AffordableLookup";
import { Masthead } from "@/components/Masthead";
import { api } from "@/lib/api";
import { pageMetadata } from "@/lib/meta";
import "../tool-pages.css";
import "../horizon-theme.css";
import "../help-horizon.css";
import "./affordable-housing.css";

export const metadata = pageMetadata({
  title: "Affordable housing records — Housing",
  description: "Pick a New Jersey town and see the affordable properties on record there, with sources and limits.",
  path: "/affordable-housing",
});

/** #497: the records half of Housing help, as a lookup by town. */
export default async function AffordableHousingPage() {
  const [towns, counties] = await Promise.all([api.regions("level=municipality&state=NJ&limit=1000"), api.regions("level=county&state=NJ&limit=100")]);
  const countyName = new Map((counties?.items ?? []).map((c) => [c.region_id, c.name]));
  const list: LookupTown[] = (towns?.items ?? []).map((t) => ({ id: t.region_id, name: t.name, county: countyName.get(t.parent_id ?? -1) ?? "", countyId: t.parent_id ?? null }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return <>
    <Masthead affordability={{ kind: "route" }} recordsActive title="Affordable housing records" />
    <main id="main-content" tabIndex={-1} className={`shell atlas-page atlas-tool housing-help-page horizon-page ${styles.helpPage}`} data-region-level="help">
      <header className="page-head" data-kind="tool"><div><p className="meta ah-intro">Find the affordable homes on record in a New Jersey town, and who to call about them.</p></div></header>
      <AffordableLookup towns={list} inventoryHref="/help/inventory.json" />
    </main>
  </>;
}
