import { GuideBriefingRedirect } from "@/components/GuideBriefingRedirect";

/** #498: the briefing mock's address; the briefing is the Buyer's guide now. */
export default function OldBriefingPage() {
  return <main id="main-content" tabIndex={-1} className="shell"><GuideBriefingRedirect /></main>;
}
