# M42 source follow-ups — investigated October 4, 2026

## What changed

The follow-up closes part of the BPU import gap and adds two manually verified annual water-quality report links. It does not claim the remaining publisher/access/privacy gates are resolved. No requests below have been sent.

## Files/modules affected

`nj_bpu.py`, source registry/configuration, BPU staging model, infrastructure loader/API, utilities and water components, `waterReports.ts` and their tests. See the main M42 handoff for the original five inventories.

## Architectural or implementation decisions

### BPU: actual figures, partial coverage

- Imported JCP&L company-wide actual CAIDI/SAIFI for 2022, 2023 and 2024 from [BPU's August 13, 2025 order, Docket EO25070453, Tables 1–3](https://nj.gov/bpu/pdf/boardorders/2025/20250813/2B%20ORDER%20JCP%26L%20Reliability%20Levels.pdf). Respectively: 118.81/1.46, 147.3/1.48, 160.30/1.95. Printed pages 3–4. Measurement year and document publication vintage are distinct.
- CAIDI is minutes per customer interruption, not annual minutes per customer (SAIDI). Event exclusions are not specified in these tables. No conversion to SAIDI, town-level allocation, EIA equivalence or current outage prediction.
- The real document has two annual tables on one page. The reader stops at the next table heading as well as a page boundary; tests cover same-page tables, wrong identity, reordered measures, missing tables and duplicate overall rows.
- Found and linked [Atlantic City Electric's 2024 Annual System Performance Report](https://www.atlanticcityelectric.com/cdn/assets/v3/assets/blt407b5f1850a51a1b/blte2a508f06ea1cfda/684320fc2fda0e95b4471da7/ACE_-_2024_Annual_System_Performance_Report.pdf?branch=prod_alias), prepared May 30, 2025. Its printed page 4 has company-wide and division CAIDI/SAIFI actuals and minimum levels. This is a verified filing, not yet a supported import. Some other tables are image-based; a complete review must preserve exclusion basis and units.
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

### Copy-ready requests — unsent

#### User decision — October 4, 2026: defer outreach

The user does not want to send inquiries now. Retain the drafts below for later; do not contact BPU, NJDEP, DOE/NREL or other institutions without separate authorization. No reason beyond the user's choice to defer was stated. The evidence below explains why the inquiries remain useful, not why the user postponed them.

- **BPU:** the user's normal browser accessed the portal and found ACE's public 2023 Annual System Performance Report, submitted May 30, 2024, under ER09080664 and EM14060581. The downloaded PDF's cover confirms that identity. It is not the 2024 report previously reviewed on ACE's website. The user did not locate a newer filing through the suggested searches; that is a search/access gap, not evidence that BPU lacks the filings. A later inquiry should identify this known filing and request newer public document IDs/links and the four-utility catalogue.
- **Lead:** the user independently queried distinct SUBMISSION_YEAR values in the public layer and received 2022, 2023 and 2024 only. This supports requesting a newer per-system aggregate export. A November 2025 schema edit does not establish 2025 submissions. Do not substitute newer statewide totals for system-level records.
- **ACE terms follow-up:** Exelon's terms, updated August 10, 2026, explicitly include ACE and restrict automated access, public reuse and deep links without permission. The existing direct supplier PDF link in PR #93 needs review before release. Obtaining an agency-hosted public filing is an alternative acquisition route to assess, not automatic legal clearance or a blanket third-party reuse licence. No ACE scraper/import has been added.
- **Drinking-water walkthrough:** the user found NJDEP's Integrated Water Quality Assessment Report (2022 cycle). That is surface-water/watershed assessment, not an individual supplier's Consumer Confidence Report. Next help the user identify one town/supplier and its actual annual drinking-water report, slowly, one step at a time. No additional water source was integrated from that page.

**To BPU reliability staff:**

> We are building a free housing-information site for New Jersey. Could you provide the public, non-confidential annual system performance reports for ACE, JCP&L, PSE&G and RECO for 2024 and 2025, or stable public links/a machine-readable summary? We need company-wide actual CAIDI, SAIFI and SAIDI where reported, units, event-exclusion basis, reporting geography and filing/publication dates. Please identify an ongoing public catalogue or notification mechanism and any attribution/reuse restrictions. We do not seek confidential infrastructure details.

**To NJDEP drinking-water/lead staff:**

> Your public lead-inventory map has 2025 statewide totals, while its linked layer 37 currently reaches submission 2024. Is a public 2025 per-system aggregate export available, keyed by PWSID with category definitions, update dates and inventory links? We seek aggregate counts only, not residential service-line addresses. Is there also an agency-maintained PWSID-to-Consumer-Confidence-Report URL/year export, and an update schedule and reuse notice for both datasets?

**To DOE/NREL LEAD maintainers:**

> The 2022 county bulk data contain signed reporting weights or energy costs in Essex, Hudson, Middlesex, Monmouth and Somerset, NJ. We preserve the original rows and withhold derived county estimates. Are those values intentional, and is there an approved aggregation/filtering method or corrected export? Is a successor bulk release planned, and how should consumers discover and cite it?

**For counsel/NJOGIS/OIP clarification before address work:**

> We are considering address lookup on a free public housing site using NJGIN NG911 points. Please clarify dataset reuse requirements, protected-address handling, notice/removal obligations, whether coordinate-derived results require suppression, and how a publisher can maintain compliant updates. The proposed interface would not expose owner names, but we do not assume that alone clears the privacy requirements.

Sending these requires separate user authorization. Agency responses, not additional guessed data, are the next dependency for the remaining gates. ACE's verified public filing is a concrete remaining import candidate; PSE&G/RECO catalogue coverage and automated CCR metadata remain unfinished. Gas price estimation was not added and is separate from identifying gas suppliers.

## Verification

Actual BPU acquisition, PDF landing and staging succeeded with three rows; staged inventory guard passed. Detailed final suite/load/build results are recorded in `m42-utilities-water.md`.
