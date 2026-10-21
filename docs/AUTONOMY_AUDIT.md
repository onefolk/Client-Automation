# Architecture audit — 22 October 2026

The existing web app uses local SQLite and a CSV sync endpoint; it is not the master
Sheet approval interface and is not an authenticated production approval gateway.
It is deliberately not promoted as one. The master Sheet is authoritative.
The old Python researcher awarded points for generic features, treated missing
forms as evidence of mailto-only inquiries, and did not persist full provenance in
the queue. Historical campaign entries claimed READY with blank IDs/timestamps.
Those records are not evidence of autonomous operation.

| Component | Verified upstream capabilities and license | Decision |
|---|---|---|
| [gosom/google-maps-scraper](https://github.com/gosom/google-maps-scraper) | MIT; Go/headless-browser Google Maps extraction; business details, website links, optional email extraction. Upstream warns about significant CPU/memory requirements; its example requests 512 MiB, not a measured peak. Linux/Docker can run on hosted runners. | Not installed. Code licensing does not grant rights to extract Google data. No permission to bypass access restrictions, CAPTCHA or use proxies. Its listing data would still require official-site research. Free execution is not a promise of permitted access or reliable yield. |
| [Crawl4AI](https://github.com/unclecode/crawl4ai) | Apache-2.0; browser-backed crawling, Markdown and structured extraction. Can run on Linux with browser dependencies; more process/memory overhead than sequential HTTP parsing. No measured peak for this workload. | Deferred. Useful for permitted JavaScript-rendered sources, but installing it would not solve qualification or public-source replenishment. Existing bounded Python HTTP/BeautifulSoup extraction is retained, with robots checks and no access-control bypass. Unsupported pages remain NEEDS_RESEARCH. |
| [Truemail](https://github.com/truemail-rb/truemail) | MIT; Ruby syntax, DNS and SMTP checks, configurable validation. Ruby is runnable on hosted Linux; SMTP depends on outbound connectivity and recipient-server behavior. No workload memory benchmark was performed. | Not installed. Existing Python syntax/DNS code is retained and hardened: missing DNS support fails closed, null MX is rejected, and A-only results no longer count as MX verification. SMTP probing adds uncertain mailbox conclusions and operational burden; no inbox-delivery guarantee is made. |

[Google Maps terms](https://cloud.google.com/maps-platform/terms) distinguish
software rights from data-use restrictions. No Google Maps scraper is enabled.

Replenishment uses a rotating set of small geographic/industry queries against
[Overpass](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html), with
[OpenStreetMap attribution and ODbL provenance](https://www.openstreetmap.org/copyright).
The source is a discovery hint; its contact details are not used as verified email.
Only an explicitly published website URL is followed. Checkpoints advance after
durable candidate writes. Timeouts and partial responses do not advance them.
Public services may shed load; no proxies or alternate accounts bypass limits.
This is low-volume scheduled research, not a public app using Overpass as its backend.

The strict researcher currently qualifies explicit manual application/registration
form workflows corroborated by fetched text, matched to OneFolk's published website
proof. This is intentionally narrower than generic website consulting. It cannot
guarantee 50 leads daily. Source expansion and richer evidence extraction should
be judged by actual Source Performance yields, not candidate totals.

No new paid subscription, browser service or hosted database was added. Runner,
HTTP and AI allowances bound this pipeline, but account-wide remaining free usage
was not verified; a per-pipeline budget is not an account billing guarantee.
