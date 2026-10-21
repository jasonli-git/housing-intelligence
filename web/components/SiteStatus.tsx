"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { artifactUrl } from "@/lib/api";
import { statusWords, type CheckStatus } from "@/lib/siteStatus";

/**
 * When the sources were last checked (ARCHITECTURE #411). The weekly refresh uploads
 * `status.json` beside the data after every successful check, a quiet week included,
 * so the link can say "checked Oct 17" though the pages were built earlier. Without it
 * — no script, an unreadable file — the link names the Friday schedule, as it always
 * has; the footer keeps the build date and the linked page each source's dates.
 */
export function SiteStatus() {
  const [status, setStatus] = useState<CheckStatus | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`${artifactUrl}/status.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body: CheckStatus | null) => {
        if (live && body && typeof body.checked_at === "string") setStatus(body);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  const words = statusWords(status, new Date());
  return (
    <Link className="site-status" href="/freshness" data-overdue={words.overdue || undefined}>
      <span className="site-status-schedule">
        <span className="site-status-kicker">{words.kicker}</span>{" "}{words.word && <><span className="site-status-word">{words.word}</span>{" "}</>}{words.when}
      </span>
      <span className="site-status-arrow" aria-hidden="true">→</span>
    </Link>
  );
}
