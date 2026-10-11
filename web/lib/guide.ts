/**
 * The decision guides (Milestone 49, ARCHITECTURE #330): three questions answered for
 * one place from the files the site already publishes — *can I afford to buy here*,
 * *should I rent or buy*, *what should I check before an offer*.
 *
 * Every answer is computed here from published figures and the reader's own inputs;
 * nothing is model-written (decided with the owner 2026-09-30, #266). Each carries its
 * source, its period, what it cannot say, the official place to check next, and an
 * evidence label set by fixed rules (`evidence.ts`). The thresholds are HUD's — 30% and
 * 50% of income — stated as thresholds, never as a verdict on whether to buy (the
 * owner's decision of 2026-10-07).
 *
 * Pure functions over a `GuideData` the page fetches in the browser, so the arithmetic
 * is tested without a network and one page serves every place (#330).
 */

import type {
  CommunityContext,
  Observation,
  Packet,
  PacketLevel,
  Utilities,
  WaterSystems,
} from "@/lib/api";
import type { HomePrice } from "@/components/CostToOwn";
import { BURDEN_SHARE, SEVERE_SHARE } from "@/lib/cost";
import type { Personal } from "@/lib/costScenario";
import { fhaCheck, type FhaCheck } from "@/lib/financing";
import { formatValue } from "@/lib/format";
import { MAPPED_FLOOR, shareText } from "@/lib/hazards";
import { homePrice } from "@/lib/homePrice";
import { type IncomeLimits, positionSentence } from "@/lib/household";
import { eachMonth, type Inputs, type Month, overYears, type Years } from "@/lib/ownership";
import { periodLabel } from "@/lib/periods";
import { ownershipInputs, utilityTotal } from "@/lib/budgetScenario";
import type { Inquiry } from "@/lib/api";
import { RADON_MAP_INQUIRY } from "@/lib/inquiries";
import { type Context, type Evidence, judgeAnswer, type Judged } from "@/lib/evidence";

/** Everything the guides read for one place, as the page fetched it. */
export type GuideData = {
  region: Packet["region"];
  levels: PacketLevel[];
  /** The county's packet levels, for a town or ZIP: FHA's limit is set by county. */
  countyLevels: PacketLevel[];
  sources: Packet["sources"];
  incomeLimits: IncomeLimits | null;
  /** Every window of the turnover rate this place has, oldest first. */
  turnover: Observation[];
  water: WaterSystems | null;
  community: CommunityContext | null;
  utilities: Utilities | null;
  /** The newest period each metric has anywhere, from the catalog. */
  newest: Record<string, string | null>;
};

export type Step = { label: string; href: string };

const find = (levels: PacketLevel[], id: string) => levels.find((l) => l.metric_id === id) ?? null;

/** The figure as the evidence rules read it. */
function asEvidence(level: PacketLevel | null): Evidence | null {
  return level
    ? {
        metric_id: level.metric_id,
        value: level.value,
        period_end: level.period_end,
        match_method: level.match_method,
        margin_of_error: level.margin_of_error ?? null,
        survey: level.survey ?? false,
        source_id: level.source_id ?? undefined,
      }
    : null;
}

function salesContext(data: GuideData): Context {
  return { newest: data.newest, sales: find(data.levels, "sr1a_sales_count")?.value ?? null };
}

/** "Zillow Home Value Index, Aug 2026": who published a figure and for when. */
export function citation(data: GuideData, level: PacketLevel | null): string | null {
  if (!level) return null;
  const source = data.sources.find((s) => s.source_id === level.source_id);
  return `${source?.name ?? level.source_id ?? "this site"}, ${periodLabel(level.period_end, level.metric_id)}`;
}

// --- Can I afford to buy here? --------------------------------------------------------

/** Where a month's housing cost sits against HUD's two lines. */
export type Band = "within" | "burdened" | "severe";

export function bandOf(share: number): Band {
  if (share > SEVERE_SHARE) return "severe";
  if (share > BURDEN_SHARE) return "burdened";
  return "within";
}

export const BAND_TEXT: Record<Band, string> = {
  within: "That is within HUD’s 30% line, under which housing is not counted a cost burden.",
  burdened: "HUD counts a household paying over 30% of its income for housing as cost-burdened.",
  severe: "HUD counts a household paying over half its income for housing as severely cost-burdened.",
};

