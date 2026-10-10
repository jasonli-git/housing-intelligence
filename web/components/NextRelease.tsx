"use client";

import { useEffect, useState } from "react";

import type { SourceFreshness } from "@/lib/api";
import { nextRelease } from "@/lib/freshness";
import { InquiryNote } from "@/components/InquiryNote";

/**
 * A source's next release, from the publisher's own calendar (#298). Drawn first from the
 * day the page was built, then again from the reader's clock, so a page read weeks after
 * a quiet build never offers a date already past; `data-volatile` keeps the second
 * reading out of `check-live`'s comparison, like `BuiltAgo`.
 */
export function NextRelease({ source, builtAt }: { source: SourceFreshness; builtAt: string }) {
  const [today, setToday] = useState(builtAt.slice(0, 10));

  useEffect(() => {
    // UTC, as every date on the page is.
    setToday(new Date().toISOString().slice(0, 10));
  }, []);

  const next = nextRelease(source, today);
  return (
    <span data-volatile>
      {next.label}
      {next.detail && <span className="fresh-sub">{next.detail}</span>}
      {source.expected_by === "inquiry" && source.inquiries?.at(-1) && (
        <span className="fresh-sub"><InquiryNote inquiry={source.inquiries.at(-1)!} headline={`${source.inquiries.at(-1)!.office} told us`} /></span>
      )}
      {source.calendar_url && (
        <span className="fresh-sub">
          <a href={source.calendar_url} target="_blank" rel="noreferrer">
            Publisher’s calendar
          </a>
        </span>
      )}
    </span>
  );
}
