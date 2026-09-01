# Housing Intelligence Platform Specifications
## Product Specification v1.1

### Vision

Build a modular Housing Intelligence Platform that functions as a structured analytics system for understanding housing markets, beginning with New Jersey and expanding over time.

The purpose of the application is not to become a generic real estate dashboard or an AI chatbot. Instead, it exists to collect, clean, connect, analyze, and explain public housing, property, demographic, and economic data.

The system should transform fragmented public datasets—including NJ parcel data, MOD-IV property records, Zillow research data, Census data, FHFA indexes, building permits, FRED, BLS, IRS migration, and future sources—into a consistent analytical warehouse that can support dashboards, maps, reports, rankings, APIs, and optional AI-generated explanations.

The platform should prioritize trustworthy housing intelligence rather than raw data display.

The application should be designed as a platform rather than a single-purpose dashboard, allowing future geographies, data sources, analytical models, and AI interpretation modules to build upon the same housing data layer without requiring architectural changes.

---

### Core Principles

#### 1. Housing intelligence is the primary object.

The system is fundamentally about housing intelligence—not individual datasets.

Zillow files, Census tables, NJ parcel records, economic indicators, and GIS boundaries are inputs that contribute to a structured analytical view of housing markets.

Insights should exist independently of the source from which they originated.

#### 2. Data sources are evidence, not the destination.

Public datasets should never remain isolated downloads.

Every source should be transformed into structured housing data through automatic processing.

Examples include:

* regions
* parcels
* counties
* municipalities
* ZIP codes
* census tracts
* housing values
* rents
* income
* population
* permits
* employment
* migration
* affordability metrics
* market rankings
* data provenance

The original raw data should always remain available for reference and reproducibility.

#### 3. The platform should start NJ-first, not NJ-only.

Version 1 should focus on New Jersey because it provides a manageable geography with unusually rich state-level housing and parcel data.

The platform should still be designed so geography can expand later.

Examples include:

* New Jersey
* Northeast states
* selected comparison states
* national U.S. datasets

New Jersey is the initial proving ground, not the permanent boundary.

#### 4. Public data should be maximized before paid data.

The platform should rely primarily on public, low-cost, and reproducible data sources.

Initial sources should include:

* NJ parcel / MOD-IV data
* Zillow ZHVI
* Zillow ZORI
* Census ACS
* FHFA HPI
* Census Building Permits
* FRED
* BLS
* IRS migration
* HUD USPS ZIP crosswalk
* HUD income limits
* HUD Fair Market Rents
* HUD Comprehensive Housing Affordability Strategy (CHAS)
* NJ-specific public data

The HUD datasets serve affordability specifically. Income limits and Fair Market Rents
supply the thresholds housing agencies actually use, so an affordability figure can cite
a published standard rather than a threshold the platform invented. The USPS crosswalk
supplies residential-address weights for allocating ZIP-level data, which is the correct
basis for housing measures where area weighting is not.

Paid proprietary listing data should not be required for Version 1.

#### 5. Analytics should be computed before AI interpretation.

The system should not ask an LLM to analyze raw housing datasets.

Python, SQL, PostgreSQL, DuckDB, and deterministic analytics should calculate the facts first.

The LLM should receive compact analysis packets, not raw databases.

Example:

```text
Mercer County, NJ
2019-2025

Home values: +47%
Rent: +31%
Income: +25%
Population: +3%
Permits: -12%
Mortgage rates: 3.9% → 6.7%
```

The model may explain these facts, but it should not become the source of truth.

#### 6. Heavy stages should complete before LLM stages.

The platform should be staged so memory-intensive data work is completed and persisted before local AI inference begins.

The system should avoid running large ETL, analytics, and LLM workloads simultaneously when not necessary.

Each stage should produce a durable output before the next stage runs.

#### 7. Storage and computation should be practical.

The platform should use a local-first analytical stack.

Core storage and processing should include:

* Parquet for raw and historical file storage
* DuckDB for fast analytical processing of large files
* PostgreSQL for the curated warehouse and application-facing database

This provides serious data-engineering depth without requiring cloud infrastructure in Version 1.

