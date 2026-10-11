import type { Inquiry } from "@/lib/api";

/**
 * Publisher answers that belong to no loaded source (ARCHITECTURE #370). An answer about
 * a source the site loads lives in that source's `inquiries` in `config/sources.yml`,
 * where it can also set the source's expected release; one about something the site
 * does not load yet, like NJDEP's radon tiers, lives here. Exact words, the office and
 * never the person.
 */
export const RADON_MAP_INQUIRY: Inquiry = {
  answered: "2026-10-08",
  office: "NJDEP's radon program",
  via: "email",
  said: "We are in the process of creating an updated tier map. The one on the website is the most recent version, 2015, and that is why we are creating a new one. It has taken a lot of time to ensure correct information is being used. The new map on the website will be interactive, with valuable information about that area down to the municipality level. I’m not sure if the data table will be available for downloading, but I will find out and let you know.",
};
