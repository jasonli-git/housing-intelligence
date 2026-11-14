import { GuideBriefingRedirect } from "@/components/GuideBriefingRedirect";

/** #498: the briefing mock's address; it leads to `/guide`, then to the town's own address (#520). */
export default function OldBriefingPage() {
  return <main id="main-content" tabIndex={-1} className="shell"><GuideBriefingRedirect /></main>;
}
