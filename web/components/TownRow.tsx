import { PlaceDirectory } from "./PlaceDirectory";

export function TownRow({ name, towns }: { name: string; towns: { id: number; name: string; href: string }[] }) {
  return <PlaceDirectory id="county-towns" title={`Towns in ${name}`} destinations={towns} />;
}
