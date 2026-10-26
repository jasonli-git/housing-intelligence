import type { CountyDestination } from "@/lib/countyPicker";
import { regionPath } from "@/lib/placeRoutes";
import { PlaceDirectory } from "./PlaceDirectory";

export function CountyCabinet({ counties }: { counties: CountyDestination[] }) {
  return <PlaceDirectory id="state-county-navigation" title="Explore New Jersey counties" destinations={counties.map(county => ({...county, href:regionPath(county.id), label:`Explore ${county.name}`}))} />;
}
