import { Gloss } from "@/components/Gloss";
import type { BroadbandPlace as Place, CommunityRecord } from "@/lib/api";

const share = (n: number, of: number) => `${((n / of) * 100).toFixed(1)}%`;

/** A place's own fiber reach and unserved count, from FCC's location files (#372). */
export function BroadbandPlace({ record, name }: { record: CommunityRecord<Place>; name: string }) {
  const p = record.payload;
  return <div className="broadband-place">
    <dl className="utility-reliability">
      <div><dt>Locations with a fiber offer</dt><dd>{share(p.fiber, p.locations)}</dd></div>
      <div><dt><Gloss>No wired offer of 100 down / 20 up Mbps</Gloss></dt><dd>{p.unserved_wired.toLocaleString("en-US")} {p.unserved_wired === 1 ? "location" : "locations"}</dd></div>
    </dl>
    <p className="sales-note">Of {p.locations.toLocaleString("en-US")} broadband-serviceable locations FCC maps in {name}—buildings and other places service could be installed, which can hold many homes or none, so these are not shares of households. {p.unserved_terrestrial === 0 ? "Every one has a wired or fixed-wireless offer at that speed." : `${p.unserved_terrestrial.toLocaleString("en-US")} have no wired or fixed-wireless offer at that speed.`}</p>
    <p className="sales-note">Availability as of {p.as_of} · revised {p.revision}. Provider reports, not speed tests, prices or a guarantee at an address. Counted from <a href={p.url} target="_blank" rel="noreferrer">FCC’s New Jersey location files</a> by census block.</p>
  </div>;
}
