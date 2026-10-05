export type CountyDestination = { id: number; name: string };

export function matchingCounties(counties: CountyDestination[], query: string) {
  const term = query.trim().toLocaleLowerCase("en-US");
  return counties.filter((county) => county.name.toLocaleLowerCase("en-US").includes(term))
    .sort((a, b) => a.name.localeCompare(b.name, "en-US"));
}
