import Link from "next/link";

import type { PacketLevel, WorkDestinations } from "@/lib/api";
import { ReaderDetails } from "@/components/ReaderDetails";
import { formatValue } from "@/lib/format";
import { commutePicture, ofHomes, sentence, transitPicture, workPicture } from "@/lib/gettingAround";
import { shareText } from "@/lib/hazards";

/** The Census Bureau's own map of where a place's workers live and work. */
const ON_THE_MAP = "https://onthemap.ces.census.gov/";

/**
 * How do people here get around (Milestone 45, ARCHITECTURE #313-#314)? Where
 * residents' jobs are, how they get to work and how long it takes, and how many homes
 * are within a walk of a stop. What the page owes a reader: a share of jobs, not of
 * people; nearness to a stop is not service; and the commute is a survey estimate.
 */
export function GettingAround({
  name,
  level,
  levels,
  destinations,
}: {
  name: string;
  level: string;
  levels: PacketLevel[];
  destinations: WorkDestinations | null;
}) {
  const work = workPicture(levels, level, name);
  const transit = transitPicture(levels);
  const commute = commutePicture(levels);
  if (!work && !transit && !commute) return null;
  const count = (n: number) => formatValue(n, "count");
  const modes = commute
    ? ([
        [commute.droveAlone, "drive alone"],
        [commute.transit, "take transit"],
        [commute.walked, "walk"],
        [commute.fromHome, "work from home"],
      ] as const).filter(([share]) => share !== null)
    : [];

  return (
    <section className="section sales getting-around" aria-labelledby="getting-around-heading">
      <div className="section-head">
        <h2 id="getting-around-heading">How do people here get around?</h2>
      </div>

      {work && (
        <p className="sales-lead">
          Residents of {name} held <b>{count(work.jobs)}</b> jobs in {work.year}:{" "}
          {work.shares.map((s, i) => (
            <span key={s.key}>
              {i > 0 ? (i === work.shares.length - 1 ? " and " : ", ") : ""}
              {shareText(s.share)} {s.label}
            </span>
          ))}
          .
        </p>
      )}

      {commute && (commute.minutes !== null || modes.length > 0) && (
        <p className="sales-note">
          {commute.minutes !== null && (
            <>
              Workers living here take about {Math.round(commute.minutes)} minutes to get to work
              {commute.hourPlus !== null ? `, and ${shareText(commute.hourPlus)} take an hour or more` : ""}.{" "}
            </>
          )}
          {modes.length > 0 && (
            <>
              {sentence(
                modes
                  .map(([share, label], i) =>
                    `${i > 0 ? (i === modes.length - 1 ? " and " : ", ") : ""}${shareText(share!)} ${label}`,
                  )
                  .join(""),
              )}
              .
            </>
          )}{" "}
          A survey estimate, from the Census Bureau’s five-year American Community Survey.
        </p>
      )}

      {transit && (
        <p className="sales-note">
          {sentence(
            [
              transit.rail !== null
                ? `${ofHomes(transit.rail)} here are within half a mile of a train, PATH, subway or light rail stop`
                : null,
              transit.bus !== null
                ? `${transit.rail !== null ? shareText(transit.bus) : `${ofHomes(transit.bus)} here are`} within a quarter mile of a bus stop`
                : null,
            ]
              .filter(Boolean)
              .join(", and "),
          )}
          . Measured
          in a straight line to where a stop is, not how often anything calls there: a stop with
          one bus a day counts like one with a bus every ten minutes.
        </p>
      )}

      {destinations && destinations.destinations.length > 0 && (
        <div className="scroll-x" tabIndex={0} role="region" aria-label="Data table, scroll horizontally">
          <table className="change-places work-destinations">
            <caption className="visually-hidden">
              Where residents of {name} work, {destinations.year}: the ten places with the most of their jobs
            </caption>
            <thead>
              <tr>
                <th scope="col">Where residents work</th>
                <th scope="col" className="num">Share of jobs</th>
                <th scope="col" className="num">Jobs</th>
              </tr>
            </thead>
            <tbody>
              {destinations.destinations.map((d) => (
                <tr key={d.rank}>
                  <th scope="row">
                    {d.region_id !== null ? <Link href={`/regions/${d.region_id}`}>{d.name}</Link> : d.name}
                  </th>
                  <td className="num">{shareText(d.share)}</td>
                  <td className="num">{count(d.jobs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(work || destinations) && (
        <ReaderDetails title="About these figures">
          <p className="sales-note">
            Jobs come from the Census Bureau’s LEHD Origin-Destination Employment Statistics (LODES):
            jobs covered by unemployment insurance and federal civilian jobs. Self-employment and
            military jobs are not counted, and a person with two jobs counts twice. A job is placed
            where its employer reports it, which for a firm with many sites can be an office.
            Counts carry deliberate noise to protect privacy, so small figures are approximate.
            LODES 2023 has no records for jobs in Alaska or Michigan.
          </p>
          <p className="sales-note">
            Stops are the Bureau of Transportation Statistics’ National Transit Map, compiled from
            each agency’s published schedule. Homes are 2020’s, by census block; a block’s homes
            are placed at one point inside it. Explore the commute flows on the Census Bureau’s{" "}
            <a href={ON_THE_MAP} target="_blank" rel="noreferrer">
              OnTheMap
            </a>
            .
          </p>
        </ReaderDetails>
      )}
    </section>
  );
}
