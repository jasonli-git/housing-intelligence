import type { Metadata } from "next";
import Link from "next/link";

import { Crumbs } from "@/components/Crumbs";
import { Masthead } from "@/components/Masthead";
import { api } from "@/lib/api";
import { dayLabel } from "@/lib/freshness";
import { pageMetadata } from "@/lib/meta";
import { byInstitution, isRestricted } from "@/lib/sources";
import "./sources-page.css";

export const metadata: Metadata = pageMetadata({
  title: "Sources and notices — Housing",
  description:
    "Every source behind the site's figures: who publishes it, the terms it sets, and the notice each requires.",
  path: "/sources",
});

/** A notice with any address in it made a link: FRED's requires a link to its terms. */
function linked(notice: string) {
  return notice.split(/(https:\/\/\S+)/).map((part, index) =>
    part.startsWith("https://") ? (
      <a key={index} href={part} rel="noreferrer noopener" target="_blank">
        {part.replace(/^https:\/\//, "")}
      </a>
    ) : (
      part
    ),
  );
}

/**
 * Every source's terms and required notice, in full (2026-10-19, ARCHITECTURE #386). The
 * footer keeps on every page only what must be there — Zillow's citation, which its terms
 * require on each page showing its data, and the Census and FRED API notices, which their
 * terms ask for "prominently" — and links here for the rest. NJDEP's notice also sits on
 * the exhibits drawn from its data. Rendered from `GET /sources`, as the footer is.
 */
export default async function SourcesPage() {
  const sources = (await api.sources()) ?? [];
  const external = sources.filter((s) => s.source_id !== "hip_derived");
  const institutions = byInstitution(external);

  return (
    <>
      <Masthead affordability={{ kind: "hidden" }} />
      <main id="main-content" tabIndex={-1} className="shell atlas-page atlas-ledger quiet-county quiet-history legal-page sources-page">
        <header className="page-head">
          <div>
            <Crumbs trail={[{ href: "/", label: "United States" }]} here="Sources and notices" />
            <h1 className="page-title">Sources and notices</h1>
            <p className="meta">
              Every figure on this site comes from one of these {external.length} sources. Each is listed with
              the terms it sets and, where it asks for one, its notice in full. How current each is
              is on the <Link href="/freshness">freshness page</Link>; what the site&rsquo;s own terms say
              is in the <Link href="/terms">terms of use</Link>.
            </p>
          </div>
        </header>

        {institutions.map((institution) => (
          <section className="section source-institution" key={institution.publisher} aria-label={institution.publisher}>
            <h2>{institution.publisher}</h2>
            {institution.license && <p className="meta">{institution.license}</p>}
            <ul className="source-list">
              {institution.sources.map((source) => (
                <li key={source.source_id}>
                  <p className="source-name">
                    <a href={source.homepage} rel="noreferrer noopener" target="_blank">
                      {source.name} <span aria-hidden="true">↗</span>
                    </a>
                    {isRestricted(source) && <span className="nc-tag">Non-commercial</span>}
                  </p>
                  <p className="source-meta">
                    {[
                      source.cadence,
                      source.originators?.length ? `series owned by ${source.originators.join(" and ")}` : null,
                      !institution.license ? source.license : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {source.terms_url && (
                    <p className="source-meta">
                      <a href={source.terms_url} rel="noreferrer noopener" target="_blank">Terms</a>
                      {source.terms_checked && <> · read {dayLabel(source.terms_checked)}</>}
                    </p>
                  )}
                  {source.notices?.map((notice) => (
                    <blockquote className="source-notice" key={notice}>
                      {linked(notice)}
                    </blockquote>
                  ))}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
    </>
  );
}
