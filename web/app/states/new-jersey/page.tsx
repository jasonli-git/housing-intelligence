import { StatePoster, stateMetadata } from "../../_poster/StatePoster";
import { coveredState } from "@/lib/states";

const covered = coveredState("NJ")!;
export const metadata = stateMetadata(covered);

/** New Jersey's page (`StatePoster`, one template for every covered state since Milestone 63). */
export default function NewJerseyPage() {
  return <StatePoster covered={covered} />;
}
