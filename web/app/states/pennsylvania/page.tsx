import { StatePoster, stateMetadata } from "../../_poster/StatePoster";
import { coveredState } from "@/lib/states";

const covered = coveredState("PA")!;
export const metadata = stateMetadata(covered);

/** Pennsylvania's page (Milestone 63), the same `StatePoster` New Jersey's uses. */
export default function PennsylvaniaPage() {
  return <StatePoster covered={covered} />;
}
