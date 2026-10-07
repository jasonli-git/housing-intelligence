import type { PacketLevel } from "@/lib/api";
import { ReaderDetails } from "@/components/ReaderDetails";
import { formatValue } from "@/lib/format";
import { shareText } from "@/lib/hazards";
import { lending } from "@/lib/lending";

/**
 * How do people here pay for homes (Milestone 48, ARCHITECTURE #324-#325)? The mortgages
 * buyers actually took in the newest HMDA year: how many, at what rate, how large, how
 * much down, through which programs, and how often applications were denied and why.
 * What the page owes a reader: these are last year's loans, not an offer; a town's
 * figures are estimated from tracts; and a denial rate is not who could qualify.
 */
export function MortgageLending({ name, levels }: { name: string; levels: PacketLevel[] }) {
  const l = lending(levels);
  if (!l) return null;
  const usd = (n: number) => formatValue(n, "usd");
  const about = l.estimated ? "about " : "";

  return (
    <section className="section sales mortgage-lending" aria-labelledby="mortgage-lending-heading">
      <div className="section-head">
        <h2 id="mortgage-lending-heading">How do people here pay for homes?</h2>
      </div>

      {l.loans !== null && (
        <p className="sales-lead">
          In {l.year}, lenders made {about}
          <b>{formatValue(l.loans, "count")}</b> mortgages to buy a home in {name}
          {l.rate !== null ? <>, at a median rate of <b>{l.rate.toFixed(2)}%</b></> : ""}
          {l.loan !== null ? `, for a median ${usd(l.loan)}` : ""}
          {l.ltv !== null && l.ltv < 100
            ? `. The typical buyer borrowed ${Math.round(l.ltv)}% of the home's value, so put about ${Math.round(100 - l.ltv)}% down`
            : ""}
          .
        </p>
      )}

      {(l.fha !== null || l.costs !== null || l.income !== null) && (
        <p className="sales-note">
          {l.conventional !== null && l.fha !== null && l.va !== null && (
            <>
              {shareText(l.conventional)} were conventional loans, {shareText(l.fha)} FHA and{" "}
              {shareText(l.va)} VA.{" "}
            </>
          )}
          {l.costs !== null && <>Median loan costs at closing were {usd(l.costs)}. </>}
          {l.income !== null && <>Borrowers’ median income was {usd(l.income)}.</>}
        </p>
      )}

      {l.denial !== null && (
        <p className="sales-note">
          {shareText(l.denial)} of decided applications were denied
          {l.reasons.length > 0
            ? `, most often for ${l.reasons.map((r) => `${r.label} (${shareText(r.share)})`).join(", ")}`
            : ""}
          . HMDA has no credit scores, so this is not a measure of who could qualify.
        </p>
      )}

      <ReaderDetails title="About these figures">
        <p className="sales-note">
          From the Home Mortgage Disclosure Act records lenders report to the CFPB: first-lien
          loans to buy an owner-occupied one-to-four-family home. Refinances, home-equity lines
          and cash purchases are not counted, nor are lenders below HMDA’s reporting thresholds,
          mostly small banks and credit unions. These are rates borrowers got in {l.year}, not
          one you would be offered today; loan amounts are published rounded, for privacy.
          {l.estimated
            ? " HMDA places a loan in a census tract, not a town, so these figures weigh each tract’s loans by the share of its homes here: an estimate."
            : ""}
        </p>
      </ReaderDetails>
    </section>
  );
}
