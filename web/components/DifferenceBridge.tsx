import {formatValue} from "@/lib/format";

/** Sentence case for prose, preserving initialisms such as HOA. */
export const sentenceCostLabel=(label:string)=>label.replace(/^[A-Z](?=[a-z])/,c=>c.toLowerCase());

export function DifferenceBridge({own,rent,principal,kind,gap,missing}:{own:number;rent:number;principal:number;kind:"more"|"less"|"about";gap:number;missing:string[]}) {
  const money=(n:number)=>formatValue(n,"usd");
  return <div className="difference-bridge" aria-live="polite">
    <svg viewBox="0 0 600 60" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M0 50C140 50 180 8 300 8S460 50 600 50M0 58C140 58 180 16 300 16S460 58 600 58"/></svg>
    <div className="bridge-anchor"><span>Owning · money spent</span><strong>{money(own)}</strong><small>per month</small></div>
    <div className="bridge-difference"><strong>{kind==="about" ? "About the same" : money(Math.abs(gap))}</strong><span>{kind==="about" ? "as renting" : `a month ${kind} to own`}</span></div>
    <div className="bridge-anchor"><span>Renting</span><strong>{money(rent)}</strong><small>per month</small></div>
    <p className="bridge-context">Utilities excluded from both.{missing.length>0 && ` Also missing from owning: ${missing.map(sentenceCostLabel).join(", ")}.`} First payment: <b>{money(principal)}</b> pays down the loan, separate from money spent.</p>
  </div>;
}
