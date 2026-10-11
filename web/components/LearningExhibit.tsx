import type { ReactNode } from "react";

/** Decorative motion is separate from the measurements, which never animate their value. */
export function LearningExhibit({ kind, children }: { kind: string; children: ReactNode }) {
  return <div className="learning-exhibit" data-exhibit={kind}>
    <div className="exhibit-kicker"><span>Field notes · {kind}</span><span>Explore at your own pace</span></div>
    <svg className="exhibit-linework" viewBox="0 0 600 180" fill="none" aria-hidden="true">
      <path pathLength="1" d="M-20 150C80 10 130 190 250 80S430 10 620 100M-20 170C100 30 130 210 270 100S440 30 620 120M-20 130C70-10 150 170 230 60S410-10 620 80" />
    </svg>
    <div className="exhibit-content">{children}</div>
  </div>;
}
