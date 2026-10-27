import type { Metadata } from "next";

import { StackedBars } from "@/components/StackedBars";
import { StoryShell } from "@/components/StoryShell";
import { api, artifactUrl, type WaterSystem } from "@/lib/api";
import { initialPlaceStory } from "@/lib/placeStoryData";
import { PlaceStoryFocus } from "@/components/PlaceStoryFocus";
import { pageMetadata } from "@/lib/meta";
import { each, storyTownRegions } from "@/lib/storyData";
import "../../horizon-theme.css";
import "../stories.css";

export const metadata: Metadata = pageMetadata({
  title: "Water you can check — Housing",
  description: "New Jersey's water systems with health-based violations, PFAS results against the EPA reference, and lead service lines.",
  path: "/stories/water-you-can-check",
});

const n = (v: number) => Math.round(v).toLocaleString("en-US");
/** The state's system names are upper case; read as words, keeping the abbreviations. */
const KEEP = new Set(["NJ", "MUA", "MUD", "WD", "WC", "WU", "DPW", "UA", "SA", "WSA", "USA", "II"]);
const title = (s: string) => s.split(/\s+/).map((w) => (KEEP.has(w.toUpperCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())).join(" ");

export default async function WaterYouCanCheckPage() {
  const initial = await initialPlaceStory("water");
  const towns = await storyTownRegions();
  const served = await each(towns, (t) => api.waterSystems(t.region_id));
  // A system serving several towns appears under each; keep it once, with the towns it serves.
  const systems = new Map<string, WaterSystem & { towns: string[]; allHomes: number }>();
  served.forEach((w, i) => {
    for (const s of w?.systems ?? []) {
      const kept = systems.get(s.pwsid) ?? { ...s, towns: [], allHomes: 0 };
      kept.towns.push(towns[i].name);
      kept.allHomes += s.homes;
      systems.set(s.pwsid, kept);
    }
  });
  const all = [...systems.values()];
  const range = served.find((w) => w)?.first_year;
  const lastYear = served.find((w) => w)?.last_year;
  const violating = all.filter((s) => s.violations > 0).sort((a, b) => b.allHomes - a.allHomes);
  const pfas = all.flatMap((s) => (s.pfas_samples ?? []).flatMap((p) => {
    const r = p.payload;
    return r.reference_ng_l && r.maximum_ng_l && r.maximum_ng_l > r.reference_ng_l ? [{ s, contaminant: r.contaminant, max: r.maximum_ng_l, limit: r.reference_ng_l, above: r.samples_above_reference, samples: r.samples }] : [];
  })).sort((a, b) => b.max / b.limit - a.max / a.limit);
  const pfasSampled = all.filter((s) => s.pfas_samples?.length).length;
  const lead = all.flatMap((s) => {
    const p = s.lead_inventory?.payload;
    return p && (p.lead ?? 0) + (p.galvanized ?? 0) > 0 ? [{ s, lead: p.lead ?? 0, galvanized: p.galvanized ?? 0, unknown: p.unknown ?? 0, year: p.submission_year }] : [];
  }).sort((a, b) => b.lead + b.galvanized - (a.lead + a.galvanized));
  const leadTotal = lead.reduce((t, l) => t + l.lead + l.galvanized, 0);
  return (
    <StoryShell
      title="Water you can check"
      focus={<PlaceStoryFocus initial={initial} artifactUrl={artifactUrl} />}
      lede={<>{all.length} community water systems serve New Jersey&rsquo;s towns. Three things about them are public and checkable: whether a system broke a health-based rule, what its PFAS tests found, and how many lead pipes still connect its customers.</>}
      note={<>Violations: the EPA&rsquo;s Safe Drinking Water Information System, health-based violations {range} to {lastYear}. PFAS: the EPA&rsquo;s fifth Unregulated Contaminant Monitoring Rule samples, against the EPA&rsquo;s reference of 4 nanograms a litre, shown for PFOA and PFOS only. Compliance is judged on running annual averages, not the single highest result shown here. Lead: each system&rsquo;s service-line inventory as filed with the state; galvanized lines that were ever downstream of lead must be replaced too. A violation can be resolved; each system&rsquo;s town pages show when.</>}
    >
      <h2 className="story-h">Systems with a health-based violation</h2>
      <p className="story-note">{violating.length} of {all.length} systems; bar: homes served, beside it the latest rule broken.</p>
      <StackedBars
        parts={[{ key: "homes", label: "Homes served" }]}
        format={n}
        heads={["System", "Violations"]}
        ticks={[100_000, 200_000, 300_000].filter((v) => v < (violating[0]?.allHomes ?? 0)).map((v) => ({ at: v, label: n(v) }))}
        label="Bars: the water systems with a health-based violation, by homes served."
        rows={violating.slice(0, 20).map((s) => ({
          id: s.pwsid,
          name: title(s.name),
          aside: `${s.latest_violation_what ?? "violation"}, ${s.latest_violation?.slice(0, 4)}`,
          values: { homes: s.allHomes },
          total: `${s.violations}`,
        }))}
      />
      <h2 className="story-h">PFAS results above the EPA reference</h2>
      <p className="story-note">{new Set(pfas.map((p) => p.s.pwsid)).size} of the {pfasSampled} systems sampled had a PFOA or PFOS result above 4 ng/L. The bar is the highest single result as a multiple of it.</p>
      <StackedBars
        parts={[{ key: "times", label: "Highest result, times the reference" }]}
        format={(v) => `${v.toFixed(1)}×`}
        heads={["System", "Highest"]}
        ticks={[1, 5, 10].map((v) => ({ at: v, label: v === 1 ? "1× = EPA reference" : `${v}×` }))}
        label="Bars: each water system's highest PFAS result as a multiple of the EPA reference."
        rows={pfas.slice(0, 20).map((p) => ({ id: `${p.s.pwsid}-${p.contaminant}`, name: title(p.s.name), aside: p.contaminant, values: { times: p.max / p.limit }, total: `${Number(p.max.toFixed(1))} ng/L` }))}
      />
      <h2 className="story-h">Lead service lines still in the ground</h2>
      <p className="story-note">{n(leadTotal)} lead and galvanized lines across {lead.length} systems; the 20 with the most.</p>
      <StackedBars
        parts={[{ key: "lead", label: "Lead" }, { key: "galvanized", label: "Galvanized" }]}
        format={n}
        heads={["System", "Lines"]}
        ticks={[5000, 10_000].map((v) => ({ at: v, label: n(v) }))}
        label="Stacked bars: each water system's lead and galvanized service lines."
        rows={lead.slice(0, 20).map((l) => ({ id: l.s.pwsid, name: title(l.s.name), aside: `${l.year}${l.unknown ? `, ${n(l.unknown)} more of unknown material` : ""}`, values: { lead: l.lead, galvanized: l.galvanized }, total: n(l.lead + l.galvanized) }))}
      />
    </StoryShell>
  );
}
