import type { Metadata } from "next";
import Link from "next/link";

import type { AtlasTown } from "../../CountyAtlas";
import { PosterNav } from "../../PosterNav";
import { StateDashboard } from "../../StateDashboard";
import { StoryBars } from "../../StoryBars";
import state from "../../state.module.css";
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
const linePoints = (values: number[], width: number, height: number) => { const low = Math.min(...values), span = Math.max(...values) - low || 1; return values.map((v, i) => `${(i / Math.max(values.length - 1, 1)) * width},${height - 4 - ((v - low) / span) * (height - 8)}`).join(" "); };


const TOPIC_PANEL: Partial<Record<PlaceStoryTopic, string>> = { pressure: "pressure", lending: "lending", building: "homes", migration: "street", sites: "ground", flood: "ground", water: "living", broadband: "street", schools: "schools", health: "bills", utilities: "bills" };
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
  const [sales, values, taxes, incomes, commutes, floods, rents] = await Promise.all(["sr1a_median_sale_price", "zhvi_sfr", "nj_effective_tax_rate", "acs_median_hh_income", "acs_mean_commute_minutes", "fema_flood_homes_share", "zori_all"].map(across));
  const rows: AtlasTown[] = counties.map((c) => ({ id: c.region_id, name: displayName(c).replace(/ County$/, ""), href: `/mockup${regionPath(c.region_id)}`, sale: sales.get(c.region_id) ?? null, value: values.get(c.region_id) ?? null, tax: taxes.get(c.region_id) ?? null, income: incomes.get(c.region_id) ?? null, commute: commutes.get(c.region_id) ?? null, flood: floods.get(c.region_id) ?? null }));
  const byRent = rows.flatMap((c) => { const rent = rents.get(c.id); return rent === undefined ? [] : [{ name: c.name, rent }]; }).sort((a, b) => a.rent - b.rent);
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

  const sale = level("sr1a_median_sale_price"), q1 = level("sr1a_price_lower_quartile"), q3 = level("sr1a_price_upper_quartile"), sold = level("sr1a_sales_count"), perFoot = level("sr1a_median_price_per_sqft"), tax = level("nj_effective_tax_rate"), population = level("pep_population"), added = level("nj_net_units_added");
  const hpiRows = hpi?.observations ?? [];
  const hpiFrom = hpiRows.length ? `${Number(hpiRows.at(-1)!.period_end.slice(0, 4)) - 10}${hpiRows.at(-1)!.period_end.slice(4)}` : "";
  const index = hpiRows.filter((o) => o.period_end >= hpiFrom).map((o) => o.value);
  const commute = COMMUTE.flatMap(([id, label, color]) => { const value = level(id)?.value; return value !== undefined ? [{ label, color, value: value * 100 }] : []; });
  const lead = [...commute].sort((a, b) => b.value - a.value)[0];

  const stories = packet ? (Object.keys(PLACE_STORIES) as PlaceStoryTopic[]).filter((topic) => topic !== "past").map((topic) => {
    const record = stampPlaceStory(makePlaceStoryRecord(topic, { region_id: regionId, name: "New Jersey", level: "state", state_code: "NJ", geoid: "34" }, packet.levels, {
      history: topic === "building" ? CONSTRUCTION.map((metricId, i) => ({ metricId, observations: construction[i] })) : [],
      destinations: topic === "commute" ? destinations : null, pressure: topic === "pressure" ? pressure : null,
      community: topic === "broadband" || topic === "health" || topic === "schools" ? community : null }));
    return { topic, summary: summarizePlaceStory(record) };
  }).filter(({ topic, summary }) => topic !== "sales" && topic !== "market" && summary.available && summary.rows.length > 1) : [];
  const figure = (topic: PlaceStoryTopic, label: string) => stories.find((item) => item.topic === topic)?.summary.rows.find((row) => row.label.includes(label))?.formatted;
  const burdened = figure("pressure", "Up to 30%"), fiber = figure("broadband", "Fiber");
  const pressureStory = stories.find((item) => item.topic === "pressure")?.summary, fiberStory = stories.find((item) => item.topic === "broadband")?.summary;
  const monthYear = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
  const snapshot = [
    sale && { value: dollars(sale.value), label: "Typical home sale price", fine: `${sale.period_start ? `${monthYear(sale.period_start)} to ` : ""}${monthYear(sale.period_end)}. NJ SR-1A` },
    tax && { value: dollars(tax.value * 5000), label: "Yearly property tax on a $500,000 home", fine: `At the ${tax.value.toFixed(2)}% statewide rate, ${tax.period_end.slice(0, 4)}. NJ Division of Taxation` },
    added && { value: whole(added.value), label: `More homes in ${added.period_end.slice(0, 4)}, after demolitions`, fine: "Census BPS / NJ DCA" },
    burdened && pressureStory && { value: burdened, label: "Of the lowest-income renters spend too much on housing", fine: `Cost-burdened. ${pressureStory.source}, ${pressureStory.period}` },
    fiber && fiberStory && { value: fiber, label: "Of homes and businesses can get fiber internet", fine: `${fiberStory.source}, ${fiberStory.period.slice(0, 4)}` },
  ].flatMap((item) => (item ? [item] : []));
  const jersey = COLLECTIONS.find((c) => c.id === "jersey")!.stories.flatMap((slug) => STORIES.filter((s) => s.href === `/stories/${slug}`));
  // Each chapter asks for its stories by name; anything not named falls to daily life.
  const tileFor = (topics: PlaceStoryTopic[]) => stories.filter(({ topic }) => topics.includes(topic)).map(({ topic, summary }) => <section key={topic} className={`${styles.panel} ${styles[TOPIC_PANEL[topic] ?? "living"]}`}>
    <h2>{summary.headline}</h2>
    <StoryBars rows={summary.rows} />
    <p className={state.note}>{summary.source}, {summary.period} · <Link href={placeStoryHref(topic, regionId)} prefetch={false}>Full story</Link></p>
  </section>);
  const LIVING = stories.map(({ topic }) => topic).filter((topic) => !["lending", "pressure", "building", "migration"].includes(topic));
  const links = [{ id: "counties", label: "Compare counties" }, ...(sale || tax ? [{ id: "cost", label: "Buying, taxes & rent" }] : []), { id: "afford", label: "Renters & mortgages" }, { id: "supply", label: "New homes" }, { id: "living", label: "Daily life" }, ...(jersey.length ? [{ id: "visual", label: "New Jersey stories" }] : [])];

  return <>
    <Masthead affordability={{ kind: "route" }} simple />
    <main id="main-content" tabIndex={-1} className={`${styles.poster} ${state.page}`}>
      <Crumbs trail={[{ href: "/mockup", label: "Home" }]} here="New Jersey" />
      <PosterNav links={links} />

      <header id="counties" className={state.hero}>
        <div className={state.photo}><PlacePhoto geoid="34" /></div>
        {frame && <StateDashboard width={frame.width} height={frame.height} shapes={mapShapes.map(({ id, d }) => ({ id, d }))} rows={rows}>
          <p className={state.kicker}>{population ? `${whole(population.value)} residents · ` : ""}{counties.length} counties</p>
          <h1>New Jersey</h1>
          <p className={state.nickname}>The Garden State</p>
          <ComputedBadge />
        </StateDashboard>}
        {snapshot.length > 0 && <dl className={`${state.snapshot} ${state.heroBand}`} aria-label="New Jersey at a glance">{snapshot.map((item) => <div key={item.label}><dd>{item.value}</dd><dt>{item.label}</dt><dd className={state.snapshotFine}>{item.fine}</dd></div>)}</dl>}
      </header>



      {(sale || tax) && <section id="cost" className={state.chapter}>
        <h2>What it costs to buy, own or rent a home</h2>
        <div className={`${styles.compact} ${styles.chapterGrid} ${state.infographic}`}>
        {sale && <section id="price" className={`${styles.panel} ${styles.price}`}>
          <h2>What homes sold for</h2>
          {index.length > 1 && <svg className={state.line} viewBox="0 0 600 100" preserveAspectRatio="none" role="img" aria-label="FHFA house price index for New Jersey, last ten years"><polyline points={linePoints(index, 600, 100)} fill="none" stroke="currentColor" strokeWidth="2.5" vectorEffect="non-scaling-stroke" /></svg>}
          <p className={state.note}>FHFA house price index, last ten years.</p>
          {q1 && q3 && <div className={state.quartiles}><div><b>{dollars(q1.value)}</b>lower quarter</div><div><b>{dollars(sale.value)}</b>median sale</div><div><b>{dollars(q3.value)}</b>upper quarter</div></div>}
          <p className={state.note}>{sold ? `${whole(sold.value)} sales` : "Recent sales"}{perFoot ? ` · ${dollars(perFoot.value)} per square foot` : ""}. NJ SR-1A records.</p>
        </section>}

        {tax && <section id="tax" className={`${styles.panel} ${styles.tax}`}>
          <h2>Property tax takes {tax.value.toFixed(2)}% of a home’s value a year</h2>
          <p className={state.figure}>{dollars(tax.value * 5000)}</p>
          <p className={state.note}>The yearly bill that rate puts on a $500,000 home, not any home’s actual bill. NJ Division of Taxation.</p>
        </section>}

        {byRent.length > 1 && <section id="rent" className={`${styles.panel} ${styles.homes}`}>
          <h2>Rent runs {dollars(byRent[0].rent)} to {dollars(byRent.at(-1)!.rent)} a month across counties</h2>
          <div className={state.rentBars}>{[...byRent.slice(-3).reverse(), ...byRent.slice(0, 3).reverse()].map((c) => <div key={c.name}><span>{c.name}</span><i><b style={{ width: `${(c.rent / byRent.at(-1)!.rent) * 100}%` }} /></i><strong>{dollars(c.rent)}</strong></div>)}</div>
          <p className={state.note}>Three highest and three lowest of {byRent.length} counties. Typical monthly rent, Zillow; there is no statewide figure here.</p>
        </section>}

        </div>
      </section>}

      {tileFor(["lending", "pressure"]).length > 0 && <section id="afford" className={state.chapter}>
        <h2>Housing cost burden and mortgages</h2>
        <div className={`${styles.compact} ${styles.chapterGrid} ${state.infographic}`}>{tileFor(["lending", "pressure"])}</div>
      </section>}

      {tileFor(["building", "migration"]).length > 0 && <section id="supply" className={state.chapter}>
        <h2>How many homes New Jersey is adding</h2>
        <div className={`${styles.compact} ${styles.chapterGrid} ${state.infographic}`}>{tileFor(["building", "migration"])}</div>
      </section>}

      {(commute.length > 0 || tileFor(LIVING).length > 0) && <section id="living" className={state.chapter}>
        <h2>Daily life around a home</h2>
        <div className={`${styles.compact} ${styles.chapterGrid} ${state.infographic}`}>
        {commute.length > 0 && <section id="workday" className={`${styles.panel} ${styles.workday}`}>
          <h2>{lead.value.toFixed(0)}% of workers commute to {lead.label === "Elsewhere in NJ" ? "another NJ county" : lead.label}</h2>
          <div className={styles.stack}>{commute.map((part) => <i key={part.label} title={`${part.label}: ${part.value.toFixed(0)}%`} style={{ flexGrow: part.value, background: part.color }} />)}</div>
          <ul className={styles.key}>{commute.map((part) => <li key={part.label}><i style={{ background: part.color }} />{part.label} {part.value.toFixed(0)}%</li>)}</ul>
          <p className={state.note}>Where residents’ jobs are. Census LODES.</p>
        </section>}

          {tileFor(LIVING)}
        </div>
      </section>}

      {jersey.length > 0 && <section id="visual" className={state.rail}>
        <div className={state.railHead}><h2>Stories about New Jersey</h2><Link href="/stories">All stories</Link></div>
        <ul tabIndex={0}>{jersey.map((story) => <li key={story.href}><Link href={story.href} prefetch={false}><StoryCover story={story} /><span>{story.title}</span></Link></li>)}</ul>
      </section>}

      <footer className={styles.close}>Sources: NJ SR-1A sales records, NJ Division of Taxation, FHFA, Census Bureau, HMDA. <Link href="/sources">About the data</Link> · Mockup: <Link href={PRIMARY_STATE.path}>current page</Link></footer>
    </main>
  </>;
}
