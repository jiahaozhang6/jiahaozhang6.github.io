import concurrent.futures
import json
import contextlib
import io
import http.client
import tempfile
import threading
import unittest
from unittest.mock import patch
import urllib.error
import urllib.request
from pathlib import Path

from visitor_stats import connect, initialize, make_server, snapshot
from import_abacus import import_counters


class VisitorStatisticsTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.database = str(Path(self.directory.name) / "counts.sqlite3")
        initialize(self.database)
        with connect(self.database) as connection:
            connection.executemany(
                "INSERT OR REPLACE INTO counters VALUES (?, ?)",
                [("visits", 494), ("CN", 183), ("US", 67)],
            )

    def tearDown(self):
        self.directory.cleanup()

    def test_concurrent_retries_increment_once_and_keep_taiwan_coordinates(self):
        def request(_):
            return snapshot(self.database, "TW", "a" * 32)

        with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
            results = list(pool.map(request, range(24)))
        self.assertTrue(all(result["visits"] == 495 for result in results))
        self.assertTrue(all(result["origin"] == "TW" for result in results))
        self.assertEqual(results[0]["countries"], {"CN": 184, "US": 67})
        # Counts survive re-opening; the deduplication key is never stored in plain text.
        initialize(self.database)
        self.assertEqual(snapshot(self.database)["visits"], 495)
        with connect(self.database) as connection:
            token = connection.execute("SELECT token_hash FROM deduplication").fetchone()[0]
            self.assertNotEqual(token, "a" * 32)

    def test_unlocated_visit_counts_total_only(self):
        result = snapshot(self.database, None, "b" * 32)
        self.assertEqual(result["visits"], 495)
        self.assertEqual(result["countries"], {"CN": 183, "US": 67})
        self.assertIsNone(result["origin"])

    def test_import_preserves_total_merges_tw_and_never_overwrites_live_counts(self):
        database = str(Path(self.directory.name) / "import.sqlite3")
        legacy = {"visits": 494, "country-CN": 183, "country-TW": 9, "country-US": 67}
        with patch("import_abacus.read_counter", side_effect=lambda key: (key, legacy.get(key, 0))):
            with contextlib.redirect_stdout(io.StringIO()):
                import_counters(database)
        self.assertEqual(snapshot(database), {"visits": 494, "countries": {"CN": 192, "US": 67}, "origin": None})
        snapshot(database, "CN", "d" * 32)
        with patch("import_abacus.read_counter") as read:
            with self.assertRaisesRegex(ValueError, "Refusing to replace"):
                import_counters(database)
            read.assert_not_called()
        self.assertEqual(snapshot(database)["visits"], 495)

    def test_http_cors_privacy_validation_and_read_only_requests(self):
        server = make_server(self.database, port=0)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        url = "http://127.0.0.1:%d/visitor-stats" % server.server_port

        def request(method="GET", headers=None, suffix=""):
            req = urllib.request.Request(url + suffix, method=method, headers=headers or {})
            return urllib.request.urlopen(req, timeout=5)

        headers = {"Origin": "https://www.jiahaozhang.me", "CF-IPCountry": "TW", "X-Visit-Key": "c" * 32}
        try:
            with request("OPTIONS", headers) as response:
                self.assertEqual(response.status, 204)
                self.assertEqual(response.headers["Access-Control-Allow-Origin"], headers["Origin"])
                self.assertEqual(response.headers["Access-Control-Allow-Headers"], "X-Visit-Key")
            with request(headers=headers) as response:
                self.assertEqual(json.load(response)["visits"], 494)
                self.assertEqual(response.headers["Cache-Control"], "no-store")
            for _ in range(2):
                with request("POST", headers, "?locate=0") as response:
                    result = json.load(response)
                    self.assertEqual(result["visits"], 495)
                    self.assertEqual(result["countries"]["CN"], 183)
                    self.assertIsNone(result["origin"])
                    self.assertNotIn("Set-Cookie", response.headers)
            with self.assertRaises(urllib.error.HTTPError) as error:
                request("POST", {**headers, "Origin": "https://unrelated.example"})
            self.assertEqual(error.exception.code, 403)
            error.exception.close()
            with self.assertRaises(urllib.error.HTTPError) as error:
                request("POST", {**headers, "X-Visit-Key": "bad"})
            self.assertEqual(error.exception.code, 400)
            error.exception.close()
            with request(headers={"Origin": "https://unrelated.example"}) as response:
                self.assertNotIn("Access-Control-Allow-Origin", response.headers)
        finally:
            server.shutdown()
            thread.join()
            server.server_close()

    def test_cloudflare_chunked_empty_post_counts_once(self):
        server = make_server(self.database, port=0)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()

        def request(body):
            connection = http.client.HTTPConnection("127.0.0.1", server.server_port, timeout=5)
            try:
                connection.putrequest("POST", "/visitor-stats")
                connection.putheader("Origin", "https://www.jiahaozhang.me")
                connection.putheader("X-Visit-Key", "e" * 32)
                connection.putheader("CF-IPCountry", "TW")
                connection.putheader("Transfer-Encoding", "chunked")
                connection.endheaders(body)
                response = connection.getresponse()
                return response.status, json.load(response)
            finally:
                connection.close()

        try:
            status, _ = request(b"1\r\nx\r\n0\r\n\r\n")
            self.assertEqual(status, 400)
            self.assertEqual(snapshot(self.database)["visits"], 494)
            for _ in range(2):
                status, result = request(b"0\r\n\r\n")
                self.assertEqual(status, 200)
                self.assertEqual(result["visits"], 495)
                self.assertEqual(result["countries"]["CN"], 184)
                self.assertEqual(result["origin"], "TW")
        finally:
            server.shutdown()
            thread.join()
            server.server_close()


if __name__ == "__main__":
    unittest.main()