#### 8. AI providers are optional infrastructure, not the product.

The value of the platform should not depend on Claude, GPT, Gemini, DeepSeek, Qwen, Gemma, or any specific model.

The housing warehouse and analytics engine are the product.

The AI layer should be replaceable.

#### 9. AI should be evaluated, not assumed.

Candidate models should be tested against standardized housing-analysis scenarios before being selected. This applies to every candidate, local or hosted: a model that has not been measured on these scenarios does not write text the platform publishes.

Candidate local models include:

* Qwen3 8B
* Qwen3.5 9B
* Gemma 4 E4B
* Gemma 4 QAT
* Nemotron 3 Nano 4B
* Phi-4 Mini Reasoning

Because Gemma 4 QAT is a quantization variant rather than a distinct model, the
evaluation has two axes: which model family reasons best about housing analytics, and
how much quality a quantized build gives up for its smaller memory footprint. Both
should be reported.

Claude usage credits may be used as an evaluator for model-performance testing, not as the default production intelligence layer.

#### 10. Modularity is mandatory.

Every major capability should exist as an independent module.

Examples include:

* data acquisition
* raw storage
* ETL
* validation
* warehouse loading
* geographic matching
* analytics
* forecasting
* API
* dashboard
* AI explanation
* model evaluation

Modules should communicate through stable interfaces and should be replaceable without affecting the rest of the application.

---

### User Experience

The application should feel less like “chat with housing data” and more like a housing intelligence workspace.

The primary interactions should be:

* explore housing trends
* compare counties and municipalities
* view maps
* inspect affordability
* analyze price, rent, income, and supply changes
* review market rankings
* generate reports
* request optional explanations of computed trends
* review model-evaluation results

Users should not need to understand the raw source datasets to use the platform.

Instead, the application should surface cleaned, validated, and contextualized housing intelligence.

For example, selecting Mercer County should not simply show raw Zillow and Census rows.

Instead, the system should automatically surface:

* home-value growth
* rent growth
* income growth
* population change
* construction activity
* affordability change
* comparison against other NJ counties
* relevant caveats
* source provenance

---

The application should support both analytical exploration and portfolio demonstration.

Examples:

“I want to understand where affordability is worsening fastest in New Jersey.”

vs.

“I want to show employers a serious data-engineering and analytics platform.”

These represent different uses of the same system and should influence how results are presented.

---

The application should support geographic contexts.

A geographic context represents the level at which housing intelligence is explored.

Examples include:

* state
* county
* municipality
* ZIP code
* census tract
* parcel

A geography should not own the data.

Instead, it references shared housing, economic, demographic, and spatial records.

Data should never require duplication across views.

---

### Architecture Philosophy

The application should be centered around a Housing Data Engine.

The Housing Data Engine is responsible for:

* raw data tracking
* data normalization
* geographic identifiers
* warehouse schemas
* historical records
* validation
* provenance
* analytics-ready tables
* versioning
* source refreshes

Everything else should be built around this engine.

---

The application should use a staged modular architecture.

Example:

```text
Public Data Source

↓

Raw File Download

↓

Raw Parquet Storage

↓

DuckDB Processing

↓

Validation

↓

PostgreSQL Warehouse

↓

Analytics Tables

↓

Analysis Packets

↓

Dashboard / API / Reports

↓

Optional LLM Explanation
```

Each stage should persist its output before the next stage begins.

---

The application should distinguish between heavy processing and lightweight interaction.

Heavy data processes should perform:

* source downloads
* file conversion
* geospatial processing
* cleaning
* joins
* validation
* warehouse loading
* historical comparisons
* metric generation

Lightweight interaction should perform:

* dashboard filtering
* API queries
* map rendering
* report display
* explanation generation from compact packets

This separation improves performance, reliability, and local RAM availability.

---

The LLM should never require the full warehouse in memory.

The AI layer should consume compact analysis packets generated by the analytics layer.

Example:

```text
PostgreSQL / DuckDB

↓

Computed metrics

↓

Small JSON analysis packet

↓

Explanation model

↓

Human-readable explanation
```

If the LLM contradicts the computed metrics, the LLM is wrong.

---

