"""Cloud access checks without network, AI calls, or data deletion."""
from email.message import Message
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest

from local_app import App
from railway_app import cloud_handler, initialize_data


class RailwayAppTests(unittest.TestCase):
    def handler(self, path="/", method="GET", **headers):
        app = App(Path(tempfile.mkdtemp(prefix="trendradar-cloud-test-")))
        handler = object.__new__(cloud_handler(app, "test.up.railway.app"))
        handler.path, handler.command = path, method
        handler.server = SimpleNamespace(server_port=8080)
        handler.headers = Message()
        for key, value in headers.items():
            handler.headers[key] = value
        handler.responses = []
        handler.send = lambda status, *args: handler.responses.append(status)
        handler.send_response = lambda status: handler.responses.append(status)
        handler.send_header = lambda *args: None
        handler.end_headers = lambda: None
        return handler

    def test_page_api_and_post_accept_requests_without_login(self):
        for path, method in (("/", "GET"), ("/api/config", "GET"), ("/api/run", "POST"), ("/local_ui/app.js", "GET")):
            with self.subTest(path=path):
                handler = self.handler(path, method, Host="test.up.railway.app")
                self.assertTrue(handler.trusted())
                self.assertEqual(handler.responses, [])

    def test_health_probe_is_public_and_post_requires_expected_host(self):
        self.assertTrue(self.handler("/health").trusted())
        self.assertFalse(self.handler("/health", "POST", Host="attacker.example").trusted())

    def test_accepts_only_expected_host_and_origin(self):
        good = {"Host": "test.up.railway.app", "Origin": "https://test.up.railway.app"}
        handler = self.handler(**good)
        self.assertTrue(handler.trusted())
        self.assertEqual(handler.headers["Origin"], "http://127.0.0.1:8080")
        for field in ("Host", "Origin"):
            with self.subTest(field=field):
                bad = dict(good)
                bad[field] = "https://attacker.example"
                handler = self.handler(**bad)
                self.assertFalse(handler.trusted())
                self.assertEqual(handler.responses, [403])

    def test_old_credentials_are_not_required_or_checked(self):
        handler = self.handler(Host="test.up.railway.app", Authorization="Basic obsolete")
        self.assertTrue(handler.trusted())

    def test_reinitialization_preserves_saved_configuration_and_reports(self):
        root = Path(tempfile.mkdtemp(prefix="trendradar-cloud-persistence-"))
        initialize_data(root)
        config = root / "config" / "frequency_words.txt"
        config.write_text("saved cloud settings", encoding="utf-8")
        report = root / "output" / "old-report.html"
        report.write_text("saved report", encoding="utf-8")
        initialize_data(root)
        self.assertEqual(config.read_text(), "saved cloud settings")
        self.assertEqual(report.read_text(), "saved report")


if __name__ == "__main__":
    unittest.main()
