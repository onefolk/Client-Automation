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

- [Deployment and operation](docs/AUTONOMOUS_DEPLOYMENT.md)
- [Open-source architecture audit](docs/AUTONOMY_AUDIT.md)
- [Observed acceptance evidence and remaining gaps](docs/ACCEPTANCE_EVIDENCE.md)

Developer checks: `python -m pytest -q`, `npm test`, `npm run typecheck`.
Tests use isolated fixtures and do not establish unattended production execution.
Legacy architecture/deployment reports describe the prior implementation and are
superseded by the documents above.
