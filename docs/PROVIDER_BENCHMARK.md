# Provider evaluation and deployment gate

Status: implementation and local tests complete; cloud measurements pending. This
document is not evidence of a successful scheduled execution or 50 ready drafts.

## Architecture audit

| Existing code | Overlap | Boundary now used by the morning orchestrator |
|---|---|---|
| `discovery.py`, `open_discovery.py` | Maps scraper business discovery; existing seeds/directories and rotating OSM queries | `DiscoveryProvider` |
| `network.py`, `permitted_fetcher.py`, `research.py`, `strict_research.py` | Crawl4AI downloading/rendering/extraction | `ResearchProvider` |
| `verifier.py` | Truemail syntax and DNS/MX validation | `VerificationProvider` |

Qualification, historical suppression, Groq drafting, durable reserve, Sheet
readback, review actions and Gmail remain outside the adapters. The default
providers preserve the current lightweight pipeline. `config/providers.json`
rejects external selection without an explicit measured-promotion record. This
gate is a deployment setting, not a replacement for individual human approvals.

## Selected projects

* **google-maps-scraper v1.18.1**, MIT. Go 1.27.1 source toolchain,
  playwright-go, scrapemate, goquery and SQLite, with optional cloud integrations.
  The official Linux amd64 release is pinned and its publisher SHA256 verified.
  Only executable help is exercised. [Google Maps terms](https://www.google.com/help/terms_maps/)
  prohibit mass downloads/bulk feeds; no extraction permission was established.
  No Maps queries, proxies or CAPTCHA bypasses are run. Extraction yield and
  browser RAM are **unmeasured**, not zero. Production discovery is rejected.
* **Crawl4AI 0.9.5**, Apache-2.0. Python >=3.10, Playwright/Chromium,
  async networking/storage, lxml, numpy, pydantic and LLM integrations.
  Optional stealth-related dependencies may be installed transitively; stealth
  mode, proxies, managed browsers and hosted APIs are not used. The adapter
  renders already-authorized HTML with browser networking disabled. This can
  execute inline JS but cannot fetch external scripts or API data. Its actual
  incremental quality and cost must be measured before promotion.
* **Truemail 4.0.0**, MIT. Ruby >=2.5, simpleidn and Ruby3.1+ net-smtp dependencies; tested with Ruby3.3.
  DNS/MX mode only, with bounded timeouts and no SMTP mailbox probes. Python's
  official-domain and source-provenance rules remain mandatory. Neither provider
  proves mailbox existence or inbox delivery. Promotion awaits measured benefit.

Primary dependency/license sources:
[Maps](https://github.com/gosom/google-maps-scraper),
[Crawl4AI](https://github.com/unclecode/crawl4ai),
[Truemail](https://github.com/truemail-rb/truemail).
Resolved Python/Ruby dependency lists are included in cloud artifacts; the Maps
binary smoke test does not establish a successful source build.

## Reproducible cloud experiment

`provider_benchmark.yml` runs only on the production fork's main branch, weekly
Thursday at 08:23 UTC (13:53 IST). Manual dispatch is diagnostic only. Reports
record the actual GitHub event, run ID, commit and timestamps. A schedule can be
delayed or skipped by GitHub; the presence of cron is not proof of execution.

The benchmark compares the existing lightweight strict researcher with the same
qualification logic using Crawl4AI. Up to eight existing seed businesses are
stratified by industry. They are **not** counted as newly discovered prospects.
One separate bounded OSM query measures discovery yield, with ODbL attribution;
its population differs from the seed sample and is not an apples-to-apples Maps
comparison. Unreviewed directories remain excluded.

Robots rules, request bounds, same-domain navigation and site-term screening run
before collection. Explicit automated-extraction restrictions or inaccessible
linked terms cause exclusion. Automated screening is not legal clearance; known
prohibitions must be excluded in configuration. No access challenges are bypassed.
Each provider receives identical frozen HTML, exact source URLs and SHA256 hashes.
One synthetic inline-JS capability check is reported separately and never counts
as a business/contact/lead. Crawl4AI fallbacks are explicitly counted; a failed
tool smoke test fails the job instead of presenting fallback as integration.

Both verifiers receive the same publicly sourced contact union (maximum30).
Strict evidence-qualified candidates may receive at most four Groq requests.
This isolated job cannot check live historical-contact conflicts: production
qualified/ready counts are therefore unknown. It neither writes the Sheet nor
loads its credentials. No Gmail credentials, sending code or autoapproval is
invoked. The existing Apps Script implementation sending lock remains true.

Metrics include public contacts, corroborated official domains, specific
opportunities, evidence-qualified candidates, valid draft bodies, HTTP/API calls,
wall time and sampled process-tree RSS. RSS sums can double-count shared browser
pages and are not container peak memory. Install and execution stages are measured
separately. GitHub job elapsed time is the Actions-minute basis; downloading a
small binary is outside the per-process Maps help measurement.

## Cost and operations

No paid API or hosting is added. Ubuntu job timeout20min, concurrency1, weekly
schedule: maximum100 scheduled runner minutes in a five-Thursday month, plus
diagnostic runs. Artifact retention3days. This is an incremental ceiling, **not**
a verification of the account's remaining free allowance; other repositories and
CI also consume it. Do not infer zero billing from open-source licensing. The
account billing/spending limit must remain configured to prohibit paid overages.

Until results justify a change, `research=lightweight`, `verification=python-dns`
and `discovery=open-public-data` remain production defaults. External packages
are installed only by the benchmark workflow, not every overnight outreach run.
Promotion requires recording the scheduled evidence URL, measured lead-quality
gain, bounded runner cost and appropriate dependency installation in the morning
workflow. A deployment toggle alone is insufficient.

Local validation: 77 tests passed, 2 live Google Sheet tests skipped with
`PYTHON_DOTENV_DISABLED=1`. No benchmark records were uploaded or approved.

## Diagnostic run (not schedule acceptance)

[Run39745982614](https://github.com/Giridharan-E/Client-Automation/actions/runs/39745982614)
was manually dispatched at 2026-10-22 08:12:07 UTC and completed at08:15:13 UTC.
It installed all three projects successfully. The synthetic check exposed that
Crawl4AI's default raw-HTML path did not render inline JS. The adapter now sets
`process_in_browser=True` and the benchmark fails if that check fails. Therefore
the first run's 11.039s/601.23MiB research measurement is **not** evidence of
browser-rendering benefit. It found two public contacts, zero strict opportunities
and zero drafts across eight seed businesses, four of whose domains were
accessible/corroborated. OSM returned24 distinct candidate domains in its separate
partition; these were not checked against production history.

Python and Truemail both passed the same two contacts: Python0.523s/43.76MiB,
Truemail1.255s/84.43MiB. This tiny sample shows no verification gain. Python plus
Crawl4AI installation35.103s; Chromium26.860s; Truemail0.837s. Maps help executed
in0.106s/18.96MiB; these are CLI-smoke measurements, not scraping measurements.
All memory numbers are sampled aggregate process-tree RSS, as described above.
