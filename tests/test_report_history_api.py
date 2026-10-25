"""API lịch sử dùng server cục bộ và tệp giả; giữ mọi thư mục kiểm thử."""
import http.client
from http.server import ThreadingHTTPServer
import json
from pathlib import Path
import secrets
import tempfile
import threading
import unittest

from local_app import App, handler_for


class ReportHistoryApiTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp(prefix="trendradar-history-api-"))
        path = self.root / "output" / "html" / "2026-10-07" / "09-00.html"
        path.parent.mkdir(parents=True)
        path.write_text("fixture history report")
        self.path = path
        self.app = App(self.root)
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), handler_for(self.app))
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.host = f"127.0.0.1:{self.server.server_port}"

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()

    def request(self, method, path, data=None, headers=None):
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=2)
        request_headers = {"Host": self.host, "X-App-Token": self.app.token, "Origin": "http://" + self.host, "Content-Type": "application/json"}
        if headers:
            request_headers.update(headers)
            request_headers = {key: value for key, value in request_headers.items() if value is not None}
        connection.request(method, path, json.dumps(data) if data is not None else None, request_headers)
        response = connection.getresponse()
        result = response.status, json.loads(response.read())
        connection.close()
        return result

    def test_tokens_host_and_origin_are_required_before_any_move(self):
        report = self.app.reports()[0]
        data = {"id": report["id"], "revision": report["revision"], "request_id": secrets.token_hex(16), "confirmed": True}
        for headers in ({"Host": "evil.invalid"}, {"X-App-Token": "wrong"}, {"Origin": "https://evil.invalid"}, {"Origin": None}):
            with self.subTest(headers=headers):
                code, _ = self.request("POST", "/api/reports/trash", data, headers)
                self.assertEqual(code, 403)
                self.assertTrue(self.path.exists())
        code, _ = self.request("GET", "/api/report-trash", headers={"X-App-Token": "wrong"})
        self.assertEqual(code, 403)

    def test_endpoints_preserve_array_contract_and_restore_fixture(self):
        code, reports = self.request("GET", "/api/reports")
        self.assertEqual(code, 200)
        self.assertIsInstance(reports, list)
        report = reports[0]
        data = {"id": report["id"], "revision": report["revision"], "request_id": secrets.token_hex(16), "confirmed": True}
        code, result = self.request("POST", "/api/reports/trash", data)
        self.assertEqual(code, 200)
        self.assertFalse(self.path.exists())
        code, trash = self.request("GET", "/api/report-trash")
        self.assertEqual(code, 200)
        self.assertEqual(trash[0]["id"], result["id"])
        code, _ = self.request("POST", "/api/reports/restore", {"id": trash[0]["id"], "revision": trash[0]["revision"], "confirmed": True})
        self.assertEqual(code, 200)
        self.assertEqual(self.path.read_text(), "fixture history report")

    def test_stale_and_running_return_specific_safe_conflict(self):
        report = self.app.reports()[0]
        data = {"id": report["id"], "revision": "stale", "request_id": secrets.token_hex(16), "confirmed": True}
        code, result = self.request("POST", "/api/reports/trash", data)
        self.assertEqual(code, 409)
        self.assertIn("Báo cáo đã đổi", result["error"])
        self.app.status["running"] = True
        data["revision"] = report["revision"]
        code, result = self.request("POST", "/api/reports/trash", data)
        self.assertEqual(code, 409)
        self.assertIn("Đang lấy tin", result["error"])
        self.assertTrue(self.path.exists())


if __name__ == "__main__":
    unittest.main()
