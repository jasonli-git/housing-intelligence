import type { CommunityContext } from "@/lib/api";

/** Published state shares, never substituted for an address-specific service check. */
export function StateBroadband({ data }: { data: CommunityContext | null }) {
  const wired = data?.broadband.find(record => record.payload.technology === "All Wired");
  const fiber = data?.broadband.find(record => record.payload.technology === "Fiber");
  if (!wired) return <p>No statewide availability summary is loaded. <a href="https://broadbandmap.fcc.gov/">Check the FCC map by address</a>.</p>;
  const rows = [
    { label: "Wired · 100 down / 20 up Mbps", value: wired.payload.shares.speed_100_20 },
    { label: "Wired · 1,000 down / 100 up Mbps", value: wired.payload.shares.speed_1000_100 },
    ...(fiber ? [{ label: "Fiber · 100 down / 20 up Mbps", value: fiber.payload.shares.speed_100_20 }] : []),
  ];
  return <section className="state-broadband" aria-label="New Jersey broadband availability">
    <dl className="utility-reliability">{rows.map(row => <div key={row.label}><dt>{row.label}</dt><dd>{Number.isFinite(row.value) ? `${(row.value * 100).toFixed(1)}%` : "Not published"}</dd></div>)}</dl>
    <p className="sales-note">As of {wired.payload.as_of} · revised {wired.payload.revision}. Provider-reported residential-service offers—not measured speeds, subscribers or a guarantee at a home.</p>
    <p className="sales-note">Shares of {wired.payload.total_units.toLocaleString("en-US")} FCC mapped units across broadband-serviceable locations, including multi-unit buildings—not households or people. Wired and fiber overlap; do not add their percentages.</p>
    <p className="sales-note"><a href="https://broadbandmap.fcc.gov/" target="_blank" rel="noreferrer">Check providers at an address</a> · <a href={wired.payload.url} target="_blank" rel="noreferrer">FCC published summaries</a>. Confirm the plan with the provider.</p>
  </section>;
}
