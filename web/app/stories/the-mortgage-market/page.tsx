import type { Metadata } from "next";
import Link from "next/link";

import { StackedBars } from "@/components/StackedBars";
import { StoryShell } from "@/components/StoryShell";
import { pageMetadata } from "@/lib/meta";
import { regionPath } from "@/lib/placeRoutes";
import { latestFor, seriesFor, storyCounties } from "@/lib/storyData";
import "../../horizon-theme.css";
import "../stories.css";

export const metadata: Metadata = pageMetadata({
  title: "The mortgage market — Housing",
  description: "Why home-purchase loans are denied in each New Jersey county, and which kinds of loans are made.",
  path: "/stories/the-mortgage-market",
});

const pct = (v: number) => `${Math.round(v * 100)}%`;
const LOANS = [
  { key: "conventional", label: "Conventional" },
  { key: "fha", label: "FHA" },
  { key: "va", label: "VA" },
  { key: "other", label: "USDA rural" },
];
const REASONS = [
  { key: "dti", label: "Debt-to-income" },
  { key: "credit", label: "Credit" },
  { key: "value", label: "Home value" },
  { key: "other", label: "Other" },
];

export default async function MortgageMarketPage() {
  const counties = await storyCounties();
  const ids = [...counties.keys()];
  const [v, years] = await Promise.all([
    latestFor(["hmda_conventional_share", "hmda_fha_share", "hmda_va_share", "hmda_denial_rate", "hmda_denial_credit_share", "hmda_denial_dti_share", "hmda_denial_value_share", "hmda_purchase_loans"], "county", ids),
    seriesFor("hmda_denial_rate", ids.slice(0, 1)),
  ]);
  const year = [...years.values()][0]?.at(-1)?.year;
  const rows = ids.map((id) => ({ id, name: counties.get(id)!, m: v.get(id) ?? {} })).sort((a, b) => (b.m.hmda_denial_rate ?? 0) - (a.m.hmda_denial_rate ?? 0));
  const link = (id: number, name: string) => <Link href={regionPath(id)}>{name}</Link>;
  return (
    <StoryShell
      title="The mortgage market"
      lede="For every county, two bars from lenders' own filings. The first is what kind of loan home buyers got; the second is why the applications that were turned down were turned down. Counties with the highest denial rates come first."
      note={<>The Home Mortgage Disclosure Act data lenders file with the CFPB, {year ?? "latest year"}: first-lien loans to buy a one- to four-family home to live in. A lender can give up to four reasons for a denial; the shares here are of each denial&rsquo;s first reason, and &ldquo;other&rdquo; gathers the rest, from incomplete applications to collateral and employment history.</>}
    >
      <div className="story-two">
        <div>
          <h2 className="story-h">Loans made</h2>
          <StackedBars
            parts={LOANS}
            max={1}
            format={pct}
            label="Stacked bars: each county's home-purchase loans by kind."
            rows={rows.map((r) => {
              const conventional = r.m.hmda_conventional_share ?? 0, fha = r.m.hmda_fha_share ?? 0, va = r.m.hmda_va_share ?? 0;
              return { id: r.id, name: link(r.id, r.name), values: { conventional, fha, va, other: Math.max(0, 1 - conventional - fha - va) }, total: r.m.hmda_purchase_loans ? `${Math.round(r.m.hmda_purchase_loans).toLocaleString("en-US")} loans` : "" };
            })}
          />
        </div>
        <div>
          <h2 className="story-h">Why applications were denied</h2>
          <StackedBars
            parts={REASONS}
            max={1}
            format={pct}
            label="Stacked bars: each county's denied home-purchase applications by reason."
            rows={rows.map((r) => {
              const dti = r.m.hmda_denial_dti_share ?? 0, credit = r.m.hmda_denial_credit_share ?? 0, value = r.m.hmda_denial_value_share ?? 0;
              return { id: r.id, name: link(r.id, r.name), values: { dti, credit, value, other: Math.max(0, 1 - dti - credit - value) }, total: r.m.hmda_denial_rate === undefined ? "" : `${pct(r.m.hmda_denial_rate)} denied` };
            })}
          />
        </div>
      </div>
    </StoryShell>
  );
}
