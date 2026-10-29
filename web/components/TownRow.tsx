import { PlaceDirectory } from "./PlaceDirectory";

export function TownRow({ name, towns }: { name: string; towns: { id: number; name: string; href: string }[] }) {
  // A county header's compact directory: every town as a pill in one sideways-scrolling
  // row beside the photograph, however many towns the county has.
  return <PlaceDirectory id="county-towns" className="town-pills" title={`Towns in ${name}`} destinations={towns} preview={Infinity} />;
}
