import type { ReactNode } from "react";

/** Decorative motion is separate from the measurements, which never animate their value. */
export function LearningExhibit({ kind, children }: { kind: string; children: ReactNode }) {
  const style = kind === "Prices & paychecks" ? "paychecks" : kind === "Against its own history" ? "history" : kind === "Arrivals & departures" ? "migration" : ["New homes", "Building & demolition"].includes(kind) ? "building" : "sales";
  const paths = {
    sales: "M40 40h100m-50-10v20m70 20h180m-90-10v20m110 20h150m-75-10v20",
    paychecks: "M0 150C150 150 200 100 300 100S450 20 600 20M0 160C150 160 200 140 300 140S450 110 600 110",
    history: "M0 45h600M0 90h600M0 135h600M60 20v140m100-140v140m100-140v140m100-140v140m100-140v140",
    building: "M20 160V90l50-40 50 40v70m30 0V30h80v130m30 0V70h100v90m30 0V20h100v140M0 160h600",
    migration: "M0 160C180 160 220 30 400 30h200M0 20C180 20 220 140 400 140h200M0 90h600",
  };
  return <div className="learning-exhibit" data-exhibit={kind} data-exhibit-style={style}>
    <div className="exhibit-kicker"><span>Field notes · {kind}</span><span>Explore at your own pace</span></div>
    <svg className="exhibit-linework" viewBox="0 0 600 180" fill="none" aria-hidden="true">
      <path pathLength="1" d={paths[style]} />
    </svg>
    <div className="exhibit-content">{children}</div>
  </div>;
}