export type AffordAnswer = {
  price: HomePrice;
  month: Month;
  share: number;
  band: Band;
  fha: FhaCheck | null;
  /** What buyers here borrowing to buy reported earning, HMDA's newest year here. */
  buyers: { income: number; year: number; estimated: boolean } | null;
  limits: string | null;
  evidence: Judged;
};

/** The published costs of the typical home here, as the cost model takes them. */
function inputsFor(data: GuideData, price: HomePrice, ratePct: number, personal: Personal): Inputs {
  const value = (id: string) => find(data.levels, id)?.value ?? null;
  return ownershipInputs(
    {
      price: price.value,
      ratePct,
      taxYear: value("modiv_median_tax_bill"),
      insuranceYear: value("acs_median_home_insurance"),
      utilitiesMonth: utilityTotal(value("acs_median_electricity"), value("acs_median_gas"), value("acs_median_water_sewer")),
      rentMonth: value("zori_all"),
    },
    personal,
  );
}

function priceLevel(data: GuideData, price: HomePrice): PacketLevel | null {
  return find(data.levels, price.basis === "index" ? "zhvi_sfr" : "sr1a_median_sale_price");
}

export function affordAnswer(
  data: GuideData,
  input: { income: number; size: number; ratePct: number; personal: Personal; now?: string },
): AffordAnswer | null {
  const price = homePrice(data.levels, input.now);
  if (!price || input.income <= 0) return null;
  const month = eachMonth(inputsFor(data, price, input.ratePct, input.personal));
  const share = month.total / (input.income / 12);
  const fhaLevel = find(data.levels, "hud_fha_limit_1unit") ?? find(data.countyLevels, "hud_fha_limit_1unit");
  const fha = fhaCheck(month.loan, fhaLevel ? { value: fhaLevel.value, year: Number(fhaLevel.period_end.slice(0, 4)) } : null);
  const buyersLevel = find(data.levels, "hmda_median_income");
  const ctx = { newest: data.newest };
  const evidence = judgeAnswer([
    { label: "home price", figure: asEvidence(priceLevel(data, price)), context: salesContext(data) },
    { label: "property tax", figure: asEvidence(find(data.levels, "modiv_median_tax_bill")), context: ctx },
    { label: "insurance", figure: asEvidence(find(data.levels, "acs_median_home_insurance")), context: ctx },
    { label: "utilities", figure: asEvidence(find(data.levels, "acs_median_electricity")), context: ctx },
  ]);
  return {
    price,
    month,
    share,
    band: bandOf(share),
    fha,
    buyers: buyersLevel
      ? {
          income: buyersLevel.value,
          year: Number(buyersLevel.period_end.slice(0, 4)),
          estimated: buyersLevel.match_method === "tract_homes",
        }
      : null,
    limits: data.incomeLimits ? positionSentence(data.incomeLimits, input.size, input.income) : null,
    evidence,
  };
}

// --- Should I rent or buy? ------------------------------------------------------------

/** Rent-or-buy is answered over this many years at most. */
export const MAX_YEARS = 30;

export type RentOrBuy = {
  price: HomePrice;
  rent: number;
  /** The rent was the reader's own, not the published figure. */
  ownRent: boolean;
  /** The first whole year owning's net cost is at or under the rent paid; null within 30. */
  breakEven: number | null;
  /** Owning against renting at the reader's planned stay. */
  planned: Years;
  evidence: Judged;
};

/** The first year in 1–30 when owning, then selling, costs no more than renting. */
export function breakEvenYear(input: Inputs, maxYears = MAX_YEARS): number | null {
  for (let years = 1; years <= maxYears; years += 1) {
    const result = overYears({ ...input, years });
    if (result.rent !== null && result.net <= result.rent) return years;
  }
  return null;
}

