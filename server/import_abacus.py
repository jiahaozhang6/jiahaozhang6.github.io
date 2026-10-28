"""Import the original public aggregate counters once, without resetting totals."""

import argparse
import concurrent.futures
import json
import re
import time
import urllib.error
import urllib.request
from pathlib import Path

from visitor_stats import connect, initialize, normalize_country


def read_counter(key):
    url = "https://abacus.jasoncameron.dev/get/www-jiahaozhang-cn-20260922/" + key
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=18) as response:
                value = json.load(response).get("value")
                if type(value) is not int or value < 0:
                    raise ValueError("Invalid counter: " + key)
                return key, value
        except urllib.error.HTTPError as error:
            if error.code == 404:
                error.close()
                return key, 0
            error.close()
            if attempt == 2:
                raise
        except (OSError, ValueError):
            if attempt == 2:
                raise
        time.sleep(2 * (attempt + 1))


def import_counters(database):
    initialize(database)
    with connect(database) as connection:
        if connection.execute("SELECT SUM(value) FROM counters").fetchone()[0]:
            raise ValueError("Refusing to replace existing statistics")
    source = (Path(__file__).resolve().parent.parent / "visitor-origins.js").read_text(encoding="utf-8")
    codes = sorted(set(re.findall(r"\['([A-Z]{2})',", source)))
    if len(codes) < 50:
        raise ValueError("Country list is incomplete")
    progress = Path(database).with_suffix(".import.json")
    values = json.loads(progress.read_text()) if progress.exists() else {}
    pending = [key for key in ["country-" + code for code in codes] if key not in values]
    failed = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(read_counter, key): key for key in pending}
        for future in concurrent.futures.as_completed(futures):
            key = futures[future]
            try:
                key, value = future.result()
                values[key] = value
                temporary = progress.with_suffix(".pending")
                temporary.write_text(json.dumps(values), encoding="utf-8")
                temporary.replace(progress)
                print("Recovered %s: %d" % (key, value), flush=True)
            except (OSError, ValueError) as error:
                failed.append(key)
                print("Retry needed for %s: %s" % (key, type(error).__name__), flush=True)
    if failed:
        raise RuntimeError("Import incomplete; re-run to resume: " + ", ".join(failed))
    _, values["visits"] = read_counter("visits")
    totals = {"visits": values.pop("visits")}
    for key, value in values.items():
        code = normalize_country(key.removeprefix("country-"))
        if value and code:
            totals[code] = totals.get(code, 0) + value
    with connect(database) as connection:
        connection.execute("BEGIN IMMEDIATE")
        if connection.execute("SELECT SUM(value) FROM counters").fetchone()[0]:
            raise ValueError("Refusing to replace existing statistics")
        connection.executemany("INSERT OR REPLACE INTO counters VALUES (?, ?)", totals.items())
    print(json.dumps({"visits": totals["visits"], "countries": len(totals) - 1}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", required=True)
    import_counters(parser.parse_args().database)
