import type { Metadata } from "next";

import { HousingMix } from "@/components/HousingMix";
import { StoryShell } from "@/components/StoryShell";
import { pageMetadata } from "@/lib/meta";
import { storyTowns } from "@/lib/storyData";
import "../../horizon-theme.css";
import "../stories.css";

export const metadata: Metadata = pageMetadata({
  title: "What the housing is — Housing",
  description: "How old every New Jersey town's homes are, and what kind of building they are in.",
  path: "/stories/what-the-housing-is",
});

const AGE = [
  { key: "acs_share_built_pre_1940", label: "Before 1940" },
  { key: "acs_share_built_1940_1979", label: "1940–1979" },
  { key: "acs_share_built_1980_1999", label: "1980–1999" },
  { key: "acs_share_built_2000_later", label: "2000 or later" },
];
const TYPE = [
  { key: "acs_share_detached", label: "Detached house" },
  { key: "acs_share_attached", label: "Townhouse" },
  { key: "acs_share_2_4_units", label: "2–4 homes" },
  { key: "acs_share_5_19_units", label: "5–19 homes" },
  { key: "acs_share_20plus_units", label: "20 or more" },
  { key: "acs_share_mobile_homes", label: "Mobile home" },
];

export default async function WhatTheHousingIsPage() {
  const towns = await storyTowns([...AGE, ...TYPE].map((p) => p.key));
  const rows = towns.filter((t) => t.values.acs_share_detached !== undefined).map((t) => ({ id: t.id, name: t.name, county: t.countyName, values: t.values }));
  const counties = [...new Set(rows.map((r) => r.county))].sort();
  return (
    <StoryShell
      title="What the housing is"
      lede="Two bars for every town. The first is when its homes were built, oldest on the left; the second is the kind of building they are in, from detached houses to buildings of 20 homes or more."
      note={<>The Census Bureau&rsquo;s five-year American Community Survey: shares of all homes, occupied or not. Survey shares carry margins of error, widest in small towns; each town&rsquo;s page shows them.</>}
    >
      <HousingMix rows={rows} counties={counties} age={AGE} type={TYPE} />
    </StoryShell>
  );
}