export function rentOrBuy(
  data: GuideData,
  input: { ratePct: number; personal: Personal; rent?: number | null; now?: string },
): RentOrBuy | null {
  const price = homePrice(data.levels, input.now);
  const published = find(data.levels, "zori_all");
  const rent = input.rent ?? published?.value ?? null;
  if (!price || rent === null || rent <= 0) return null;
  const inputs = { ...inputsFor(data, price, input.ratePct, input.personal), rentMonth: rent };
  const ctx = { newest: data.newest };
  const evidence = judgeAnswer([
    { label: "home price", figure: asEvidence(priceLevel(data, price)), context: salesContext(data) },
    { label: "property tax", figure: asEvidence(find(data.levels, "modiv_median_tax_bill")), context: ctx },
    // The reader's own rent needs no evidence; the published one is judged like any other.
    ...(input.rent ? [] : [{ label: "rent", figure: asEvidence(published), context: ctx }]),
  ]);
  return {
    price,
    rent,
    ownRent: Boolean(input.rent),
    breakEven: breakEvenYear(inputs),
    planned: overYears(inputs),
    evidence,
  };
}

// --- Market turnover ------------------------------------------------------------------

export type Turnover = {
  latest: Observation;
  /** The place's windows since the deeds begin in 2020, the latest among them. */
  low: number;
  high: number;
  /** Where the latest window sits among this place's own. */
  position: "lowest" | "highest" | "within" | "only";
  county: PacketLevel | null;
};

