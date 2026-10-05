# M42 source follow-ups — investigated October 4, 2026

## What changed

The follow-up closes part of the BPU import gap and adds two manually verified annual water-quality report links. It does not claim the remaining publisher/access/privacy gates are resolved. The October 4 drafts below are historical; the October 5 outreach register supersedes their unsent status. No email was sent by Codex.

### Owner outreach — October 5, 2026

Sending is confirmed by the owner in chat, not by access to their mailbox. Exact sent
copies are not archived in the repository; descriptions below reflect the drafts and
confirmations in chat. Do not assume later replies or attachments exist.

| Institution / recipient | Confirmed action | Status / next step |
|---|---|---|
| NJDEP, `LeadInDW@dep.nj.gov` | Owner sent the newer per-system service-line inventory inquiry, linking layer 37. Asked for an aggregate export with system IDs/material counts and, if unavailable, an expected publication date. No residential addresses requested. | Awaiting reply. The sent draft did **not** include the separate CCR catalogue request in the older draft below; that avenue remains unasked. |
| DOE LEAD team, `LEAD.Tool@hq.doe.gov` | Owner sent the question about negative reporting weights or energy-cost values in Essex, Hudson, Middlesex, Monmouth and Somerset. Asked whether intentional and for an aggregation method or corrected dataset; offered affected rows. | Awaiting reply. No affected-row attachment was confirmed. Preserve originals and continue withholding unsupported derived estimates. The sent draft did not ask about successor releases. |
| BPU, `Lauren.Mattox@bpu.nj.gov` | Owner sent a request to locate public 2024/2025 Annual System Performance Reports for ACE, JCP&L, PSE&G and Rockland Electric, referencing ACE 2023 dockets EM14060581 and ER09080664. | Lauren replied October 5 at 3:24 PM: search the BPU website; if not found, contact the Board Secretary's Office or file an OPRA request for routing. This is a referral, not rejection, a supplied report or confirmation of report availability. |
| BPU records custodian, `Records.custodian@bpu.nj.gov` | Owner confirmed sending a **document-location inquiry** after Lauren's referral: requested IDs/public links for those reports and asked to be told if a formal OPRA request is needed. | Awaiting reply. **No formal OPRA request or completed form submission is confirmed.** No records, reuse permission or import clearance received. |

BPU's [records-access instructions](https://www.nj.gov/bpu/bpu/agenda/opra/), checked
October 5, identify the custodian email for assistance locating documents. They list
physical mail and an electronic route pointing to `www.nj.gov/grc` for completed forms;
a working BPU electronic submission endpoint was **not verified**. Earlier chat wording
suggesting that an emailed attachment necessarily constitutes a formal OPRA filing was
corrected. If a formal request is required, confirm the accepted submission method or
use the stated physical-mail process. Do not claim a statutory request clock has begun
from this informal inquiry. Request existing public records, not a newly created analysis;
ask for advance notice of fees. Access to records is not blanket third-party reuse clearance.

**Further outreach is paused by the owner.** Do not send additional inquiries, submit
forms or create follow-up automations. DCA status and the conditional October 13 routing
plan are recorded in `m44-evictions.md`. NG911/privacy guidance and broad CCR metadata
requests remain future avenues, not sent requests. None of the technical gates above
is resolved merely because an email was sent.

## Files/modules affected

`nj_bpu.py`, source registry/configuration, BPU staging model, infrastructure loader/API, utilities and water components, `waterReports.ts` and their tests. See the main M42 handoff for the original five inventories.

## Architectural or implementation decisions

### BPU: actual figures, partial coverage

