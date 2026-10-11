import type { Inquiry } from "@/lib/api";
import { dayLabel } from "@/lib/freshness";
import { monthLabel } from "@/lib/periods";

/**
 * What a publisher told this project directly (ARCHITECTURE #370), set apart from what
 * it published: the office, how and when it answered, and its words. A disclosure, so
 * the note is one line until a reader opens it.
 */
export function InquiryNote({ inquiry, headline }: { inquiry: Inquiry; headline?: string }) {
  const when = inquiry.expected
    ? inquiry.expected.precision === "month" ? monthLabel(inquiry.expected.day) : dayLabel(inquiry.expected.day)
    : null;
  return <details className="inquiry-note">
    <summary>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 6h18v12H3zM3 6l9 7 9-7" /></svg>
      <span className="inquiry-kicker">From our inquiry</span>
      <span className="inquiry-headline">{headline ?? (when ? `Next update expected ${when}${inquiry.expected?.covers ? ` · ${inquiry.expected.covers}` : ""}` : `${inquiry.office} answered`)}</span>
    </summary>
    <div className="inquiry-body">
      {inquiry.said && <blockquote>“{inquiry.said}”</blockquote>}
      {inquiry.received && <p className="inquiry-received">Released to us: {inquiry.received}</p>}
      <p>{inquiry.office}, {inquiry.via === "email" ? "by email" : "in answer to a public-records request"} to Housing Intelligence, {dayLabel(inquiry.answered)}. {inquiry.via === "email" ? "No published page states this; it can change." : "Not otherwise published online."}</p>
    </div>
  </details>;
}