/** The newest turnover window, against the place's own windows since 2020. */
export function turnoverPicture(series: Observation[], countyLevels: PacketLevel[]): Turnover | null {
  const latest = series.at(-1);
  if (!latest) return null;
  const values = series.map((o) => o.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const position =
    series.length === 1 ? "only" : latest.value === low ? "lowest" : latest.value === high ? "highest" : "within";
  return { latest, low, high, position, county: find(countyLevels, "sr1a_turnover_per_1000") };
}

// --- What should I check before an offer? ---------------------------------------------

export type CheckItem = {
  key: string;
  title: string;
  /** What the published figures say here, or that there are none. */
  finding: string;
  /** What the figures cannot say about one home. */
  limitation: string;
  source: string | null;
  /** Null where there is no local figure to judge — radon. */
  evidence: Judged | null;
  steps: Step[];
  /** What a publisher told the project about this check directly (#370). */
  inquiry?: Inquiry;
};

export const LINKS = {
  femaMap: { label: "Look up the address on FEMA’s flood map", href: "https://msc.fema.gov/portal/search" },
  floodDisclosure: { label: "New Jersey’s flood risk disclosure for sellers and landlords", href: "https://flooddisclosure.nj.gov/" },
  waterWatch: { label: "NJ Drinking Water Watch: the system’s tests and violations", href: "https://www9.state.nj.us/DEP_WaterWatch_public/" },
  leadMap: { label: "NJDEP’s lead service line map", href: "https://dep.nj.gov/lead/map/" },
  ccr: { label: "EPA: how to find your water system’s annual quality report", href: "https://www.epa.gov/ccr" },
  sitesMap: { label: "NJDEP’s map of known contaminated sites", href: "https://experience.arcgis.com/experience/f26272f8a41c4aeea77ac6f9b3c80ebb" },
  schools: { label: "NJ School Performance Reports", href: "https://www.nj.gov/education/schoolperformance/" },
  transit: { label: "NJ TRANSIT trip planning", href: "https://www.njtransit.com/" },
  rates: { label: "CFPB: explore today’s mortgage rates", href: "https://www.consumerfinance.gov/owning-a-home/explore-rates/" },
  fhaLimits: { label: "HUD’s FHA loan limit lookup", href: "https://entp.hud.gov/idapp/html/hicostlook.cfm" },
  reliability: { label: "NJ BPU: utility reliability", href: "https://www.nj.gov/bpu/about/divisions/reliability/" },
  radon: { label: "NJDEP’s radon program: testing and certified testers", href: "https://dep.nj.gov/rpp/radon/" },
  radonMap: { label: "NJDEP’s radon potential map and municipal tiers", href: "https://dep.nj.gov/rpp/radon/radon_map/" },
} satisfies Record<string, Step>;

function pct(share: number): string {
  return shareText(share);
}

function judged(data: GuideData, ...rows: [string, PacketLevel | null, Context?][]): Judged {
  return judgeAnswer(rows.map(([label, level, context]) => ({ label, figure: asEvidence(level), context: context ?? { newest: data.newest } })));
}

function floodItem(data: GuideData): CheckItem {
  const high = find(data.levels, "fema_flood_homes_share");
  const moderate = find(data.levels, "fema_flood_homes_share_moderate");
  const mapped = find(data.levels, "fema_mapped_homes_share");
  const tidal = find(data.levels, "njdep_tidal_homes_share");
  let finding: string;
  if (mapped && mapped.value < MAPPED_FLOOR) {
    finding = `FEMA’s digital flood map covers ${pct(mapped.value)} of homes here, too few to say what share is in a flood zone.`;
  } else if (high) {
    finding = `${pct(high.value)} of homes here are in FEMA’s high-risk flood zone` +
      (moderate ? `, and ${pct(moderate.value)} in its moderate-risk zone` : "") + ".";
    if (tidal && tidal.value > 0) finding += ` ${pct(tidal.value)} sit in areas New Jersey maps as at risk from tidal flooding.`;
  } else {
    finding = "No flood zone figure is published for this place.";
  }
  return {
    key: "flood",
    title: "Flood risk",
    finding,
    limitation: "A share of the place’s homes says nothing certain about one house, and homes outside a zone flood too. Lenders require flood insurance only inside the high-risk zone.",
    source: citation(data, high ?? mapped),
    evidence: judged(data, ["flood zone", high ?? mapped]),
    steps: [LINKS.femaMap, LINKS.floodDisclosure],
  };
}

function waterItem(data: GuideData): CheckItem {
  const onPublic = find(data.levels, "water_homes_share_public");
  const violation = find(data.levels, "water_homes_share_violation");
  const main = [...(data.water?.systems ?? [])].sort((a, b) => b.share_of_homes - a.share_of_homes)[0] ?? null;
  const parts: string[] = [];
  if (onPublic) parts.push(`${pct(onPublic.value)} of homes here are served by a community water system`);
  if (main) {
    const span = `${data.water!.first_year}–${data.water!.last_year}`;
    parts.push(
      `the largest, ${main.name}, had ${main.violations === 0 ? "no" : main.violations} health-based violation${main.violations === 1 ? "" : "s"} in ${span}`,
    );
    const lead = main.lead_inventory?.payload;
    if (lead && (lead.lead ?? 0) + (lead.galvanized ?? 0) > 0) {
      parts.push(
        `it reported ${((lead.lead ?? 0) + (lead.galvanized ?? 0)).toLocaleString("en-US")} lead or galvanized service lines in ${lead.submission_year}`,
      );
    }
  } else if (violation && violation.value > 0) {
    parts.push(`${pct(violation.value)} of homes are on a system with a recent health-based violation`);
  }
  const finding = parts.length
    ? `${parts.join("; ")}.`.replace(/^./, (c) => c.toUpperCase())
    : "No water system figure is published for this place.";
  const wells = onPublic && onPublic.value < 0.95;
  return {
    key: "water",
    title: "Drinking water, lead and PFAS",
    finding: wells ? `${finding} The rest are likely on private wells, which no public record here tests.` : finding,
    limitation: "A system’s record is not the water at one tap: a home’s own pipes and service line matter, and a private well is the owner’s to test.",
    source: citation(data, onPublic),
    evidence: judged(data, ["water service", onPublic]),
    steps: [LINKS.waterWatch, LINKS.leadMap, LINKS.ccr],
  };
}

function sitesItem(data: GuideData): CheckItem {
  const open = find(data.levels, "njdep_sites_open");
  const oil = find(data.levels, "njdep_sites_heating_oil");
  const finding = open
    ? `NJDEP lists ${formatValue(open.value, "count")} open contaminated site${open.value === 1 ? "" : "s"} here` +
      (oil && oil.value > 0 ? `, and ${formatValue(oil.value, "count")} home heating-oil tank case${oil.value === 1 ? "" : "s"}` : "") + "."
    : "No contaminated-site count is published for this place.";
  return {
    key: "sites",
    title: "Contaminated sites and oil tanks",
    finding,
    limitation: "A count for the whole place does not say how near any site is to one home. A buried heating-oil tank is often unrecorded until someone looks.",
    source: citation(data, open),
    evidence: judged(data, ["site count", open]),
    steps: [LINKS.sitesMap],
  };
}

function taxItem(data: GuideData, taxHref: string): CheckItem {
  const bill = find(data.levels, "modiv_median_tax_bill");
  const rate = find(data.levels, "nj_effective_tax_rate");
  const reval = find(data.levels, "nj_revaluation_year");
  const parts: string[] = [];
  if (bill) parts.push(`The typical tax bill here is ${formatValue(bill.value, "usd")} a year`);
  if (rate) parts.push(`the state’s effective rate is ${formatValue(rate.value, rate.unit)}`);
  let finding = parts.length ? `${parts.join("; ")}.` : "No typical tax bill is published for this place.";
  if (reval) finding += ` Assessments were last brought back to market value in ${Math.round(reval.value)}; a revaluation can move one home’s bill a long way.`;
  return {
    key: "tax",
    title: "The tax bill and revaluation",
    finding,
    limitation: "The typical bill is not this home’s. After a sale or a revaluation the bill can change.",
    source: citation(data, bill ?? rate),
    evidence: judged(data, ["tax bill", bill]),
    steps: [{ label: "Look up this property’s tax bill", href: taxHref }],
  };
}

function schoolItem(data: GuideData): CheckItem {
  const districts = data.community?.districts ?? [];
  const named = districts.map((d) => d.boundary.payload.name);
  const split = districts.length > 1 || districts.some((d) => d.boundary.payload.approximate_share < 0.95);
  const finding = named.length
    ? `${named.length === 1 ? "The school district here is" : "School districts here:"} ${named.join(", ")}.` +
      (split ? " The place is split between districts, so check which one serves the address." : "")
    : "No school district is published for this place.";
  const reports = districts.flatMap((d) => (d.performance ? [{ label: `${d.performance.payload.name}: performance report`, href: d.performance.payload.url }] : []));
  const evidence: Judged = !named.length
    ? { strength: "limited", reasons: ["no school district for this place"] }
    : split
      ? { strength: "partial", reasons: ["the place is split between districts"] }
      : { strength: "strong", reasons: [] };
  return {
    key: "school",
    title: "School district",
    finding,
    limitation: "A district is not a school: which school serves an address is the district’s to say.",
    source: districts.length ? `NJ Department of Education school district boundaries` : null,
    evidence,
    steps: [...reports, LINKS.schools],
  };
}

function commuteItem(data: GuideData): CheckItem {
  const minutes = find(data.levels, "acs_mean_commute_minutes");
  const rail = find(data.levels, "transit_rail_homes_share");
  const any = find(data.levels, "transit_any_homes_share");
  const parts: string[] = [];
  if (minutes) parts.push(`Workers here average ${Math.round(minutes.value)} minutes each way`);
  if (any) parts.push(`${pct(any.value)} of homes are within a short walk of a transit stop${rail ? `, ${pct(rail.value)} of a rail station` : ""}`);
  return {
    key: "commute",
    title: "Commute and transit",
    finding: parts.length ? `${parts.join("; ")}.` : "No commute or transit figure is published for this place.",
    limitation: "An average commute is everyone’s, not yours: try the trip you would make, at the hour you would make it.",
    source: citation(data, minutes ?? any),
    evidence: judged(data, ["commute", minutes]),
    steps: [LINKS.transit],
  };
}

function turnoverItem(data: GuideData, placeHref: string): CheckItem {
  const t = turnoverPicture(data.turnover, data.countyLevels);
  const level = find(data.levels, "sr1a_turnover_per_1000");
  let finding = "Too few recorded sales here to say how often homes change hands.";
  if (t) {
    const rate = (v: number) => v.toFixed(0);
    const span = `${periodLabel(t.latest.period_start)}–${periodLabel(t.latest.period_end)}`;
    finding = `About ${rate(t.latest.value)} of every 1,000 homes here sold each year in ${span}`;
    finding +=
      t.position === "only"
        ? "."
        : t.position === "within"
          ? `, within its range since 2020 (${rate(t.low)} to ${rate(t.high)}).`
          : `, the ${t.position} rate here since 2020 (range ${rate(t.low)} to ${rate(t.high)}).`;
    if (t.county && data.region.level !== "county") finding += ` The county’s rate is ${rate(t.county.value)}.`;
  }
  return {
    key: "turnover",
    title: "How often homes sell",
    finding,
    limitation: "Few sales can mean competition for what comes up, or simply owners who stay. The deeds begin in 2020, and each rate spans three overlapping years.",
    source: level
      ? `This site, from the state’s SR1A sales and MOD-IV parcel records, ${periodLabel(level.period_end)}`
      : null,
    evidence: judged(data, ["turnover", level, salesContext(data)]),
    steps: [{ label: "How homes sell here: prices and sales", href: `${placeHref}#sales-heading` }],
  };
}

function mortgageItem(data: GuideData): CheckItem {
  const rate = find(data.levels, "hmda_median_rate");
  const denial = find(data.levels, "hmda_denial_rate");
  const fha = find(data.levels, "hud_fha_limit_1unit") ?? find(data.countyLevels, "hud_fha_limit_1unit");
  const parts: string[] = [];
  if (rate) parts.push(`Buyers here borrowed at a median ${rate.value.toFixed(2)}% in ${rate.period_end.slice(0, 4)}`);
  if (denial) parts.push(`${pct(denial.value)} of home-purchase applications were denied`);
  if (fha) parts.push(`FHA insures loans up to ${formatValue(fha.value, "usd")} on a one-unit home in this county in ${fha.period_end.slice(0, 4)}`);
  return {
    key: "mortgage",
    title: "Mortgage context",
    finding: parts.length ? `${parts.join("; ")}.` : "No mortgage lending figure is published for this place.",
    limitation: "These are rates past borrowers got, not an offer: yours depends on your credit, down payment and the day you lock.",
    source: citation(data, rate ?? fha),
    evidence: judged(data, ["lending", rate]),
    steps: [LINKS.rates, LINKS.fhaLimits],
  };
}

function utilitiesItem(data: GuideData): CheckItem {
  const providers = data.utilities?.providers ?? [];
  const named = (fuel: string) => providers.filter((p) => p.fuel === fuel).map((p) => p.provider);
  const electric = named("electric");
  const gas = named("gas");
  const heat = [
    ["gas", find(data.levels, "acs_heat_gas_share")],
    ["electricity", find(data.levels, "acs_heat_electric_share")],
    ["oil", find(data.levels, "acs_heat_oil_share")],
    ["propane", find(data.levels, "acs_heat_propane_share")],
  ].filter((entry): entry is [string, PacketLevel] => entry[1] !== null).sort((a, b) => b[1].value - a[1].value)[0];
  const parts: string[] = [];
  if (electric.length) parts.push(`Electricity: ${electric.join(" or ")}`);
  if (gas.length) parts.push(`gas: ${gas.join(" or ")}`);
  if (heat) parts.push(`most homes here heat with ${heat[0]} (${pct(heat[1].value)})`);
  return {
    key: "utilities",
    title: "Utilities and outages",
    finding: parts.length ? `${parts.join("; ")}.` : "No utility territory is published for this place.",
    limitation: "Territories are drawn approximately, and a home’s own bills depend on its size, insulation and heating system: ask the seller for twelve months of them.",
    source: providers.length ? "NJDEP utility service territories" : null,
    evidence: judged(data, ["heating fuel", heat?.[1] ?? null]),
    steps: [LINKS.reliability],
  };
}

/** Radon has no local figure here: NJDEP's tiers are 2015's, a new map is coming (#370),
 * and NJDEP says to test every home anyway. */
export const RADON: CheckItem = {
  key: "radon",
  title: "Radon",
  finding:
    "Radon levels differ from house to house, even next door. NJDEP recommends testing every home, whatever its town’s radon tier: hire an NJDEP-certified tester, or use a home test kit.",
  limitation:
    "This site shows no radon tier for the place: NJDEP’s municipal tiers date from 2015 and NJDEP is building a new map, and a low tier is no reason to skip the test.",
  source: null,
  evidence: null,
  steps: [LINKS.radon, LINKS.radonMap],
  inquiry: RADON_MAP_INQUIRY,
};

/** The before-an-offer checklist, in the order a buyer meets them. */
export function checklist(data: GuideData, hrefs: { place: string; tax: string }): CheckItem[] {
  return [
    floodItem(data),
    waterItem(data),
    sitesItem(data),
    RADON,
    utilitiesItem(data),
    taxItem(data, hrefs.tax),
    schoolItem(data),
    commuteItem(data),
    turnoverItem(data, hrefs.place),
    mortgageItem(data),
  ];
}
