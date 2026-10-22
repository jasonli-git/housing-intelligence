import type { Metadata } from "next";

import { IncomeScatter } from "@/components/IncomeScatter";
import { StoryShell } from "@/components/StoryShell";
import { pageMetadata } from "@/lib/meta";
import { storyTowns } from "@/lib/storyData";
import "../../horizon-theme.css";
import "../stories.css";

export const metadata: Metadata = pageMetadata({
  title: "Income against home value — Housing",
  description: "Every New Jersey town's median household income against its median home value, with the 3× and 5× lines.",
  path: "/stories/income-and-home-value",
});

export default async function IncomeAndHomeValuePage() {
  const towns = await storyTowns(["acs_median_hh_income", "acs_median_home_value"]);
  const points = towns.flatMap((t) => {
    const income = t.values.acs_median_hh_income, value = t.values.acs_median_home_value;
    return income && value ? [{ id: t.id, name: t.name, county: t.countyName, income, value }] : [];
  });
  return (
    <StoryShell
      title="Income against home value"
      lede="Each dot is a town: across, what its households earn; up, what its homes are worth. Lenders and planners have long treated a home at three times income as affordable and five as stretched. Find your town to see where it falls."
      note={<>Both figures come from the same Census survey, the five-year American Community Survey: the median income of all households, and the median value owners put on their homes. {points.length} of New Jersey&rsquo;s 564 towns have both. Each carries a margin of error, shown on the town&rsquo;s page; for small towns it can be wide.</>}
    >
      <IncomeScatter points={points} />
    </StoryShell>
  );
}
