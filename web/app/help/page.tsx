import Link from "next/link";
import { Masthead } from "@/components/Masthead";
import { StepIcon } from "@/components/StepIcon";
import { HelpRedirect } from "@/components/HelpRedirect";
import { APPLICATION_ROUTES } from "@/lib/affordableHousing";
import { pageMetadata } from "@/lib/meta";
import "../tool-pages.css";
import "../horizon-theme.css";
import "./help.css";

export const metadata = pageMetadata({
  title: "Housing help — Housing",
  description: "The three official New Jersey routes to help with housing costs.",
  path: "/help",
});

/** #497: Housing help is the three official routes and nothing else; the records moved. */
export default function HousingHelpPage() {
  return <>
    <HelpRedirect />
    <Masthead affordability={{ kind: "route" }} helpActive title="Housing help" />
    <main id="main-content" tabIndex={-1} className="shell horizon-page hh-page" data-region-level="help" data-kind="help">
      <header className="hh-head">
        <h2>What do you need?</h2>
        <p>Three official routes in New Jersey. Pick the one that sounds like you.</p>
      </header>
      <ol className="hh-routes">{APPLICATION_ROUTES.map((r, i) => <li key={r.url}>
        <a href={r.url} target="_blank" rel="noreferrer">
          <span className="hh-num" aria-hidden="true">{i + 1}</span>
          <StepIcon name={r.icon} />
          <b className="hh-when">{r.when}</b>
          <span className="hh-go"><strong>{r.label}</strong><span aria-hidden="true">↗</span></span>
          <small className="hh-agency">{r.agency}</small>
        </a>
      </li>)}</ol>
      <p className="hh-fine">These go to the official offices. Only they decide who qualifies, and we don’t check openings or waiting lists. Links checked Oct 4, 2026.</p>
      <Link className="hh-records" href="/affordable-housing">
        <span><b>Looking at a particular town?</b><small>See the affordable buildings on record there, and who to call.</small></span>
        <span aria-hidden="true">→</span>
      </Link>
    </main>
  </>;
}
