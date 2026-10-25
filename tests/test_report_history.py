"""Kiểm tra danh sách lịch sử báo cáo bằng tệp HTML giả."""
from datetime import datetime, timezone
import os
import json
import secrets
from pathlib import Path
import tempfile
import unittest
from types import SimpleNamespace

from local_app import App, ReportHistoryError, handler_for, move_report_without_overwrite


class ReportHistoryTests(unittest.TestCase):
    def setUp(self):
        # Giữ thư mục tạm lại; không tự xóa dữ liệu kiểm thử.
        self.root = Path(tempfile.mkdtemp(prefix="trendradar-report-history-"))
        self.app = App(self.root)

    def add_report(self, relative_path, timestamp):
        path = self.root / "output" / "html" / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("<!doctype html><title>fixture</title>", encoding="utf-8")
        os.utime(path, (timestamp, timestamp))
        return path

    def test_reports_include_utc_mtime_and_sort_newest_first(self):
        older_time = datetime(2026, 10, 5, 8, 15, tzinfo=timezone.utc)
        newer_time = datetime(2026, 10, 6, 18, 32, tzinfo=timezone.utc)
        # Cố ý để tên đường dẫn không cùng thứ tự với mtime.
        self.add_report("2026-10-06/09-00.html", older_time.timestamp())
        self.add_report("2026-10-05/20-00.html", newer_time.timestamp())

        reports = self.app.reports()

        self.assertEqual(
            [(report["name"], report["url"], report["timestamp_label"]) for report in reports],
            [
                (
                    "2026-10-05 · 20-00",
                    "/output/html/2026-10-05/20-00.html",
                    "Tạo/cập nhật lúc",
                ),
                (
                    "2026-10-06 · 09-00",
                    "/output/html/2026-10-06/09-00.html",
                    "Tạo/cập nhật lúc",
                ),
            ],
        )
        generated_at = [
            datetime.fromisoformat(report["generated_at"].replace("Z", "+00:00"))
            for report in reports
        ]
        self.assertEqual(
            generated_at,
            [newer_time, older_time],
        )
        self.assertTrue(all(value.utcoffset().total_seconds() == 0 for value in generated_at))

    def test_reports_is_empty_when_no_html_files_exist(self):
        self.assertEqual(self.app.reports(), [])

    def report_request(self, report=None):
        report = report or self.app.reports()[0]
        return {"id": report["id"], "revision": report["revision"], "confirmed": True, "request_id": secrets.token_hex(16)}

    def test_trash_and_restore_move_only_selected_html_and_preserve_bytes(self):
        selected = self.add_report("2026-10-06/09-00.html", 1000)
        other = self.add_report("2026-10-06/10-00.html", 900)
        protected = []
        for relative in ("output/html/latest/current.html", "output/index.html", "output/news/data.db", "output/rss/rss.db", "output/report_backups/old/report.html", "config/config.yaml"):
            path = self.root / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("keep fixture " + relative, encoding="utf-8")
            protected.append((path, path.read_bytes()))
        original = selected.read_bytes()
        data = self.report_request()
        result = self.app.trash_report(data)
        payload = self.root / "output" / "report_trash" / result["id"] / "report.html"
        self.assertFalse(selected.exists())
        self.assertEqual(payload.read_bytes(), original)
        self.assertEqual(other.read_bytes(), original)
        self.assertEqual(len(self.app.reports()), 1)
        item = self.app.report_trash()[0]
        self.app.restore_report({"id": item["id"], "revision": item["revision"], "confirmed": True})
        self.assertEqual(selected.read_bytes(), original)
        self.assertFalse(payload.exists())
        self.assertEqual(self.app.report_trash(), [])
        for path, content in protected:
            self.assertEqual(path.read_bytes(), content)

    def test_stale_confirmation_and_missing_confirmation_do_not_move(self):
        selected = self.add_report("2026-10-06/09-00.html", 1000)
        data = self.report_request()
        with selected.open("a") as stream:
            stream.write("added fixture revision")
        with self.assertRaises(ReportHistoryError):
            self.app.trash_report(data)
        self.assertTrue(selected.exists())
        data = self.report_request()
        data["confirmed"] = False
        with self.assertRaises(ReportHistoryError):
            self.app.trash_report(data)
        self.assertTrue(selected.exists())

    def test_restore_collision_keeps_both_reports(self):
        selected = self.add_report("2026-10-06/09-00.html", 1000)
        original = selected.read_bytes()
        self.app.trash_report(self.report_request())
        item = self.app.report_trash()[0]
        with selected.open("x") as stream:
            stream.write("new report fixture")
        with self.assertRaisesRegex(ReportHistoryError, "Không ghi đè"):
            self.app.restore_report({"id": item["id"], "revision": item["revision"], "confirmed": True})
        self.assertEqual(selected.read_text(), "new report fixture")
        payload = self.root / "output" / "report_trash" / item["id"] / "report.html"
        self.assertEqual(payload.read_bytes(), original)

    def test_retry_after_lost_response_is_idempotent(self):
        selected = self.add_report("2026-10-06/09-00.html", 1000)
        data = self.report_request()
        first = self.app.trash_report(data)
        second = self.app.trash_report(data)
        self.assertEqual(first["id"], second["id"])
        self.assertEqual(len(self.app.report_trash()), 1)
        item = self.app.report_trash()[0]
        restore = {"id": item["id"], "revision": item["revision"], "confirmed": True}
        self.app.restore_report(restore)
        self.app.restore_report(restore)
        with self.assertRaises(ReportHistoryError):
            self.app.trash_report(data)
        self.assertTrue(selected.exists())
        self.assertEqual(self.app.report_trash(), [])

    def test_running_blocks_trash_and_restore(self):
        selected = self.add_report("2026-10-06/09-00.html", 1000)
        data = self.report_request()
        self.app.status["running"] = True
        with self.assertRaises(ReportHistoryError):
            self.app.trash_report(data)
        self.assertTrue(selected.exists())
        self.app.status["running"] = False
        self.app.trash_report(data)
        item = self.app.report_trash()[0]
        self.app.status["running"] = True
        with self.assertRaises(ReportHistoryError):
            self.app.restore_report({"id": item["id"], "revision": item["revision"], "confirmed": True})
        self.assertEqual(len(self.app.report_trash()), 1)

    def test_current_and_latest_are_protected(self):
        current = self.add_report("2026-10-06/current.html", 1000)
        latest = self.add_report("latest/current.html", 2000)
        report = self.app.reports()[0]
        self.assertFalse(report["can_remove"])
        with self.assertRaises(ReportHistoryError):
            self.app.trash_report(self.report_request(report))
        self.assertTrue(current.exists())
        self.assertTrue(latest.exists())

    def test_identifiers_and_symlinks_cannot_escape_history(self):
        outside = self.root / "outside.html"
        outside.write_text("outside fixture")
        directory = self.root / "output" / "html" / "2026-10-06"
        directory.mkdir(parents=True)
        (directory / "linked.html").symlink_to(outside)
        self.assertEqual(self.app.reports(), [])
        with self.assertRaises(ReportHistoryError):
            self.app.trash_report({"id": "../../outside.html", "revision": "x", "request_id": secrets.token_hex(16), "confirmed": True})
        with self.assertRaises(ReportHistoryError):
            self.app.restore_report({"id": "../../outside.html", "revision": "x", "confirmed": True})
        self.assertEqual(outside.read_text(), "outside fixture")

    def test_restore_stale_revision_preserves_trash(self):
        self.add_report("2026-10-06/09-00.html", 1000)
        self.app.trash_report(self.report_request())
        item = self.app.report_trash()[0]
        payload = self.root / "output" / "report_trash" / item["id"] / "report.html"
        with payload.open("a") as stream:
            stream.write("changed fixture")
        with self.assertRaises(ReportHistoryError):
            self.app.restore_report({"id": item["id"], "revision": item["revision"], "confirmed": True})
        self.assertTrue(payload.exists())

    def test_atomic_move_never_overwrites_existing_target(self):
        source, target = self.root / "source.html", self.root / "target.html"
        source.write_text("source fixture")
        target.write_text("target fixture")
        with self.assertRaises(ReportHistoryError):
            move_report_without_overwrite(source, target)
        self.assertEqual(source.read_text(), "source fixture")
        self.assertEqual(target.read_text(), "target fixture")

    def test_corrupt_trash_entry_does_not_block_valid_entries_or_history(self):
        self.add_report("2026-10-06/09-00.html", 1000)
        trash = self.root / "output" / "report_trash"
        valid_id = secrets.token_hex(16)
        valid = trash / valid_id
        valid.mkdir(parents=True)
        payload = valid / "report.html"
        payload.write_text("valid preserved trash fixture")
        metadata = {"id": valid_id, "path": "output/html/2026-10-05/08-00.html", "name": "valid fixture", "generated_at": "2026-10-05T08:00:00+00:00", "removed_at": "2026-10-06T09:00:00+00:00", "revision": self.app.report_revision(payload)}
        (valid / "metadata.json").write_text(json.dumps(metadata))
        broken = trash / secrets.token_hex(16)
        broken.mkdir()
        (broken / "metadata.json").write_text("{")
        (broken / "report.html").write_text("broken metadata preserved report")
        linked = trash / secrets.token_hex(16)
        linked.mkdir()
        (linked / "metadata.json").write_text(json.dumps({**metadata, "id": linked.name}))
        (linked / "report.html").symlink_to(payload)
        before = {path: path.read_bytes() for path in trash.glob("*/*") if not path.is_symlink()}
        self.assertEqual([item["id"] for item in self.app.report_trash()], [valid_id])
        code, listed = self.static_response("/api/report-trash", {"X-App-Token": self.app.token})
        self.assertEqual(code, 200)
        self.assertEqual([item["id"] for item in listed], [valid_id])
        self.assertEqual(len(self.app.reports()), 1)
        for path, content in before.items():
            self.assertEqual(path.read_bytes(), content)

    def static_response(self, path, headers=None):
        # Dùng handler thật nhưng bỏ socket, kiểm tra thuần trong bộ nhớ.
        handler = object.__new__(handler_for(self.app))
        handler.path = path
        handler.headers = {"Host": "127.0.0.1:8766", **(headers or {})}
        handler.server = SimpleNamespace(server_port=8766)
        responses = []
        handler.send = lambda code, body, kind=None: responses.append((code, body))
        handler.do_GET()
        return responses[0]

    def test_static_routes_reject_traversal_and_symlinks_without_token(self):
        private = self.root / "config" / "config.yaml"
        private.parent.mkdir()
        private.write_text("fixture-secret-never-public")
        report = self.add_report("2026-10-06/09-00.html", 1000)
        (report.parent / "linked.html").symlink_to(private)
        (self.root / "local_ui").symlink_to(private.parent, target_is_directory=True)
        for path in (
            "/output/html/../../config/config.yaml",
            "/output/html/%2e%2e/%2e%2e/config/config.yaml",
            "/output/html/%2e%2e%2f%2e%2e%2fconfig%2fconfig.yaml",
            "/docs/assets/../../../config/config.yaml",
            "/local_ui/../config/config.yaml",
            "/output/html/2026-10-06/linked.html",
            "/local_ui/config.yaml",
            "/output/html/%00.html",
            "/output/html/..%5c..%5cconfig/config.yaml",
        ):
            with self.subTest(path=path):
                code, body = self.static_response(path)
                self.assertEqual(code, 404)
                self.assertNotIn("fixture-secret-never-public", str(body))
        self.assertEqual(private.read_text(), "fixture-secret-never-public")
        self.assertEqual(self.static_response("/output/html/2026-10-06/09-00.html"), (200, report.read_bytes()))

    def test_static_public_assets_remain_accessible(self):
        for relative in ("docs/index.html", "docs/assets/style.css", "local_ui/app.js"):
            path = self.root / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("public fixture " + relative)
            self.assertEqual(self.static_response("/" + relative), (200, path.read_bytes()))


if __name__ == "__main__":
    unittest.main()
