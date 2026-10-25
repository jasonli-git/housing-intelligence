import { Gloss } from "@/components/Gloss";
import Link from "next/link";
import type { ReactNode } from "react";
import { ReaderDetails } from "@/components/ReaderDetails";

import type { PacketLevel } from "@/lib/api";
import { formatMetric, formatValue } from "@/lib/format";
import { monthLabel, periodLabel } from "@/lib/periods";
import { rankWords } from "@/lib/ranks";
import { SaleExhibit } from "@/components/ExhibitCharts";

function SaleDetails({ compact, concise, children }: {compact:boolean; concise?:boolean; children:ReactNode}) {
  return compact ? <ReaderDetails title={concise ? "View sale details" : "Sale details & assessments"}>{children}</ReaderDetails> : <>{children}</>;
}

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
  portrait = false,
  concise = false,
}: {
  name: string;
  level: string;
  geoid: string;
  levels: (Pick<PacketLevel, "metric_id" | "value" | "period_start" | "period_end"> &
    Partial<Pick<PacketLevel, "rank" | "of" | "direction">>)[];
  showLookup?: boolean;
  portrait?: boolean;
  concise?: boolean;
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
  // ARCHITECTURE #416: its own measure, compared only with other places' sale ratios.
  const toIncome = find("sale_price_to_income");
  const incomeYears = toIncome
    ? [Number(toIncome.period_start.slice(0, 4)), Number(toIncome.period_end.slice(0, 4))]
    : null;
  const usd = (value: number) => formatValue(value, "usd");
  const pct = (share: number) => `${(share * 100).toFixed(0)}%`;
  const span = `${monthLabel(median.period_start)} to ${monthLabel(median.period_end)}`;

  return (
    <section className="section sales" aria-labelledby="sales-heading">
      <div className="section-head">
        <h2 id="sales-heading">{concise ? "Recent sale prices" : portrait ? "What did buyers actually pay?" : "How homes sell here"}</h2>
      </div>
      {portrait && <><p className="sales-note">{Math.round(count.value).toLocaleString("en-US")} qualifying one- to four-family sales · {span}</p><SaleExhibit median={median.value} lower={q1?.period_start===median.period_start && q1?.period_end===median.period_end ? q1.value : undefined} upper={q3?.period_start===median.period_start && q3?.period_end===median.period_end ? q3.value : undefined} period={span} concise={concise} /></>}
      {!portrait && <p className="sales-lead">
        {Math.round(count.value).toLocaleString("en-US")} usable sales of one- to four-family
        homes in {name} from {span}, at a median of <b>{usd(median.value)}</b>
        {q1 && q3 ? (
          <>
            ; the middle half sold for {usd(q1.value)} to {usd(q3.value)}
          </>
        ) : null}
        .
      </p>}
      <SaleDetails compact={portrait} concise={concise}>
      {concise && <p>Only arm’s-length sales the state accepts. Quartiles bracket the middle half of qualifying sales.{level !== "municipality" && " Calculated from qualifying deeds across the area, not an average of town medians."}</p>}
      <dl className="cost-lines sales-lines">
        {toIncome && incomeYears && (
          <div>
            <dt>
              Sale price to household income
              <small className="src">
                sales {incomeYears[1] - 2}–{incomeYears[1]} over income {incomeYears[0]}–{incomeYears[1]}
                {toIncome.rank && toIncome.of
                  ? ` · ${rankWords(toIncome.rank, toIncome.of, "value", toIncome.direction ?? "lower_is_better")} among sale-price ratios`
                  : ""}
              </small>
            </dt>
            <dd>{formatMetric(toIncome.value, "ratio", "sale_price_to_income")}</dd>
          </div>
        )}
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
      </SaleDetails>
      {concise ? <p className="sales-note">Sold homes only; changes can reflect which homes sold.</p> : <p className="sales-note"><Gloss>
        Only arm’s-length sales the state accepts. This describes sold homes, not every home.
        A higher median may mean pricier homes sold—not that each home gained value.
        {level !== "municipality" &&
          " Calculated from qualifying deeds across the area, not an average of town medians."}
      </Gloss></p>}
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
