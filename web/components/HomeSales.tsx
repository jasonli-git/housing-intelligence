import Link from "next/link";

import type { PacketLevel } from "@/lib/api";
import { formatValue } from "@/lib/format";
import { monthLabel, periodLabel } from "@/lib/periods";

/**
 * How homes change hands here (Milestone 36): what the state's deed records say about the
 * one- to four-family homes that sold — how many, at what spread of prices, how old, at
 * what price per square foot — and how assessments compare with those prices, beside
 * when the town last revalued.
 *
 * Four guardrails the roadmap set, each pinned by a test elsewhere: only one- to
 * four-family sales count (property classes stay separate); a count is of sales, never of
 * homes or units; a county's figures come from its deeds, never from its towns'
 * medians; and a rising median is said to be possibly a change in *which* homes sold.
 */
export function HomeSales({
  name,
  level,
  geoid,
  levels,
  showLookup = true,
}: {
  name: string;
  level: string;
  geoid: string;
  levels: Pick<PacketLevel, "metric_id" | "value" | "period_start" | "period_end">[];
  showLookup?: boolean;
}) {
  const find = (id: string) => levels.find((l) => l.metric_id === id);
  const median = find("sr1a_median_sale_price");
  const count = find("sr1a_sales_count");
  if (!median || !count) return null;
  const q1 = find("sr1a_price_lower_quartile");
  const q3 = find("sr1a_price_upper_quartile");
  const recent = find("sr1a_median_sale_price_12m");
  const perSqft = find("sr1a_median_price_per_sqft");
  const built = find("sr1a_median_year_built_sold");
  const ratio = find("sr1a_median_sales_ratio");
  const director = find("nj_director_ratio");
  const reval = find("nj_revaluation_year");
  const usd = (value: number) => formatValue(value, "usd");
  const pct = (share: number) => `${(share * 100).toFixed(0)}%`;
  const span = `${monthLabel(median.period_start)} to ${monthLabel(median.period_end)}`;

  return (
    <section className="section sales" aria-labelledby="sales-heading">
      <div className="section-head">
        <h2 id="sales-heading">How homes sell here</h2>
      </div>
      <p className="sales-lead">
        {Math.round(count.value).toLocaleString("en-US")} usable sales of one- to four-family
        homes in {name} from {span}, at a median of <b>{usd(median.value)}</b>
        {q1 && q3 ? (
          <>
            ; the middle half sold for {usd(q1.value)} to {usd(q3.value)}
          </>
        ) : null}
        .
      </p>
      <dl className="cost-lines sales-lines">
        {recent && (
          <div>
            <dt>
              Last twelve months
              <small className="src">
                {monthLabel(recent.period_start)} to {monthLabel(recent.period_end)} · 50 or more sales
              </small>
            </dt>
            <dd>{usd(recent.value)}</dd>
          </div>
        )}
        {perSqft && (
          <div>
            <dt>
              Per square foot of living space
              <small className="src">sales recording their size</small>
            </dt>
            <dd>{usd(perSqft.value)}</dd>
          </div>
        )}
        {built && (
          <div>
            <dt>
              Median year built, homes that sold
              <small className="src">the age of what changed hands, not of every home</small>
            </dt>
            <dd>{Math.round(built.value)}</dd>
          </div>
        )}
        {ratio && (
          <div>
            <dt>
              Assessed value, as a share of sale price
              <small className="src">
                {director
                  ? `the state’s Director’s Ratio for ${periodLabel(director.period_end)}: ${director.value.toFixed(1)}%`
                  : "the state’s sales ratio"}
              </small>
            </dt>
            <dd>{pct(ratio.value)}</dd>
          </div>
        )}
        {level === "municipality" && (
          <div>
            <dt>
              Last revaluation or reassessment
              <small className="src">the state’s approval lists, which begin with 2017</small>
            </dt>
            <dd>{reval ? `for tax year ${Math.round(reval.value)}` : "none since at least 2017"}</dd>
          </div>
        )}
      </dl>
      <p className="sales-note">
        Only arm’s-length sales the state accepts. This describes sold homes, not every home.
        A higher median may mean pricier homes sold—not that each home gained value.
        {level !== "municipality" &&
          " Calculated from qualifying deeds across the area, not an average of town medians."}
      </p>
      {showLookup && level === "municipality" && (
        <p className="sales-note">
          <Link href={`/tax?town=${geoid}`}>Look up a property in {name}</Link>: its
          assessment, last year’s tax and how it compares with the town’s.
        </p>
      )}
      {showLookup && level === "county" && (
        <p className="sales-note">
          <Link href="/tax">Look up a property in {name}</Link> by its address, or by
          block and lot with its town: its assessment and last year’s tax.
        </p>
      )}
    </section>
  );
}
