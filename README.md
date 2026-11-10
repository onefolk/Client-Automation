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
- **No-website lane:** businesses with no working website are found separately (Overture places with no
  website, public profiles that list none, and dead or parked domains). Each must pass domain guesses and a
  Google search, and be findable under its exact name, before any claim is made. Unclear cases are parked, and a
  site that turns up moves the lead to the normal pipeline. Leads with a publicly posted email go to the Approval
  Queue; phone-only leads go to the `Call List` tab for a person to dial. Mark a row `DO_NOT_CALL`,
  `NOT_INTERESTED` or `WRONG_NUMBER` to stop further contact. Needs `SERPER_API_KEY`; set `NO_SITE_ENABLED=false`
  to turn it off, and `NO_SITE_SEARCHES_PER_RUN` (15) / `NO_SITE_SEARCHES_PER_DAY` (30) to cap search spend.
  Add big chains and booking sites to `config/chains.json` to keep them out of this lane.
- **Manual Search page (dashboard):** the **Manual Search** tab starts the same workflow with the options below,
  shows live status and caps full runs at 2 a day. One-time setup: create a fine-grained GitHub token limited to
  this repository with *Actions: Read and write*, add it in Apps Script *Project Settings > Script properties* as
  `GITHUB_DISPATCH_TOKEN` (and `GITHUB_REPOSITORY` if the repo is not `onefolk/Client-Automation`), then deploy a
  new version so admins approve the new "connect to an external service" permission.
- **Manual runs (testing and targeted client search):** the schedule stays automatic. To run by hand, open GitHub
  Actions > *OneFolk Autonomous Morning Queue* > **Run workflow** on `main`, then pick `mode` (`full`,
  `publish-only` or `preflight` to test credentials only), `lane` (`all`, `no-website`, `website`), one `city`, one
  `industry`, a `target` and `no_site_searches`. City and industry limit both discovery and research. Manual runs
  use their own search budget, so they never eat into the nightly allowance, but they do share the daily AI budget.
- **Reachable and genuine (website lane):** every lead needs an official site, a verified quotable observation, a public
  email on that site, an MX check and no suppression match, then human approval.
- **Conversion stages:** set `status` in the Approval Queue to `MEETING_BOOKED`, `PROPOSAL_REQUESTED` or
  `CLIENT_CONVERTED`; the Dashboard tab counts them cumulatively.
- **Config:** `SERPER_API_KEY` (secret) enables Serper; `SERPER_QUERIES_PER_HARVEST` (default 3) sets
  searches per run.

- [Deployment and operation](docs/AUTONOMOUS_DEPLOYMENT.md)
- [Writer skills (editable prompt files)](skills/README.md)
- [All documentation](docs/README.md)
- [Observed acceptance evidence and remaining gaps](docs/ACCEPTANCE_EVIDENCE.md)

Developer checks: `python -m pytest -q`, `npm test`, `npm run typecheck`.
Tests use isolated fixtures and do not establish unattended production execution.
Legacy architecture/deployment reports describe the prior implementation and are
superseded by the documents above.
