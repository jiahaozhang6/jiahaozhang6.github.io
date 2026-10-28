The visitor panel uses `https://papers.jiahaozhang.me/visitor-stats`, an independent
Python standard-library service on `127.0.0.1:8010`. It does not use the ArxivLens
database or runtime. SQLite stores the visit total and country/region totals in
`/var/lib/site-visitors/visitors.sqlite3`, outside the checkout.

Cloudflare Tunnel routes `/visitor-stats` to port 8010 before the existing papers
route to port 8000. Caddy has the same route for traffic arriving directly.
The public API returns all totals in one response; there is no per-country scan.
Cloudflare's `CF-IPCountry` supplies the geographic origin. TW is preserved in
the response for the globe's initial orientation and merged into CN for totals.
`?locate=0` omits the current origin and counts the total only, honoring the
browser's Do Not Track / Global Privacy Control preference.

Requests do not log or store IPs, cities, cookies, or visitor profiles. A random
session key is kept in browser sessionStorage; its SHA-256 hash is temporarily
kept in a separate deduplication table (24 hours) so retries cannot inflate the
total. The table has no association with a country or IP. The browser caches
aggregate counts only, displays them as saved counts during outages, and retries
when the connection returns. Request failures are distinct from an empty dataset.

Deployment:

1. Copy `server/` and `visitor-origins.js` to `/home/ubuntu/site-visitors/`.
2. On the first deployment, create `/var/lib/site-visitors/` owned by ubuntu,
   then run `python3 server/import_abacus.py --database /var/lib/site-visitors/visitors.sqlite3`.
   It imports the historical total and every configured country counter, folds
   TW into CN, aborts on failed reads, and refuses to replace populated data.
3. Install `site-visitors.service` in `/etc/systemd/system/`, then enable it.
4. Add the path route to Cloudflare Tunnel / Caddy and validate before reload.
5. Test GET and the site's browser CORS preflight. Use GET for health checks;
   POST increments once per session and requires the allowed Origin and visit key.
   An empty POST may arrive through Cloudflare with `Transfer-Encoding: chunked`;
   the service accepts its zero-length chunk while rejecting non-empty bodies.

Verify with `python -m unittest discover -s server -p 'test_*.py'`.
The browser regression checks use `node scripts/check-visitor-origins.cjs`
with Playwright installed (`PLAYWRIGHT_MODULE` can point to an existing install).
They cover mobile/desktop, language changes, delayed responses, genuine empty
data, network failures, cached data, recovery, privacy settings, and blocked
storage. Browser requests are mocked; the checks do not add production visits.
If a POST fails, the panel still reads existing counts with GET and retries the
write with the same key. A successful fallback read never marks a failed write
as counted. Live verification must include a fresh session's POST through the
public Cloudflare route; a GET-only check misses proxy request-body framing.

Back up SQLite with the sqlite3 connection backup API while the service is live;
copying just the main database file during writes can omit the WAL contents.
Re-deploying source must never overwrite or re-import the production database.
