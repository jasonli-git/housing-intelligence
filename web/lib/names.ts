/**
 * How a region is named to a reader, and how its peers are counted.
 *
 * The warehouse stores a county as "Mercer" and a ZIP as its five digits, which is right
 * for identifiers and wrong for a heading: "Mercer" alone could be anything, and
 * "08540" reads as a number rather than a place.
 */

export function displayName(region: { name: string; level: string }): string {
  if (region.level === "county") return `${region.name} County`;
  if (region.level === "zip" && /^\d{5}$/.test(region.name)) return `ZIP ${region.name}`;
  return region.name;
}

/**
 * A municipality's legal type from TIGER's `name_lsad` — "township" in "Montgomery
 * township" — or null where the name carries none. It is what tells Boonton town from
 * Boonton township: four New Jersey pairs share a name and a county.
 */
export function legalType(region: { name: string; name_lsad?: string }): string | null {
  const lsad = region.name_lsad;
  return lsad?.startsWith(`${region.name} `) ? lsad.slice(region.name.length + 1) : null;
}

const PLURALS: Record<string, string> = {
  state: "states",
  county: "counties",
  municipality: "municipalities",
  zip: "ZIP codes",
  tract: "tracts",
};

/** "counties", "municipalities", "ZIP codes" — the peers a rank is taken among. */
export function peerNoun(level: string): string {
  return PLURALS[level] ?? `${level} regions`;
}

// Postal-code vocabulary, not a list of supported states. Coverage remains separate.
const STATE_NAMES: Record<string,string> = {
  AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",
  CT:"Connecticut",DE:"Delaware",DC:"District of Columbia",FL:"Florida",GA:"Georgia",
  HI:"Hawaii",ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",
  LA:"Louisiana",ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",
  MS:"Mississippi",MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",
  NJ:"New Jersey",NM:"New Mexico",NY:"New York",NC:"North Carolina",ND:"North Dakota",
  OH:"Ohio",OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",
  SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",VA:"Virginia",
  WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming",PR:"Puerto Rico",
  AS:"American Samoa",GU:"Guam",MP:"Northern Mariana Islands",VI:"U.S. Virgin Islands",
};

/** The place a peer group spans, e.g. "New Jersey" for `NJ`. */
export function scopeName(code: string): string {
  return STATE_NAMES[code] ?? code;
}
