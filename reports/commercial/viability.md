# Commercial viability study

Milestone 32, 2026-10-01. **Decided by the owner on 2026-10-01: no-go on both uses for
now** (ARCHITECTURE #278). Section 9 lists what would reopen each.

## The question

Could the site earn money, and on what terms? The owner set the scope on 2026-10-01:

- **Two uses, judged separately.** **Ads or sponsorship** on the free site, and a
  **paid tier**: pages, tools or downloads behind a subscription. Data or API sales and
  paid reports are out of scope.
- **Paid data** counts as viable at about **$10 a month**, or more if the use's revenue
  would cover it.

## The answer

| Use | Decision | Why, in one line |
|---|---|---|
| **Ads or sponsorship** | **No-go for now.** | The licence path is close, but nothing measures whether anyone visits, and the advertisers a housing site attracts are the ones FRED's terms exclude. |
| **Paid tier** | **No-go for now.** | Its headline figures can't be sold, a paywall needs a server the static site doesn't have, and nothing shows demand. |

What would change each is at the end.

## 1. What each source allows

Recorded per source in `config/sources.yml` (`commercial`), with the words that decide
it, and checked by `hip check-config`. A calculated figure takes the least permissive
right of its inputs, the way its licence class does (ARCHITECTURE #269, #277).

| Source | Publisher | Licence class | Ads | Paid tier |
|---|---|---|---|---|
| `census_tiger` | U.S. Census Bureau | public domain | Allowed | Allowed |
| `census_acs` | U.S. Census Bureau | public domain | Allowed | Allowed |
| `census_pep` | U.S. Census Bureau | public domain | Allowed | Allowed |
| `census_permits` | U.S. Census Bureau | public domain | Allowed | Allowed |
| `fhfa_hpi` | Federal Housing Finance Agency | public domain | Allowed | Allowed |
| `bls` | U.S. Bureau of Labor Statistics | public domain | Allowed | Allowed |
| `hud` | U.S. Department of Housing and Urban Development | public domain | Allowed | Allowed |
| `hud_fmr` | U.S. Department of Housing and Urban Development | public domain | Allowed | Allowed |
| `hud_chas` | U.S. Department of Housing and Urban Development | public domain | Allowed | Allowed |
| `irs_migration` | Internal Revenue Service | public domain | Allowed | Allowed |
| `nj_modiv` | NJ Office of GIS (NJOGIS) | attribution | Allowed | Allowed |
| `nj_sr1a` | NJ Division of Taxation | public record | Allowed | Allowed |
| `nj_tax_rates` | NJ Division of Taxation | public record | Allowed | Allowed |
| `zillow_zhvi` | Zillow Research | non-commercial | Unclear | **Not allowed** |
| `zillow_zori` | Zillow Research | non-commercial | Unclear | **Not allowed** |
| `fred` (Freddie Mac's mortgage rate) | Federal Reserve Bank of St. Louis | display only | Unclear | Unclear |
| `njgin_parcels` (not loaded) | NJ Office of GIS (NJGIN) | attribution | Unclear | Unclear |

**The federal and New Jersey sources are clear.**
- The federal agencies' works are in the public domain.
- The Census and HUD User API terms ask only for a no-endorsement notice, and their ban
  on implying endorsement of a product "not-for-profit, commercial or otherwise"
  presupposes commercial services.
- New Jersey's legal statement lets anyone "view, copy or distribute" State information.
- NJOGIS asks only to be acknowledged.

**Zillow is not.**
- Its research page makes the data "free for public use by consumers, media, analysts,
  academics and policymakers".
- Its Terms of Use, read by the owner on 2026-09-30, allow non-personal use with
  attribution and say nothing about commercial use.
- **Ads: unclear.** A free site carrying ads looks like the media use the page names,
  but nothing grants it.
- **Paid tier: not allowed.** It would sell access to the figures, and nothing covers
  that.

**Freddie Mac's rate is unclear for both uses.**
- FRED's API terms (read 2026-10-01) allow commercial applications, but leave a third
  party's series to its owner. That owner's permission is needed "for anything other
  than your own personal use".
- Freddie Mac's PMMS page allows its rate to be used "with proper attribution", without
  saying whether commercially.

## 2. What survives

**31 of the 38 metrics are cleared for both uses.** The seven that are not:

| Metric | Ads | Paid tier |
|---|---|---|
| `zhvi_sfr` (Zillow home value) | Unclear | Not allowed |
| `zori_all` (Zillow rent) | Unclear | Not allowed |
| `mortgage_rate_30y`, `mortgage_rate_30y_weekly` (Freddie Mac) | Unclear | Unclear |
| `price_to_income`, `rent_to_income`, `price_to_ami` (built on Zillow) | Unclear | Not allowed |

They are few, but they are the headline. What leans on them:

| Feature | Uses | A cleared substitute |
|---|---|---|
| Cost to own, per month | Zillow home value, Freddie Mac's rate | The NJ sales median already prices the card where Zillow has no figure (#187). For the rate: HMDA's annual average contract rate (public domain, about a year behind, scheduled for Milestone 46), or a rate the visitor enters. |
| Affordability verdict, "Did paychecks keep up?" | Price to income, rent to income | The survey's own home value and rent over the survey's income: same source and years, annual rather than monthly. |
| Landing-page map and rankings | Zillow home value | The survey's typical home value, or the sales median. |
| County explorer, trend charts | Zillow home value and rent | FHFA's index for trend; the survey for level. |
| AI readings | The whole packet, Zillow included | Packets built without the restricted figures. Prose written from Zillow's figures is a derivative of them. |

**A cleared variant is buildable without buying anything.** It would cost freshness:
- The headline figures move from Zillow's monthly series to the Census survey's annual
  five-year estimates and New Jersey's annual sales file.
- The mortgage rate goes about a year stale, or the visitor supplies it.

**FHFA's own mortgage survey is not a way out.** It ended in 2019. Its "MIRS Transition
Index" is "a version of Freddie Mac's 30-year Primary Mortgage Market Survey", so it
carries Freddie Mac's question with it.

## 3. Zillow's commercial route

The roadmap assumed a separate licence for the same figures. Read on 2026-10-01:

- **The developer program's "Real Estate Metrics" page is the free downloads.** It
  points to the same CSVs the site already uses, under the same words: "free for public
  use by consumers, media, analysts, academics and policymakers".
- **The licensed route is the Zillow API Terms of Use on Bridge** (updated November
  2023), reached by an application at `bridgedataoutput.com/zgdata`. Zillow approves or
  denies "in its sole discretion", and the form warns "requests may take 10+ days". Its
  Economic Data API carries the home value and rent indexes.
- **Those terms conflict with how this site works, whatever the price:**

| Clause | Says | Conflicts with |
|---|---|---|
| 5.18, 6 | Prevent end users "caching, downloading, or otherwise retaining copies of the Data" | The CSV downloads and the public JSON the pages are built from |
| 5.17 | No derivative works "except as expressly permitted" | The three ratios, and arguably the AI readings |
| 25 | No "Zillow Materials on servers … outside of the United States" | Cloudflare's worldwide CDN |
| 5.14 | No product that "competes with Zillow" without its written approval | A housing-data site, arguably |
| 27.1 | Zillow's logo beside every figure, "Provided via the Zillow Economic Data API" above it | Every table and card that shows one |
| 8 | A fee at Zillow's "then-current monthly access rate", set by "the total amount of Data you had the ability to access", unpublished | Costing it at all |

**Applying is not recommended**, on a go or not. A licence would put Zillow figures on a
commercial page only by removing the downloads, the ratios and the worldwide hosting.
The cleared variant above gets the same pages from public data.

## 4. Freddie Mac's rate on a commercial page

Not settled, and not cheaply settleable:

- **The rate itself.** Freddie Mac's PMMS page ("may be used with proper attribution")
  doesn't distinguish commercial use. Its Terms and Conditions forbid scripts on its
  websites, so they were not re-read by script; the owner read them on 2026-09-30.
  Asking Freddie Mac is the one outreach this study would justify, and only on a go:
  the public pages don't answer it.
- **The bigger obstacle is FRED, not Freddie Mac.** FRED's API terms forbid using the
  API for any service that "constitutes, promotes or is used in connection with"
  "professional services regulated by state licensing regimes". Mortgage lenders and
  real-estate agents are licensed by the state, and they are the likeliest advertisers
  on a housing site. A site carrying their ads couldn't take any FRED series from the
  API.

**Found in passing, and true today, not only commercially:**
- **FRED's terms ask for a clause the site doesn't have.** An application for other
  users must "explicitly state in your application's terms of use that, by using your
  application, your users are agreeing to be bound by the FRED® API Terms of Use". The
  site has no terms of use. It shows FRED's notice and links FRED's terms in its footer,
  but not that sentence.
- **The site has no privacy policy.** It collects nothing, so no regulation requires
  one today, but any ad network would.

## 5. Paid data, per vendor

Only one vendor was re-read for this study. The September comparison's other four were
not, because none fits the $10 ceiling:
- ATTOM, about $300 a month and up;
- Estated / BatchData, about $99–300;
- CoreLogic, four figures;
- GreatSchools, low hundreds a year and off-topic.

Those prices are September's estimates, unverified.

**RentCast** (read 2026-10-01; the API terms state no date):

- **Terms: the most permissive read so far, and contrary to September's note.**
  - The licence grants use "to sublicense, disclose, display, resell and distribute the
    API Data to third parties" and "to create derivative works".
  - No attribution is required.
  - Data obtained before cancellation may be kept "solely as permitted under Section 1".
  - It is subject to "usage rules or terms of use established by any other third
    parties", which for listing-based figures may matter.
  - September's "nothing derived could be republished" was wrong.
- **Price.**

  | Plan | Monthly | Requests included | Then |
  |---|---|---|---|
  | Developer | $0, no card | 50 | $0.20 each |
  | Foundation | $74 | 1,000 | $0.06 each |
  | Growth | $199 | 5,000 | $0.03 each |

- **Fit.** Its market statistics are by ZIP code (38,000+), not county. New Jersey has
  roughly 600 ZIP codes, so a monthly refresh of every one is Foundation's 1,000
  requests: $74 a month, past the $10 ceiling. A cleared rent and sale-price figure by
  ZIP is what it would buy, in place of Zillow's.
- **Not tested.** Only the over-ceiling exception could make it viable, and that needs
  revenue of about $75 a month, which needs traffic or a sponsor the site doesn't have.
  So the owner dropped the test on 2026-10-01. `scripts/rentcast_probe.py` is ready for
  the day that changes: 10 ZIP codes against Zillow's, capped at 20 of the 50 free
  requests.

## 6. What it costs to run, and what each use would have to earn

| Cost | Per year |
|---|---|
| Hosting: Cloudflare Pages and R2, inside their free tiers (159 MB of artifacts, 1 GB of site) | $0 |
| AI readings, 21 counties (#276, measured) | about $3.50–4 now; $7–8.50 from 2027 |
| Domain | the owner's existing cost |
| Paid data | $0 today; RentCast Foundation would be about $890 |

**Without paid data, the site costs a few dollars a year.** So break-even is not the
question: almost any revenue covers it. The questions are whether the work each use
needs is worth what it would earn, and whether the licences hold. With RentCast, revenue
would need to clear about $75 a month.

For ads, revenue scales with pageviews. As an unverified rough range, display ads earn
$5–15 per thousand pageviews on finance and real-estate content. $75 a month would then
need roughly 5,000–15,000 pageviews a month. The site has no analytics, so its traffic
is unknown.

## 7. What each use needs beyond the data

**Ads or sponsorship:**
- A privacy policy and site terms of use. The terms of use are owed to FRED already.
- An ad network's approval, or a sponsor.
- Advertisers kept clear of state-licensed professional services while any FRED series
  is on the page, or the rate taken from elsewhere.
- Zillow's figures either taken out or kept on the media reading of its page, which is
  the owner's risk to judge.

**Paid tier:**
- Everything above, plus a way to stop non-subscribers reading paid content. Today the
  pages are static files and the JSON they are built from is public (#94), so anything
  behind a paywall would also sit, unprotected, in that tree.
- So: an authentication layer (Cloudflare Access, or Workers in front of R2), payments,
  account support and refunds. That is a change to the architecture Milestone 11 built
  on, and a server to operate.
- The cleared variant, since Zillow's figures cannot be sold.

## 8. The analyst reading

Retired 2026-10-01 (#275); reconsidered here for a professional or paying audience.

**Recommendation: leave it retired.**
- A paid tier is a no-go, so there is no paying audience to write it for.
- An ad-supported site earns from pages viewed, not from paragraphs read.
- If a professional audience ever appears, it would want what the analyst reading
  could not give: the figures across many places at once, which the tables and
  downloads already do. Reviving it is a one-line config change (#275) whenever that
  changes.

## 9. Decision, and what would change it

**Ads or sponsorship: no-go for now.** Reconsider when any two of these hold:
1. **Traffic is known and material.** Measured by a privacy-respecting counter; on the
   rough range above, several thousand pageviews a month before display ads are worth
   their policies.
2. **The headline figures are cleared:** the cleared variant built (section 2), or
   Zillow's media reading accepted by the owner and Freddie Mac's rate replaced or
   confirmed.
3. **A sponsor rather than an ad network.** For example a housing nonprofit, a
   university or a public agency, which avoids FRED's licensed-professional clause and
   needs far less traffic.

**Paid tier: no-go for now.** It would need all three of these, and none is in reach:
- demand shown before building (for example a waitlist);
- the cleared variant;
- an authentication layer and a server to run.

Everything it could sell is public data the visitor can get free, so its value would be
the presentation alone.

**Whichever is decided:**
- **The FRED terms-of-use sentence is owed today.** A small site terms page fixes it.
- **No Zillow application, and no subscription.**

## Not done, and why

- **The RentCast test** (section 5), because no figure it returned could change a
  decision bound by the price.
- **Traffic.** The site has no analytics, and traffic would only have mattered to a
  yes on ads that the licence questions already rule out. It stays a reopening
  trigger (section 9), not an input.