### AI and Evaluation Philosophy

AI is an enhancement layer, not the foundation of the platform.

The platform should remain fully useful if the AI layer is disabled.

The primary AI use case should be explanation, not chat.

Examples include:

* explain why affordability worsened
* summarize a county trend
* describe likely contributing factors
* identify caveats
* convert metrics into plain-language reporting

The system should not present the LLM as an all-knowing housing expert.

It should clearly distinguish between:

* computed platform metrics
* model-generated interpretation
* unsupported speculation

---

The explanation model should operate only on structured analysis packets.

The model should not ingest:

* raw parcel files
* full Census tables
* full PostgreSQL exports
* raw Zillow datasets
* GIS datasets

The model should receive:

* region
* time period
* computed metrics
* comparison groups
* ranked changes
* anomalies
* known caveats
* source metadata

This keeps inference cheap and fast. On a local runtime it also keeps inference RAM-efficient; on a hosted one it keeps the billed token count small, which is the same constraint expressed in the other runtime's currency.

---

The platform should include a model-evaluation workflow.

Standardized test scenarios should be generated from real or representative housing analytics.

Each candidate model should receive the same prompt and the same analysis packet.

Claude may evaluate the outputs using a rubric.

Evaluation criteria should include:

* factual accuracy
* reasoning quality
* unsupported claims
* hallucination rate
* completeness
* clarity
* usefulness
* instruction following
* format consistency
* latency

Automated checks should verify numerical accuracy where possible.

Claude should evaluate qualitative quality, not replace deterministic validation.

---

The model-evaluation report should become a portfolio artifact.

The report should explain which model was selected and why.

The final model choice should be based on observed performance in the housing-analysis task, not generic benchmark reputation.

---

The platform should run hosted inference by default and retain a local runtime as a working fallback.

Hosted inference should be chosen for concurrency rather than for price. Local generation is serial on a machine that cannot hold two models at once, and that does not scale to national coverage.

The local runtime should remain installable and working. It is what keeps the explanation layer durable when a vendor is not.

---

Model selection should resolve through an ordered preference list rather than a single pinned model.

The list should contain only models that have passed the evaluation described above, ordered by preference, with a local model last.

Generation should use the first model in the list that is currently available. A model that is deprecated, unreachable, or rate-limited should fall through to the next, and the platform should record which model actually produced each explanation.

Hosted model identifiers should be pinned to explicit versions rather than to moving aliases. A pinned model that is withdrawn fails loudly and falls through to the next candidate; an alias that is repointed changes the platform's published output silently, which is worse.

Cost should be recorded per candidate and reported alongside quality, so that a cheaper model is chosen on measured evidence rather than on assumption. Cost should not by itself reorder the preference list at generation time.

---

The platform should accept that hosted generation is not reproducible, and should record that rather than obscure it.

A local model at a fixed seed reproduces its output indefinitely from a file on disk. A hosted model does not: it can be withdrawn, repriced, or changed behind its identifier.

This is an accepted trade rather than an oversight. Its mitigations are the retained local runtime, the pinned model versions, the model identity stored on every generated row, and the packet hash that marks prose stale when the numbers behind it move.

---

### Long-Term Product Direction

The Housing Intelligence Platform should not attempt to become every real estate application.

Instead, it should become a strong analytical foundation for housing-market intelligence.

The objective is to build the best possible housing data and analytics platform first.

Examples of future capabilities include:

* Northeast expansion
* national U.S. expansion
* parcel-level enrichment
* affordability forecasting
* climate and flood-risk overlays
* migration-driven demand analysis
* automated monthly housing reports
* public analytics API
* model-comparison dashboard
* optional AI report generation

Each future capability should reuse the same warehouse and analytics layer rather than creating separate data systems.

---

### Non-Goals (Version 1)

Version 1 should not attempt to:

* cover the entire United States immediately
* scrape Zillow listings
* depend on paid proprietary real estate data
* become a chatbot
* make the LLM calculate core metrics
* load raw datasets into an LLM
* run all pipeline stages simultaneously
* require cloud data warehousing
* predict home prices perfectly
* support every state-specific dataset
* become a consumer home-buying app

