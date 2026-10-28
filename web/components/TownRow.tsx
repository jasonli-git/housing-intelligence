import { PlaceDirectory } from "./PlaceDirectory";

export function TownRow({ name, towns }: { name: string; towns: { id: number; name: string; href: string }[] }) {
  // A county header's compact directory: the towns as pills beside the photograph.
  return <PlaceDirectory id="county-towns" className="town-pills" title={`Towns in ${name}`} destinations={towns} preview={12} />;
}
