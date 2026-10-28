"""Small aggregate visitor counter; run behind the existing Cloudflare tunnel."""

import argparse
from contextlib import contextmanager
import hashlib
import json
import re
import sqlite3
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

ALLOWED_ORIGINS = {
    "https://www.jiahaozhang.me",
    "https://jiahaozhang.me",
    "https://jiahaozhang6.github.io",
}


def normalize_country(code):
    if not isinstance(code, str) or not re.fullmatch(r"[A-Z]{2}", code):
        return None
    if code in {"XX", "T1", "ZZ"}:
        return None
    return "CN" if code == "TW" else code


@contextmanager
def connect(database):
    connection = sqlite3.connect(database, timeout=15)
    try:
        connection.execute("PRAGMA busy_timeout=15000")
        with connection:
            yield connection
    finally:
        connection.close()


def initialize(database):
    Path(database).parent.mkdir(parents=True, exist_ok=True)
    with connect(database) as connection:
        connection.execute("PRAGMA journal_mode=WAL")
        connection.executescript("""
            CREATE TABLE IF NOT EXISTS counters (
                code TEXT PRIMARY KEY, value INTEGER NOT NULL CHECK(value >= 0)
            );
            INSERT OR IGNORE INTO counters VALUES ('visits', 0);
            CREATE TABLE IF NOT EXISTS deduplication (
                token_hash TEXT PRIMARY KEY, expires INTEGER NOT NULL
            );
        """)


def snapshot(database, origin=None, visit_key=None):
    with connect(database) as connection:
        connection.execute("BEGIN IMMEDIATE" if visit_key else "BEGIN")
        if visit_key:
            now = int(time.time())
            connection.execute("DELETE FROM deduplication WHERE expires < ?", (now,))
            inserted = connection.execute(
                "INSERT OR IGNORE INTO deduplication VALUES (?, ?)",
                (hashlib.sha256(visit_key.encode()).hexdigest(), now + 86400),
            ).rowcount
            if inserted:
                connection.execute("UPDATE counters SET value = value + 1 WHERE code = 'visits'")
                country = normalize_country(origin)
                if country:
                    connection.execute(
                        "INSERT INTO counters VALUES (?, 1) "
                        "ON CONFLICT(code) DO UPDATE SET value = value + 1", (country,)
                    )
        values = dict(connection.execute("SELECT code, value FROM counters"))
    return {
        "visits": values.pop("visits", 0),
        "countries": values,
        # Preserve TW geographically; only its aggregate counter is folded into CN.
        "origin": origin,
    }


def make_server(database, host="127.0.0.1", port=8010):
    initialize(database)

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_args):
            pass  # Do not log visitor IP addresses or request headers.

        def reply(self, status, value=None):
            body = b"" if value is None else json.dumps(value).encode()
            self.send_response(status)
            origin = self.headers.get("Origin")
            if origin in ALLOWED_ORIGINS:
                self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Content-Length", str(len(body)))
            if self.command == "OPTIONS":
                self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
                self.send_header("Access-Control-Allow-Headers", "X-Visit-Key")
                self.send_header("Access-Control-Max-Age", "3600")
            self.end_headers()
            try:
                self.wfile.write(body)
            except (BrokenPipeError, ConnectionResetError):
                pass

        def handle_stats(self):
            request = urlsplit(self.path)
            if request.path != "/visitor-stats":
                return self.reply(404, {"error": "Not found"})
            if self.command in {"POST", "OPTIONS"} and self.headers.get("Origin") not in ALLOWED_ORIGINS:
                return self.reply(403, {"error": "Origin not allowed"})
            if self.command == "OPTIONS":
                return self.reply(204)
            visit_key = self.headers.get("X-Visit-Key") if self.command == "POST" else None
            if self.command == "POST":
                if not visit_key or not re.fullmatch(r"[a-f0-9-]{16,80}", visit_key):
                    return self.reply(400, {"error": "Invalid visit key"})
                if self.headers.get("Content-Length", "0") != "0" or self.headers.get("Transfer-Encoding"):
                    return self.reply(400, {"error": "Request body not supported"})
            # Cloudflare supplies the geographic origin; never store the IP itself.
            origin = self.headers.get("CF-IPCountry", "").upper()
            if normalize_country(origin) is None or parse_qs(request.query).get("locate") == ["0"]:
                origin = None
            try:
                self.reply(200, snapshot(database, origin, visit_key))
            except sqlite3.Error:
                self.reply(503, {"error": "Statistics temporarily unavailable"})

        do_GET = handle_stats
        do_POST = handle_stats
        do_OPTIONS = handle_stats

    return ThreadingHTTPServer((host, port), Handler)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", default="/var/lib/site-visitors/visitors.sqlite3")
    parser.add_argument("--port", type=int, default=8010)
    args = parser.parse_args()
    make_server(args.database, port=args.port).serve_forever()