Instead, Version 1 should focus on building a robust NJ-first housing data foundation with strong analytics, clear source provenance, and an optional evaluated AI explanation layer.

---

### Changes from Previous Draft

#### 1. Shifted from “National-first” to “NJ-first, U.S.-expandable”

**Previous idea:**
The platform was framed as a broad national housing analytics system.

**Current version:**
New Jersey is the initial focus because it offers manageable scope and strong state-specific parcel/property data.

**Reason:** This allows the platform to become deeper and more differentiated while preserving future expansion potential.

#### 2. Clarified that the project is not a chatbot

The previous framing left room for AI to appear central to the user experience.

The new version explicitly states that dashboards, maps, rankings, APIs, reports, and computed analytics are the core experience.

**Reason:** This keeps the project positioned as a data-engineering and analytics platform rather than another LLM application.

#### 3. Added staged processing as a core architectural principle

The new version explicitly separates:

* data acquisition
* warehouse processing
* analytics generation
* AI interpretation

**Reason:** Heavy data work should be completed and persisted before local LLM inference begins, freeing RAM and improving reliability.

#### 4. Defined PostgreSQL, Parquet, and DuckDB roles

The architecture now clearly separates storage and processing responsibilities.

**Reason:** PostgreSQL acts as the curated warehouse, Parquet stores raw and historical files, and DuckDB supports fast analytical processing without requiring a cloud warehouse.

#### 5. Reframed AI as interpretation and evaluation

The AI layer now has two specific roles:

* local LLMs explain compact analysis packets
* Claude evaluates local model performance on standardized scenarios

**Reason:** This creates a practical AI enhancement without making the LLM responsible for data truth or core platform functionality.

#### 6. Added explicit model-evaluation philosophy

The specification now treats model selection as an empirical process.

**Reason:** Qwen3 8B, Qwen3.5 9B, Gemma 4 E4B, Gemma 4 QAT, Nemotron 3 Nano 4B, and Phi-4 Mini Reasoning should be compared on actual housing-analysis tasks rather than selected from generic benchmarks alone.

#### 7. Strengthened Version 1 boundaries

The specification now excludes nationwide scope, paid listing data, chatbot behavior, raw-data LLM ingestion, and cloud-first warehousing from Version 1.

**Reason:** Clear boundaries reduce scope creep and make the first version more achievable, polished, and portfolio-ready.

---

### Amendments in v1.1

Recorded 2026-09-01. The sections above are the current specification; this section
says what changed and why, in the same way "Changes from Previous Draft" does for v1.0.

#### 1. Explanation inference may be hosted; it is hosted by default, with local retained

**Previous idea:** The explanation layer was specified as a local LLM throughout, with
RAM efficiency given as part of the rationale.

**Current version:** The platform runs hosted inference by default and keeps a local
runtime as a working fallback. Every other constraint on the layer is unchanged — it
consumes analysis packets only, it explains rather than computes, it is optional, and
the API still never runs a model.

**Reason:** Measured local generation is 9,140ms per region and serial. That is three
minutes for New Jersey's 21 counties and roughly eight hours for every US county, which
is the binding constraint on national coverage. Principle 8 already required the AI
layer to be replaceable and named Gemini and DeepSeek among the providers the platform
must not depend on, so this exercises that principle rather than weakening it.

#### 2. The evaluation obligation extends to hosted candidates

**Previous idea:** Principle 9 required *local* models to be tested before selection.

**Current version:** Every candidate is tested on the same scenarios, local or hosted.

**Reason:** The purpose of principle 9 is that model choice follows measurement. A
hosted model exempted from the benchmark would be exactly the assumption that principle
exists to prevent, and it would be publishing prose under a public domain.

#### 3. Reproducibility of generated prose is explicitly traded, not assumed

**Previous idea:** Not addressed. Local inference made reproducibility a property the
specification never had to claim.

**Current version:** Hosted generation is stated to be non-reproducible, with the
mitigations named: the retained local runtime, pinned model versions, stored model
identity per row, and the existing packet hash.

**Reason:** A property being lost should be written down as a cost rather than
discovered later. The mitigations are what keep the loss bounded.
