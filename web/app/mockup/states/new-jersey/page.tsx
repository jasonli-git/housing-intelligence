import type { Metadata } from "next";
import Link from "next/link";

import { CountyAtlas, type AtlasTown } from "../../CountyAtlas";
import { PosterNav } from "../../PosterNav";
import { StoryBars } from "../../StoryBars";
import styles from "../../poster.module.css";
import "../../../place-photo.css";
import "../../../stories/story-cards.css";
import "../../../stories/library.css";
import { ComputedBadge } from "@/components/ComputedBadge";
import { Crumbs } from "@/components/Crumbs";
import { Masthead } from "@/components/Masthead";
import { PlacePhoto } from "@/components/PlacePhoto";
import { StoryCover } from "@/components/StoryCard";
import { api } from "@/lib/api";
import { displayName } from "@/lib/names";
import { regionPath } from "@/lib/placeRoutes";
import { makePlaceStoryRecord, PLACE_STORIES, placeStoryHref, summarizePlaceStory, type PlaceStoryTopic } from "@/lib/placeStories";
import { stampPlaceStory } from "@/lib/placeStoryData";
import { PRIMARY_STATE } from "@/lib/states";
import { STORIES } from "@/lib/stories";
import { COLLECTIONS } from "@/lib/storyLibrary";
import { projector, ringsOf, shapes } from "@/lib/storyMap";

export const metadata: Metadata = { title: "New Jersey — Housing" };

const dollars = (value: number) => `$${Math.round(value).toLocaleString("en-US")}`;
const whole = (value: number) => Math.round(value).toLocaleString("en-US");
const CONSTRUCTION = ["permits_total_units", "nj_units_certified", "nj_units_demolished", "nj_net_units_added"];
const COMMUTE = [["lodes_work_home_county_share", "Home county", "var(--series-1)"], ["lodes_work_other_nj_share", "Elsewhere in NJ", "var(--series-3)"], ["lodes_work_nyc_share", "New York City", "var(--series-2)"], ["lodes_work_pennsylvania_share", "Pennsylvania", "var(--text-secondary)"], ["lodes_work_other_state_share", "Other states", "var(--tick)"]] as const;

