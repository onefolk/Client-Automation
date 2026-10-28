# OneFolk morning outreach queue

Production repository: **Giridharan-E/Client-Automation**, branch **main**.

The target is 50 independently eligible drafts for weekday morning review in the
[existing master Sheet](https://docs.google.com/spreadsheets/d/1U3JxQUcxSyqfZySnHNdLIwExtr3ikfcYlj0a3YY7ATM/edit#gid=1604155662).
Actual counts come from fresh evidence and live Sheet readback. Missing evidence,
source shortages and API failures are reported rather than hidden by record totals.

`morning_queue.yml` orchestrates overnight discovery, official-site research, MX
checks, suppression, approved portfolio matching, Groq drafting, durable reserve
storage and Sheet synchronization. Configurable public-source partitions and
checkpoints replace repeated CSV seed scans. Apps Script provides individual
approval auditing, the independent morning watchdog and internal digest.

**Prospect sending remains disabled by a code interlock.** Separate authorization
is required to enable it. Existing deployments and triggers must be verified before
this repository can be described as an operational autonomous system.

## Current specification

- **Target:** 10 high-quality reviewable drafts by 9 AM IST on weekdays; 50 is the scale ceiling.
- **Email:** 3-4 short paragraphs, 40-120 body words (target 50-90). Verified observation plus a "could"
  suggestion, then one industry-matched OneFolk capability sentence, then one low-pressure referral question.
  Footer is the plain `https://onefolk.in/`.
- **Discovery sources (all free, merged per run):** Wikidata (Indian universities/colleges, CC0), Google
  Search via Serper (20 industries, 22 cities, "under construction" signals, public social-profile bio
  websites), OpenStreetMap fallback. Social platforms are never scraped directly; a profile only yields a
  candidate when it publicly lists an official website, which is then researched like any other lead.
- **Reachable and genuine:** every lead needs an official site, a verified quotable observation, a public
  email on that site, an MX check and no suppression match, then human approval.
- **Conversion stages:** set `status` in the Approval Queue to `MEETING_BOOKED`, `PROPOSAL_REQUESTED` or
  `CLIENT_CONVERTED`; the Dashboard tab counts them cumulatively.
- **Config:** `SERPER_API_KEY` (secret) enables Serper; `SERPER_QUERIES_PER_HARVEST` (default 3) sets
  searches per run.

- [Deployment and operation](docs/AUTONOMOUS_DEPLOYMENT.md)
- [Open-source architecture audit](docs/AUTONOMY_AUDIT.md)
- [Observed acceptance evidence and remaining gaps](docs/ACCEPTANCE_EVIDENCE.md)

Developer checks: `python -m pytest -q`, `npm test`, `npm run typecheck`.
Tests use isolated fixtures and do not establish unattended production execution.
Legacy architecture/deployment reports describe the prior implementation and are
superseded by the documents above.
