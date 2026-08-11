const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Health = {
  status: "ok" | "degraded";
  version: string;
  database: {
    connected: boolean;
    migrated: boolean;
    error: string | null;
    last_load_at: string | null;
  };
  detail: string | null;
};

type Result = { ok: true; health: Health } | { ok: false; reason: string };

async function getHealth(): Promise<Result> {
  try {
    const res = await fetch(`${API_URL}/health`, { cache: "no-store" });
    if (!res.ok) {
      return { ok: false, reason: `API responded ${res.status}` };
    }
    return { ok: true, health: (await res.json()) as Health };
  } catch {
    // The API being down is a normal state to render, not a crash.
    return { ok: false, reason: `Cannot reach the API at ${API_URL}` };
  }
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn" | "err";
}) {
  return (
    <div className="row">
      <span className="key">{label}</span>
      <span className={`val ${tone ?? ""}`}>{value}</span>
    </div>
  );
}

export default async function Home() {
  const result = await getHealth();

  return (
    <main>
      <h1>Housing Intelligence Platform</h1>
      <p className="sub">
        Milestone 0 — scaffolding. This page exists to prove the dashboard reaches
        the API.
      </p>

      {!result.ok ? (
        <div className="card">
          <Row label="API" value="unreachable" tone="err" />
          <Row label="Reason" value={result.reason} />
          <p className="sub" style={{ margin: "1rem 0 0" }}>
            Start it with <code>make api</code>.
          </p>
        </div>
      ) : (
        <div className="card">
          <Row
            label="API"
            value={`reachable — v${result.health.version}`}
            tone="ok"
          />
          <Row
            label="Status"
            value={result.health.status}
            tone={result.health.status === "ok" ? "ok" : "warn"}
          />
          <Row
            label="Warehouse"
            value={result.health.database.connected ? "connected" : "unreachable"}
            tone={result.health.database.connected ? "ok" : "warn"}
          />
          <Row
            label="Schema"
            value={result.health.database.migrated ? "migrated" : "not migrated"}
            tone={result.health.database.migrated ? "ok" : "warn"}
          />
          <Row
            label="Last load"
            value={result.health.database.last_load_at ?? "never"}
          />
          {result.health.detail && (
            <p className="sub" style={{ margin: "1rem 0 0" }}>
              {result.health.detail}
            </p>
          )}
        </div>
      )}
    </main>
  );
}
