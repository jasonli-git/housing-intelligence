import type { Metadata } from "next";
import Link from "next/link";

import { Crumbs } from "@/components/Crumbs";
import { Masthead } from "@/components/Masthead";
import { SectionJump } from "@/components/SectionJump";
import { dayLabel } from "@/lib/freshness";
import { CONTACT_EMAIL, OPERATOR, POLICIES_UPDATED, PRIVACY_EMAIL } from "@/lib/site";
import { pageMetadata } from "@/lib/meta";

export const metadata: Metadata = pageMetadata({
  title: "Privacy policy — Housing",
  description:
    "No accounts, cookies, analytics, ads or trackers. What stays in your browser, what the " +
    "host sees, and what happens to an email or a Daniel's Law removal request.",
  path: "/privacy",
});

/**
 * The privacy policy (ARCHITECTURE #357). Every claim here is a fact about the code: the
 * two things kept in browser storage (the theme, and what a reader types into the
 * affordability tools: `lib/household.ts`, `lib/costScenario.ts`); a section's open state
 * is not kept (`MoreExpander`), the tax lookup's requests (`TaxLookup.tsx`: a street
 * index file by its first two letters, then a town's file, never the typed address), and
 * the removal list kept off the site and out of the repository (#295, #296). A change to
 * any of those changes this page.
 */
export default function PrivacyPage() {
  return (
    <>
      <Masthead affordability={{ kind: "hidden" }} />
      <main id="main-content" tabIndex={-1} className="shell atlas-page atlas-ledger quiet-county quiet-history legal-page">
        <header className="page-head">
          <div>
            <Crumbs trail={[{ href: "/", label: "United States" }]} here="Privacy policy" />
            <h1 className="page-title">Privacy policy</h1>
            <p className="meta">Last updated {dayLabel(POLICIES_UPDATED)}. See also the <Link href="/terms">terms of use</Link>.</p>
            <nav className="page-section-nav" aria-label="Page sections"><SectionJump /></nav>
          </div>
        </header>

        <section className="section" aria-labelledby="privacy-short">
          <h2 id="privacy-short">In short</h2>
          <p>
            This site, run by {OPERATOR}, has no accounts, cookies, analytics, advertising or
            third-party trackers. It does not collect anything about you to keep.
          </p>
        </section>

        <section className="section" aria-labelledby="privacy-browser">
          <h2 id="privacy-browser">What stays in your browser</h2>
          <p>
            Two things are saved in your own browser&rsquo;s storage so they carry from page to
            page, and only when you set them. They are never sent to this site or anyone else.
            Nothing about how you browse, such as which sections you open, is kept:
          </p>
          <ul>
            <li>the light or dark theme you picked, if you picked one;</li>
            <li>
              your household&rsquo;s size, income, rent and savings, and the mortgage assumptions you
              set, if you type them into the affordability tools.
            </li>
          </ul>
          <p>
            Clearing this site&rsquo;s data in your browser&rsquo;s settings removes them. A private
            window keeps nothing after it closes.
          </p>
        </section>

        <section className="section" aria-labelledby="privacy-host">
          <h2 id="privacy-host">What the host sees</h2>
          <p>
            The site and its data files are served by Cloudflare. Like any web host, Cloudflare
            handles each visit&rsquo;s IP address, browser and the pages requested, in order to
            deliver and protect the site, under{" "}
            <a href="https://www.cloudflare.com/privacypolicy/" rel="noreferrer noopener" target="_blank">
              its own privacy policy
            </a>
            . {OPERATOR} sees only Cloudflare&rsquo;s aggregate totals, such as the number of
            requests, never a record of who visited. Fonts and scripts come from this site itself,
            not from third parties.
          </p>
          <p>
            The property tax lookup matches the address you type inside your browser. To do it,
            the page downloads a street index file named for the street&rsquo;s first two letters
            and the file of the town it finds; the full address you type is never sent.
          </p>
        </section>

        <section className="section" aria-labelledby="privacy-report">
          <h2 id="privacy-report">Reporting a problem</h2>
          <p>
            A figure&rsquo;s <em>Report a problem</em> link opens a pre-filled issue on GitHub. It
            needs a GitHub account, and what you submit is public under your username, under{" "}
            <a href="https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement" rel="noreferrer noopener" target="_blank">
              GitHub&rsquo;s privacy statement
            </a>
            . If you would rather not post publicly, email{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> instead.
          </p>
        </section>

        <section className="section" aria-labelledby="privacy-email">
          <h2 id="privacy-email">If you email</h2>
          <p>
            An email to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> or{" "}
            <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a> is read by {OPERATOR} and
            kept only to answer it. It is not shared or used for anything else.
          </p>
          <p>
            <strong>Daniel&rsquo;s Law removals.</strong> A request to remove a home address from the
            tax lookup goes to <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>. The address
            and town are added to a private removal list, kept outside the site and its public
            code, and used only to keep that property off the lookup for as long as the removal
            stands.
          </p>
        </section>

        <section className="section" aria-labelledby="privacy-rest">
          <h2 id="privacy-rest">Children, changes and contact</h2>
          <p>
            The site is not directed at children and collects nothing from anyone. This policy may
            change; the date at the top says when it last did. To ask what is held about you,
            which can only be an email you sent, or to have it deleted, write to{" "}
            <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>.
          </p>
        </section>
      </main>
    </>
  );
}
