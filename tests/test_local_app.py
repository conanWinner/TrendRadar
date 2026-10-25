"""Kiểm tra ứng dụng cục bộ với tệp giả, không gọi AI hay gửi thông báo.

Thư mục tạm được giữ lại để tuân thủ quy tắc không xóa dữ liệu.
"""
import copy
import io
import json
from pathlib import Path
import tempfile
import threading
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from local_app import App, FILES, configure_local_run, handler_for, worker_python


class LocalAppTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp(prefix="trendradar-local-test-"))
        (self.root / "config").mkdir()
        self.contents = {"config": "# Giữ bình luận\napp:\n  timezone: Asia/Ho_Chi_Minh\nai:\n  api_key: test-only\n", "frequency": "football\n", "timeline": "presets: {}\n"}
        for key, name in FILES.items():
            (self.root / "config" / name).write_text(self.contents[key], encoding="utf-8")
        self.app = App(self.root)

    def test_save_preserves_previous_files(self):
        data = self.app.configuration()
        data["frequency"] = "basketball\n"
        self.app.save(data)
        self.assertEqual((self.root / "config" / FILES["frequency"]).read_text(), "basketball\n")
        backup = next((self.root / "output" / "config_backups").iterdir())
        for key, name in FILES.items():
            self.assertEqual((backup / name).read_text(), self.contents[key])
        self.assertEqual((self.root / "config" / FILES["config"]).read_text(), self.contents["config"])

    def test_configuration_waits_for_save_and_reads_one_consistent_snapshot(self):
        data = self.app.configuration()
        data["config"] = "app:\n  timezone: UTC\n"
        data["frequency"] = "basketball\n"
        data["timeline"] = "presets:\n  new:\n    name: New\n"
        config_written = threading.Event()
        release_writer = threading.Event()
        reader_started = threading.Event()
        reader_done = threading.Event()
        original_write_text = Path.write_text
        writer_errors = []
        reader_results = []

        def pause_after_config_write(path, text, *args, **kwargs):
            result = original_write_text(path, text, *args, **kwargs)
            if path == self.root / "config" / FILES["config"]:
                config_written.set()
                if not release_writer.wait(timeout=3):
                    raise TimeoutError("writer was not released")
            return result

        def save():
            try:
                self.app.save(data)
            except Exception as error:
                writer_errors.append(error)

        def read_configuration():
            reader_started.set()
            try:
                reader_results.append(self.app.configuration())
            finally:
                reader_done.set()

        writer = threading.Thread(target=save)
        reader = threading.Thread(target=read_configuration)
        with patch.object(Path, "write_text", pause_after_config_write):
            writer.start()
            try:
                self.assertTrue(config_written.wait(timeout=3), "writer did not reach the pause")
                reader.start()
                self.assertTrue(reader_started.wait(timeout=3), "reader did not start")
                self.assertFalse(reader_done.wait(timeout=0.1), "reader observed a partially saved configuration")
            finally:
                release_writer.set()
                writer.join(timeout=3)
                if reader.ident is not None:
                    reader.join(timeout=3)

        self.assertFalse(writer.is_alive(), "writer thread did not finish")
        self.assertFalse(reader.is_alive(), "reader thread did not finish")
        self.assertEqual(writer_errors, [])
        self.assertEqual(len(reader_results), 1)
        for key in FILES:
            self.assertEqual(reader_results[0][key], data[key])

    def test_failed_write_restores_all_files_and_keeps_backup(self):
        data = self.app.configuration()
        data["config"] = "app:\n  timezone: UTC\n"
        data["frequency"] = "basketball\n"
        data["timeline"] = "presets: {}\ncustom: {}\n"
        original_write_text = Path.write_text
        failed = False

        def fail_frequency_once(path, text, *args, **kwargs):
            nonlocal failed
            if path == self.root / "config" / FILES["frequency"] and not failed:
                failed = True
                original_write_text(path, text[:3], *args, **kwargs)
                raise OSError("simulated frequency write failure")
            return original_write_text(path, text, *args, **kwargs)

        with patch.object(Path, "write_text", fail_frequency_once):
            with self.assertRaisesRegex(ValueError, "Đã khôi phục"):
                self.app.save(data)

        self.assertTrue(failed)
        for key, name in FILES.items():
            self.assertEqual((self.root / "config" / name).read_text(encoding="utf-8"), self.contents[key])
        backup = next((self.root / "output" / "config_backups").iterdir())
        for key, name in FILES.items():
            self.assertEqual((backup / name).read_text(encoding="utf-8"), self.contents[key])

    def test_external_edit_is_not_overwritten(self):
        data = self.app.configuration()
        path = self.root / "config" / FILES["frequency"]
        path.write_text("external edit\n")
        with self.assertRaises(ValueError):
            self.app.save(data)
        self.assertEqual(path.read_text(), "external edit\n")

    def test_invalid_yaml_cannot_change_files(self):
        data = self.app.configuration()
        data["config"] = "app: [broken\n"
        with self.assertRaises(ValueError):
            self.app.save(data)
        self.assertEqual(self.app.configuration()["config"], self.contents["config"])

    def test_invalid_enabled_is_rejected(self):
        data = self.app.configuration()
        data["config"] = 'ai_analysis:\n  enabled: "false"\n'
        with self.assertRaises(ValueError):
            self.app.save(data)

    def test_server_rejects_invalid_rss_and_schedule_shapes(self):
        cases = [
            ("rss feeds must be a list", "rss:\n  feeds: {}\n"),
            ("feed enabled must be boolean", "rss:\n  feeds:\n    - enabled: \"true\"\n"),
            ("enabled schedule must name a timeline preset", "schedule:\n  enabled: true\n  preset: missing\n"),
        ]
        handler_type = handler_for(self.app)
        for label, config_text in cases:
            with self.subTest(label=label):
                data = self.app.configuration()
                data["config"] = config_text
                data["timeline"] = "presets:\n  available:\n    name: Available\n"
                body = json.dumps(data).encode("utf-8")
                response = {}
                handler = object.__new__(handler_type)
                handler.trusted = lambda: True
                handler.headers = SimpleNamespace(get=lambda name, default=None: {
                    "X-App-Token": self.app.token,
                    "Content-Length": str(len(body)),
                }.get(name, default))
                handler.rfile = io.BytesIO(body)
                handler.path = "/api/config"
                handler.send = lambda code, content, kind="application/json; charset=utf-8": response.update(code=code, content=content)
                handler.do_POST()
                self.assertEqual(response["code"], 400)
                for key, name in FILES.items():
                    self.assertEqual((self.root / "config" / name).read_text(encoding="utf-8"), self.contents[key])

    def test_running_blocks_save_and_duplicate_run(self):
        self.app.status["running"] = True
        with self.assertRaises(ValueError):
            self.app.save(self.app.configuration())
        with self.assertRaises(ValueError):
            self.app.start({})

    def test_stale_revision_blocks_run(self):
        with self.assertRaises(ValueError):
            self.app.start({"revision": "stale"})
        self.assertFalse(self.app.status["running"])

    def test_collection_status_and_old_report_preserved(self):
        path = self.root / "output" / "html" / "2026-10-06" / "18-32.html"
        path.parent.mkdir(parents=True)
        path.write_text("old report")
        class Process:
            stdout = io.StringIO("开始爬取数据\n[RSS] 请求失败\nHTML报告已生成: output/test.html\n")
            def wait(self): return 0
        with patch("local_app.subprocess.Popen", return_value=Process()) as spawn:
            self.app.collect({})
        self.assertTrue(self.app.status["success"])
        self.assertFalse(self.app.status["running"])
        self.assertEqual(len(self.app.status["warnings"]), 1)
        self.assertEqual(spawn.call_args.args[0][0], worker_python())
        env = spawn.call_args.kwargs["env"]
        self.assertEqual(env["TRENDRADAR_LOCAL_AI"], "0")
        self.assertEqual(env["TRENDRADAR_LOCAL_NOTIFY"], "0")
        backup = next((self.root / "output" / "report_backups").rglob("18-32.html"))
        self.assertEqual(backup.read_text(), "old report")

    def test_failed_worker_does_not_claim_success(self):
        class Process:
            stdout = io.StringIO("error\n")
            def wait(self): return 1
        with patch("local_app.subprocess.Popen", return_value=Process()):
            self.app.collect({})
        self.assertFalse(self.app.status["success"])

    def test_rss_only_report_marker_is_recognized(self):
        class Process:
            stdout = io.StringIO('[RSS] HTML 报告已生成: output/test.html\n')
            def wait(self): return 0
        with patch('local_app.subprocess.Popen', return_value=Process()):
            self.app.collect({})
        self.assertTrue(self.app.status['success'])

    def test_missing_dependency_is_reported_without_raw_logs(self):
        class Process:
            stdout = io.StringIO("private-value-should-not-leak\nModuleNotFoundError: No module named 'feedparser'\n")
            def wait(self): return 1
        with patch("local_app.subprocess.Popen", return_value=Process()):
            self.app.collect({})
        self.assertFalse(self.app.status['success'])
        self.assertIn('feedparser', self.app.status['phase'])
        self.assertNotIn('private-value', str(self.app.status))

    def test_runtime_requires_explicit_ai_and_notification_opt_in(self):
        config = {"AI_ANALYSIS": {"ENABLED": True}, "AI_TRANSLATION": {"ENABLED": True}, "FILTER": {"METHOD": "ai"}, "ENABLE_NOTIFICATION": True, "STORAGE": {"LOCAL": {"RETENTION_DAYS": 7}, "REMOTE": {"RETENTION_DAYS": 3}}}
        restricted = configure_local_run(copy.deepcopy(config))
        self.assertFalse(restricted["AI_ANALYSIS"]["ENABLED"])
        self.assertFalse(restricted["AI_TRANSLATION"]["ENABLED"])
        self.assertFalse(restricted["ENABLE_NOTIFICATION"])
        self.assertEqual(restricted["FILTER"]["METHOD"], "keyword")
        self.assertEqual(restricted["STORAGE"]["LOCAL"]["RETENTION_DAYS"], 0)
        self.assertEqual(restricted["STORAGE"]["REMOTE"]["RETENTION_DAYS"], 0)
        allowed = configure_local_run(copy.deepcopy(config), True, True)
        self.assertTrue(allowed["AI_ANALYSIS"]["ENABLED"])
        self.assertTrue(allowed["ENABLE_NOTIFICATION"])


if __name__ == "__main__":
    unittest.main()