- Imported JCP&L company-wide actual CAIDI/SAIFI for 2022, 2023 and 2024 from [BPU's August 13, 2025 order, Docket EO25070453, Tables 1–3](https://nj.gov/bpu/pdf/boardorders/2025/20250813/2B%20ORDER%20JCP%26L%20Reliability%20Levels.pdf). Respectively: 118.81/1.46, 147.3/1.48, 160.30/1.95. Printed pages 3–4. Measurement year and document publication vintage are distinct.
- CAIDI is minutes per customer interruption, not annual minutes per customer (SAIDI). Event exclusions are not specified in these tables. No conversion to SAIDI, town-level allocation, EIA equivalence or current outage prediction.
- The real document has two annual tables on one page. The reader stops at the next table heading as well as a page boundary; tests cover same-page tables, wrong identity, reordered measures, missing tables and duplicate overall rows.
- Located [Atlantic City Electric's 2024 Annual System Performance Report](https://www.atlanticcityelectric.com/cdn/assets/v3/assets/blt407b5f1850a51a1b/blte2a508f06ea1cfda/684320fc2fda0e95b4471da7/ACE_-_2024_Annual_System_Performance_Report.pdf?branch=prod_alias), prepared May 30, 2025. The initial reader-facing link was removed after terms review; this URL is investigative evidence only. Its printed page 4 has company-wide and division CAIDI/SAIFI actuals and minimum levels. This is a verified filing, not yet a supported import. Some other tables are image-based; a complete review must preserve exclusion basis and units.
- Searched BPU reliability, reports/studies and audit indexes plus official supplier filings. No complete current four-provider catalogue was verified. The [BPU public-access portal](https://publicaccess.bpu.state.nj.us/) returned an access challenge/403. No bypass, opaque-ID guessing or confidential report access attempted.
- [NJ Conditions of Use, section F](https://www.nj.gov/nj/legal.shtml) permits reuse of State information subject to specific restrictions and third-party rights. The configuration records public-record factual reuse conservatively, not a blanket licence for third-party PDFs, seals or signatures.

### Lead: a verified public-feed lag

[NJDEP's lead map](https://dep.nj.gov/lead/map/) describes December 2025 statewide totals. Its official ArcGIS experience (`bc82aa1d39d54e5d944d701cf7e8450d`) and web map (`94f31eba7b554d28a4df81a3f415c3ab`) still point to the [public service-line inventory table, layer 37](https://services1.arcgis.com/QWdNfRs7lkPq4g4Q/arcgis/rest/services/Public_Community_Water_Purveyor_Service_Line_Inventory_for_New_Jersey/FeatureServer/37). A live MAX(SUBMISSION_YEAR) query returned **2024**. The official owner's catalogue did not reveal a verified replacement 2025 bulk table.

This establishes a lag in the checked public feed, not that NJDEP has no newer individual-system data. The statewide totals cannot be used to update particular systems. Reader copy now explains that distinction. No residential service-line addresses were acquired.

### CCRs: identity matched, not a scraper

Two outbound supplier-report links are matched to their printed public-water-system IDs:

- `NJ2004002`: [Raritan report](https://amwater.com/ccr/raritan.pdf).
- `NJ0408001`: [Camden report](https://www.amwater.com/ccr/camden.pdf).

The October 4 date records the identity check, not a perpetual assurance that the mutable URL contains the newest year's report. Other systems link to [EPA's NJ CCR directory](https://ordspub.epa.gov/ords/safewater/f?p=136:103::::103:P103_STATE:NJ) with their ID and name; no match is inferred from similar town names.

[American Water's terms](https://www.amwater.com/corp/terms-of-use) prohibit automated copying/crawling. No supplier scraper, report ingestion or republication was built. Agency-provided report metadata or explicit permission is the appropriate next avenue for broader automated coverage. EPA's directory supplies public links, but its rendered listing does not provide a reliable ID mapping for this implementation; direct retrieval also encountered timeout/disconnect responses. That is unfinished catalogue work, not proof no usable agency export exists.

### Addresses: three separate gates

1. **Reuse:** [NJGIN's address data page](https://www.nj.gov/njgin/edata/addresses/) describes monthly NG911 updates and location-quality limitations. Dataset-specific reuse terms still need to be retained and reviewed before public address functionality.
2. **Privacy:** [NJ DCA Office of Information Privacy](https://www.nj.gov/dca/oip/) explains protected-address removal obligations for nongovernmental internet publishers receiving an authorized person's written notice. Daniel's Law is not a blanket statement that every address point is forbidden, nor does removing names automatically resolve the issue. Obtain legal/publisher guidance and a suppression/removal design before publishing searchable address results.
3. **Accuracy:** clearing the first two gates would not make coarse utility polygons reliable property-level service guarantees. Water-system boundaries likewise do not prove a connection or exclude private wells. A later flood-location prototype could be assessed separately against geocoding quality and NFHL coverage; it is not automatically blocked forever by a utility-map limitation.

No address ingestion or public point-level feature was implemented.

## Assumptions

The checked BPU order and manually curated CCR IDs are bounded, reviewed sources, not automatic successor discovery. Publicly accessible supplier documents do not by themselves establish unrestricted automated reuse rights.

## New TODOs / limitations

### Consolidated gap register — status as of October 4, 2026

This register covers known M42 source, integration, interpretation and release limitations, including related existing TODOs. It is a handoff, not approval to implement or a substitute for Claude's roadmap reconciliation. **"Actionable" means a concrete next step exists, not that the user has authorized more work.** The technical evidence is dated October 4; consult the October 5 outreach register above for current correspondence status. Do not label every gap "institutional," "impossible" or "complete."

#### A. Actionable without an agency response (future bounded work)

| Gap | Current evidence / what is missing | Concrete next step and boundary |
|---|---|---|
| Complete BPU filing discovery | JCP&L actuals for 2022–2024 are imported from an order, not a complete annual catalogue. ACE 2023 public filing was downloaded by the user from BPU; ACE 2024 exists on the supplier site. PSE&G/RECO annual filing coverage and newer JCP&L/ACE releases are unverified. Automated portal access was challenged; the user's browser works. | Inspect permitted agency catalogue/download routes and public filings supplied by the user. Preserve docket, measurement year, publication date, units and event basis. Failure to find a filing is not proof it does not exist. Never bypass access controls or guess confidential document IDs. |
| ACE parser and basis review | 2024 company-wide figures exist; no ACE importer has been built. Printed page 5 separates all-event from major-event-excluded series, with image-based chart tables. | Review/validate extraction and regression fixtures using already obtained public files. This technical work is feasible; production acquisition/publication still requires the separate permission/reuse gate in B. Do not describe ACE as missing data or silently treat 84-minute CAIDI as all-event SAIDI. |
| CCR catalogue discovery and link maintenance | Only two exact-ID report links are curated; other systems use EPA's directory. No reliable full PWSID-to-report/year export or successor check is implemented. | Investigate permitted agency metadata/export routes and review user-supplied reports. Track report identity, publication/coverage year and per-result sampling year separately. No prohibited supplier scraper or name-only matching. Existing links do not prove the whole catalogue is current. |
| NJ-specific PFAS violation source | UCMR measurements are imported, but the separate NJDEP PFAS regulatory-violation series remains absent from the project's SDWIS-based presentation. | Investigate an official permitted NJDEP regulatory export and its identifiers, dates and violation definitions. A concrete source has not been verified; neither fabricate violations from UCMR maxima nor claim an agency response is the only possible route. |
| Successor releases and notices | EIA final-year discovery exists, but its dated acknowledgement requires review for a successor. DOE remains pinned to the verified 2022 dataset/2024 release; BPU reader is pinned to the reviewed 2025 order; CCR links are mutable/manual. | Review successor discovery on official permitted catalogues and add bounded notice/year checks. Preserve exact-release provenance. Newer candidates still require validation; download date must not substitute for measurement date. |
| Unmatched electric suppliers | Four major territory providers are explicitly matched to EIA. Other municipal/cooperative names receive no invented price or outage statistics. | Investigate additional explicit ID matches with evidence; leave genuinely unmatched or unreported values missing. More matching cannot create statistics absent from the publisher. |
| Existing ZIP household-bill/insurance TODO | Territory/provider context does not populate the missing ACS household utility-bill/insurance fields. | Trace source availability and existing ACS staging/coverage in a separately scoped task. Determine whether omissions are ingestion bugs, publisher suppression or unavailable estimates before promising a fix. Do not mark this older TODO resolved by M42. |
| Production build configuration and verification | Local static builds warn that NEXT_PUBLIC_ARTIFACT_URL is unset. M42 is not deployed and make check-live has not been exercised on this release. | At an explicitly approved deployment, migrate/acquire/stage/load all six inventories, set the production artifact origin, publish/rebuild, then run live checks. Do not deploy or merge merely because this action is technically available. |

#### B. Gated — not safely implementable now without a missing prerequisite

| Gap | Prerequisite / current decision | Allowed next step; what not to do |
|---|---|---|
| Automated ACE supplier-site acquisition and public reuse | Exelon terms include ACE and restrict automated access, public reuse and deep links without permission. Direct ACE PDF reader link has already been replaced by BPU search. | Obtain permission or assess an agency-provided public-data route and its applicable rights. An agency copy does not automatically clear third-party rights. Until then, no supplier scraper/production importer from that site. |
| Newer per-system lead inventory | Checked public map feed reaches submission 2024; user independently received only 2022–2024. Newer statewide totals do not provide newer system-level records. | Owner sent NJDEP inquiry October 5; awaiting reply. Permitted replacement-export discovery remains possible. Keep dated records and disclosures; do not allocate statewide totals across systems. This is a verified checked-feed lag, not proof no newer records exist anywhere. |
| Repair of five DOE county energy estimates | Essex, Hudson, Middlesex, Monmouth and Somerset contain signed reporting weights/costs; no justified repair method has been established. | Owner sent DOE inquiry October 5; awaiting reply. Obtain documented publisher methodology, a corrected release or a defensible reviewed treatment. Preserve raw values and withhold derived estimates; no zero-fill, absolute-value conversion or guessed household cost. |
| Public address-level functionality | Dataset reuse review, Daniel's Law/privacy handling and a suppression/removal design remain unresolved. Address points were not acquired or published. | Obtain appropriate guidance and approve a scoped design before implementation. This is not a blanket legal conclusion that all address points are forbidden. Removing names alone does not clear the gate. |
| Broad automated CCR ingestion from restricted supplier websites | American Water terms prohibit automated copying/crawling; agency export/permission for a full catalogue is not established. | Seek permitted agency metadata or supplier permission; outreach is deferred. Manual report review does not authorize a scraper or republication of report content. |

#### C. Not recoverable from current data, or outside M42 — preserve the limit

| Limit / unbuilt feature | Why this is not a simple implementation fix | What would be needed to go further |
|---|---|---|
| Exact property utility/water connection | Coarse utility territories and public-water boundaries indicate area coverage, not a confirmed property connection, supplier guarantee or absence of a private well. | More precise authorized service data or supplier confirmation. Privacy clearance alone does not improve map precision. A separately gated flood-point prototype could be assessed independently. |
| Town-specific outage predictions or comparable BPU/EIA rankings | Imported outage measures are utility-wide historical records; JCP&L order does not specify event exclusions. CAIDI and SAIDI are different measures. | Appropriate geography and harmonized methods/event basis. Do not manufacture local allocations, current predictions or SAIDI by multiplying rounded reported values. |
| Current tap-water safety / lead-free claims | UCMR covers sampled systems/points/dates, not every tap, private well or small system. Lead-line inventory is pipe-material counts, not concentration. CCR tap samples are a limited monitored set. Returns to compliance lack some dates and are not a blanket safety guarantee; a missing return date does not prove ongoing unsafe water. | Appropriate current, location-specific testing/authoritative advice. Nondetects are not zero; single PFAS maxima are not running-annual compliance averages or regulatory violations. |
| Gas prices and automatic household-bill inputs | Gas territories identify providers; electricity sales do not price gas. Historical utility revenue averages and DOE county context are not current household bills. No gas estimator/cost-card autofill was implemented. | Separately scoped gas tariff/usage or suitable bill data and methodology. This is an unbuilt extension, not automatically an unmet M42 requirement or an institutional blocker. |
| Surface-water assessment as a drinking-water report | User located the 2022 Integrated Water Quality Assessment Report. It concerns surface-water/watershed conditions, not a supplier CCR or proof about treated household water. | A separate environmental-context scope and careful spatial/use definitions. Do not substitute it for drinking-water measurements. |
| Existing fact-geography errors and excluded tests | The earlier fact load retains 144 unresolved geographies. Final ordinary Python suite had 1 skipped and 9 slow tests excluded. These are recorded, not repaired or tested away by M42. | Inspect existing geography issues and run the excluded coverage in a separately appropriate environment/scope. They are pre-existing/verification limitations, not evidence of new M42 inventory failure. |

#### Resolved or clarified — not remaining blockers

- JCP&L BPU actual-performance import, exact-file provenance and same-page PDF table parsing are implemented and verified.
- ACE's reader-facing supplier-PDF deep link was removed; BPU search and explicit non-import disclosure are in place. The underlying ACE import/permission gap remains, separately classified above.
- The user's Princeton walkthrough matched Raritan PWSID `NJ2004002`. Their report screenshot shows lead/copper rows sampled in 2025, including 54 tap-sampled homes. This is user-supplied identity/year evidence, not a new imported dataset or a guarantee for all Princeton homes. Cover year must not override individual sampling years (other rows may be older).
- October 4's outreach deferral was superseded by the owner-sent October 5 inquiries above. Further outreach is now paused again. BPU supplied a routing reply only; no technical gate is cleared and no new outreach is authorized.
- No new AI generation, raw prune --apply, canonical reconciliation, version bump, merge or deployment is part of this follow-up. These are scope boundaries, not automatically missing features.

### Historical October 4 request drafts — not the exact sent emails

#### User decision — October 4, 2026: defer outreach

The user initially deferred inquiries October 4. They later sent the narrower October 5 emails recorded above and paused further outreach. Retain the older drafts for context, not as evidence that every question below was sent. No reason beyond the user's choice to defer was stated.

- **BPU:** the user's normal browser accessed the portal and found ACE's public 2023 Annual System Performance Report, submitted May 30, 2024, under ER09080664 and EM14060581. The downloaded PDF's cover confirms that identity. It is not the 2024 report previously reviewed on ACE's website. The user did not locate a newer filing through the suggested searches; that is a search/access gap, not evidence that BPU lacks the filings. A later inquiry should identify this known filing and request newer public document IDs/links and the four-utility catalogue.
- **Lead:** the user independently queried distinct SUBMISSION_YEAR values in the public layer and received 2022, 2023 and 2024 only. This supports requesting a newer per-system aggregate export. A November 2025 schema edit does not establish 2025 submissions. Do not substitute newer statewide totals for system-level records.
- **ACE terms follow-up:** Exelon's terms, updated August 10, 2026, explicitly include ACE and restrict automated access, public reuse and deep links without permission. With user approval, the direct supplier PDF link in PR #93 was replaced by the BPU public-document search portal. The copy still states that ACE annual figures are not imported and does not promise newer filings appear in search. The supplier PDF URL above remains investigative evidence, not a reader-facing link. Obtaining an agency-hosted public filing is an alternative acquisition route to assess, not automatic legal clearance or a blanket third-party reuse licence. No ACE scraper/import has been added.
- **Drinking-water walkthrough:** the user initially found NJDEP's Integrated Water Quality Assessment Report (2022 cycle), a surface-water/watershed assessment rather than a supplier CCR. They subsequently opened the Raritan report for Princeton, confirmed `NJ2004002` and a 2025 cover, and supplied a screenshot of 2025 tap-sampling rows. We explained sampling years, percentile versus maximum and compliance versus lead-free. No additional water source or CCR table was integrated.

**To BPU reliability staff:**

> We are building a free housing-information site for New Jersey. Could you provide the public, non-confidential annual system performance reports for ACE, JCP&L, PSE&G and RECO for 2024 and 2025, or stable public links/a machine-readable summary? We need company-wide actual CAIDI, SAIFI and SAIDI where reported, units, event-exclusion basis, reporting geography and filing/publication dates. Please identify an ongoing public catalogue or notification mechanism and any attribution/reuse restrictions. We do not seek confidential infrastructure details.

**To NJDEP drinking-water/lead staff:**

> Your public lead-inventory map has 2025 statewide totals, while its linked layer 37 currently reaches submission 2024. Is a public 2025 per-system aggregate export available, keyed by PWSID with category definitions, update dates and inventory links? We seek aggregate counts only, not residential service-line addresses. Is there also an agency-maintained PWSID-to-Consumer-Confidence-Report URL/year export, and an update schedule and reuse notice for both datasets?

**To DOE/NREL LEAD maintainers:**

> The 2022 county bulk data contain signed reporting weights or energy costs in Essex, Hudson, Middlesex, Monmouth and Somerset, NJ. We preserve the original rows and withhold derived county estimates. Are those values intentional, and is there an approved aggregation/filtering method or corrected export? Is a successor bulk release planned, and how should consumers discover and cite it?

**For counsel/NJOGIS/OIP clarification before address work:**

> We are considering address lookup on a free public housing site using NJGIN NG911 points. Please clarify dataset reuse requirements, protected-address handling, notice/removal obligations, whether coordinate-derived results require suppression, and how a publisher can maintain compliant updates. The proposed interface would not expose owner names, but we do not assume that alone clears the privacy requirements.

Sending these requires separate user authorization. Responses could resolve specific gates, but are not the only possible avenue for every unfinished integration: permitted catalogue discovery and user-supplied public filings remain actionable. Use the register above rather than treating all omissions as institutional blockers. Gas price estimation was not added and is separate from identifying gas suppliers.

## Verification

Actual BPU acquisition, PDF landing and staging succeeded with three rows; staged inventory guard passed. Detailed final suite/load/build results are recorded in `m42-utilities-water.md`.

Gap-register reconciliation: reviewed both M42 handoffs and subsequent user-supplied portal/query/report evidence; documentation only, no new acquisition, legal clearance or implementation claimed. `git diff --check` run for this edit. No code tests rerun for the documentation-only update.

October 5 outreach reconciliation: reviewed owner sending confirmations and Lauren's
reply screenshot; verified official DOE contact and BPU directory/OPRA instructions.
Documentation only; no mailbox access, sending, formal records filing, source acquisition,
test-suite rerun, merge or deployment. `git diff --check` run before commit.