/** The state as a compact infographic: its counties first, then the figures only a state has. */
export default async function NewJerseyPoster() {
  const regionId = PRIMARY_STATE.regionId;
  const [packet, destinations, community, pressure, hpi, countyRegions, countyGeo, construction] = await Promise.all([
    api.packet(regionId, "5y"), api.workDestinations(regionId), api.community(regionId), api.housingPressure(regionId), api.observations(regionId, "fhfa_hpi"),
    api.regions("level=county&state=NJ&limit=100"), api.geo("county", "NJ", 0.002), Promise.all(CONSTRUCTION.map(async (metric) => (await api.observations(regionId, metric))?.observations ?? [])),
  ]);
  const levels = packet?.levels ?? [];
  const level = (id: string) => levels.find((row) => row.metric_id === id);
  const counties = countyRegions?.items ?? [];
  const ids = counties.map((c) => c.region_id);

  // Every county's figure for one measure, read at the period the first county publishes it.
  const sample = ids.length ? await api.packet(ids[0], "5y") : null;
  const across = async (id: string) => {
    const period = sample?.levels.find((row) => row.metric_id === id)?.period_start;
    const rows = period ? await api.marketObservations(id, ids, period) : null;
    return new Map((rows?.regions ?? []).flatMap((row) => { const value = row.series.at(-1)?.value; return value === undefined ? [] : [[row.region_id, value] as const]; }));
  };
  const [sales, values, taxes, incomes, commutes, floods] = await Promise.all(["sr1a_median_sale_price", "zhvi_sfr", "nj_effective_tax_rate", "acs_median_hh_income", "acs_mean_commute_minutes", "fema_flood_homes_share"].map(across));
  const rows: AtlasTown[] = counties.map((c) => ({ id: c.region_id, name: displayName(c).replace(/ County$/, ""), href: `/mockup${regionPath(c.region_id)}`, sale: sales.get(c.region_id) ?? null, value: values.get(c.region_id) ?? null, tax: taxes.get(c.region_id) ?? null, income: incomes.get(c.region_id) ?? null, commute: commutes.get(c.region_id) ?? null, flood: floods.get(c.region_id) ?? null }));
  const bySale = rows.filter((c) => c.sale !== null).sort((a, b) => b.sale! - a.sale!);
  const byTax = rows.filter((c) => c.tax !== null).sort((a, b) => a.tax! - b.tax!);
  const byIncome = rows.filter((c) => c.income !== null).sort((a, b) => a.income! - b.income!);
  const ranges = [
    bySale.length > 1 && { label: "Recent sale", low: dollars(bySale.at(-1)!.sale!), lowName: bySale.at(-1)!.name, high: dollars(bySale[0].sale!), highName: bySale[0].name },
    byTax.length > 1 && { label: "Tax rate", low: `${byTax[0].tax!.toFixed(2)}%`, lowName: byTax[0].name, high: `${byTax.at(-1)!.tax!.toFixed(2)}%`, highName: byTax.at(-1)!.name },
    byIncome.length > 1 && { label: "Household income", low: dollars(byIncome[0].income!), lowName: byIncome[0].name, high: dollars(byIncome.at(-1)!.income!), highName: byIncome.at(-1)!.name },
  ].flatMap((range) => (range ? [range] : []));
  const frame = countyGeo?.features.length ? projector(countyGeo.features.flatMap((f) => ringsOf(f.geometry)), 360, 6) : null;
  const mapShapes = frame ? shapes(countyGeo!.features, 360, frame).shapes : [];

  const sale = level("sr1a_median_sale_price"), q1 = level("sr1a_price_lower_quartile"), q3 = level("sr1a_price_upper_quartile"), sold = level("sr1a_sales_count"), perFoot = level("sr1a_median_price_per_sqft"), tax = level("nj_effective_tax_rate"), population = level("pep_population");
  const hpiRows = hpi?.observations ?? [];
  const hpiFrom = hpiRows.length ? `${Number(hpiRows.at(-1)!.period_end.slice(0, 4)) - 10}${hpiRows.at(-1)!.period_end.slice(4)}` : "";
  const index = hpiRows.filter((o) => o.period_end >= hpiFrom).map((o) => o.value);
  const low = Math.min(...index), high = Math.max(...index);
  const line = index.map((v, i) => `${(i / Math.max(index.length - 1, 1)) * 600},${200 - ((v - low * 0.9) / (high - low * 0.9 || 1)) * 190}`).join(" ");
  const commute = COMMUTE.flatMap(([id, label, color]) => { const value = level(id)?.value; return value !== undefined ? [{ label, color, value: value * 100 }] : []; });
  const lead = [...commute].sort((a, b) => b.value - a.value)[0];

  const stories = packet ? (Object.keys(PLACE_STORIES) as PlaceStoryTopic[]).filter((topic) => topic !== "past").map((topic) => {
    const record = stampPlaceStory(makePlaceStoryRecord(topic, { region_id: regionId, name: "New Jersey", level: "state", state_code: "NJ", geoid: "34" }, packet.levels, {
      history: topic === "building" ? CONSTRUCTION.map((metricId, i) => ({ metricId, observations: construction[i] })) : [],
      destinations: topic === "commute" ? destinations : null, pressure: topic === "pressure" ? pressure : null,
      community: topic === "broadband" || topic === "health" || topic === "schools" ? community : null }));
    return { topic, summary: summarizePlaceStory(record) };
  }).filter(({ topic, summary }) => topic !== "sales" && topic !== "market" && summary.available && summary.rows.length > 1) : [];
  const TONES: Partial<Record<PlaceStoryTopic, string>> = { pressure: styles.pressure, lending: styles.lending, building: styles.homes, commute: styles.workday, schools: styles.schools, broadband: styles.street, health: styles.living, utilities: styles.bills };
  const tones = [styles.pressure, styles.lending, styles.homes, styles.living, styles.schools, styles.street, styles.ground, styles.era];
  const jersey = COLLECTIONS.find((c) => c.id === "jersey")!.stories.flatMap((slug) => STORIES.filter((s) => s.href === `/stories/${slug}`));
  const links = [{ id: "counties", label: "Its counties" }, ...(sale ? [{ id: "price", label: "Home prices" }] : []), ...(tax ? [{ id: "tax", label: "Property tax" }] : []), ...(commute.length ? [{ id: "workday", label: "Commuting" }] : []), ...(stories.length ? [{ id: "statewide", label: "Statewide data" }] : []), ...(jersey.length ? [{ id: "visual", label: "Visual stories" }] : [])];

  return <>
    <Masthead affordability={{ kind: "route" }} simple />
    <main id="main-content" tabIndex={-1} className={`${styles.poster} ${styles.compact}`}>
      <Crumbs trail={[{ href: "/", label: "Home" }]} here="New Jersey" />
      <PosterNav links={links} />

      <header className={`${styles.panel} ${styles.hero}`}>
        <div>
          <p className={styles.kicker}>{population ? `${whole(population.value)} residents · ` : ""}{counties.length} counties</p>
          <h1>New Jersey</h1>
          <p className={styles.nickname}>The Garden State</p>
          {sale && <p className={styles.headline}>Homes sold for a median of {dollars(sale.value)}{tax ? `, in a state with a ${tax.value.toFixed(2)}% effective property tax rate` : ""}.</p>}
          <ComputedBadge />
        </div>
        <PlacePhoto geoid="34" />
      </header>

      {frame && <section id="counties" className={`${styles.panel} ${styles.county}`}>
        <h2>Its {counties.length} counties</h2>
        {ranges.length > 0 && <div className={styles.ranges}>{ranges.map((range) => <div key={range.label}><span>{range.label}</span><strong>{range.low} – {range.high}</strong><small>{range.lowName} to {range.highName}</small></div>)}</div>}
        <CountyAtlas name="New Jersey" unit="County" width={frame.width} height={frame.height} shapes={mapShapes.map(({ id, d }) => ({ id, d }))} towns={rows} />
      </section>}

      {sale && <section id="price" className={`${styles.panel} ${styles.price}`}>
        <h2>The median home sold for</h2>
        <p className={styles.giant}>{dollars(sale.value)}</p>
        {index.length > 1 && <svg className={styles.area} viewBox="0 0 600 200" preserveAspectRatio="none" role="img" aria-label="FHFA house price index for New Jersey, last ten years">
          <polygon points={`0,200 ${line} 600,200`} fill="currentColor" fillOpacity="0.16" />
          <polyline points={line} fill="none" stroke="currentColor" strokeWidth="3" vectorEffect="non-scaling-stroke" />
        </svg>}
        <p className={styles.caption}>Line: FHFA house price index, last ten years.</p>
        {q1 && q3 && <div className={styles.sales}>
          <div className={styles.saleBar}><span><b>{dollars(q1.value)}</b>lower quarter</span><span><b>{dollars(sale.value)}</b>median sale</span><span><b>{dollars(q3.value)}</b>upper quarter</span></div>
          <p className={styles.caption}>{sold ? `${whole(sold.value)} sales` : "Recent sales"}{perFoot ? ` · ${dollars(perFoot.value)} per square foot` : ""}. NJ SR-1A records.</p>
        </div>}
      </section>}

      {tax && <section id="tax" className={`${styles.panel} ${styles.tax}`} data-wide>
        <h2>Property tax takes {tax.value.toFixed(2)}% of a home’s value a year</h2>
        <p className={styles.giant}>{dollars(tax.value * 5000)}</p>
        <p className={styles.caption}>The yearly bill that rate puts on a $500,000 home, not any home’s actual bill. NJ Division of Taxation. Below, the three highest counties and the three lowest.</p>
        {byTax.length > 5 && [...byTax.slice(-3).reverse(), ...byTax.slice(0, 3).reverse()].map((c) => <div key={c.id} className={styles.townBar}><span>{c.name}</span><div><i style={{ width: `${(c.tax! / byTax.at(-1)!.tax!) * 100}%` }} /></div><strong>{c.tax!.toFixed(2)}%</strong></div>)}
      </section>}

      {(stories.length > 0 || commute.length > 0) && <div id="statewide" className={styles.storyGrid}>
      {commute.length > 0 && <section id="workday" className={`${styles.panel} ${styles.workday}`}>
        <h2>{lead.value.toFixed(0)}% of workers commute to {lead.label === "Elsewhere in NJ" ? "another NJ county" : lead.label}</h2>
        <div className={styles.stack}>{commute.map((part) => <i key={part.label} title={`${part.label}: ${part.value.toFixed(0)}%`} style={{ flexGrow: part.value, background: part.color }} />)}</div>
        <ul className={styles.key}>{commute.map((part) => <li key={part.label}><i style={{ background: part.color }} />{part.label} {part.value.toFixed(0)}%</li>)}</ul>
        <p className={styles.caption}>Where residents’ jobs are. Census LODES.</p>
      </section>}
        {stories.map(({ topic, summary }, i) => <section key={topic} className={`${styles.panel} ${TONES[topic] ?? tones[i % tones.length]}`}>
        <h2>{summary.headline}</h2>
        <StoryBars rows={summary.rows} />
        <p className={styles.caption}>{summary.source}, {summary.period} · <Link href={placeStoryHref(topic, regionId)} prefetch={false}>Full story</Link></p>
      </section>)}
      </div>}

      {jersey.length > 0 && <section id="visual" className={`${styles.panel} ${styles.visual}`}>
        <div className={styles.deepHead}><h2>Only in New Jersey</h2><Link href="/stories">All stories</Link></div>
        <ul className={styles.jersey}>{jersey.slice(0, 5).map((story) => <li key={story.href}><Link href={story.href} prefetch={false}><StoryCover story={story} /><span>{story.title}</span></Link></li>)}</ul>
        {jersey.length > 5 && <p className={styles.actions}>{jersey.slice(5).map((story) => <Link key={story.href} href={story.href} prefetch={false}>{story.title}</Link>)}</p>}
      </section>}

      <footer className={styles.close}>Sources: NJ SR-1A sales records, NJ Division of Taxation, FHFA, Census Bureau, HMDA. <Link href="/sources">About the data</Link> · Mockup: <Link href={PRIMARY_STATE.path}>current page</Link></footer>
    </main>
  </>;
}
