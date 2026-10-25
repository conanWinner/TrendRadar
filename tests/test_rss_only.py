"""RSS collection must remain independent of the hotlist switch (no network)."""
from datetime import datetime
from types import SimpleNamespace
import unittest
from unittest.mock import Mock

from trendradar.__main__ import NewsAnalyzer


class RssOnlyTests(unittest.TestCase):
    def analyzer(self, hotlists=False, rss=True):
        analyzer = NewsAnalyzer.__new__(NewsAnalyzer)
        analyzer.ctx = SimpleNamespace(
            config={"ENABLE_CRAWLER": hotlists, "ENABLE_NOTIFICATION": False},
            rss_enabled=rss, get_time=lambda: datetime(2026, 10, 7), cleanup=Mock(),
        )
        analyzer.report_mode = "current"
        analyzer._has_notification_configured = Mock(return_value=False)
        analyzer._get_mode_strategy = Mock(return_value={"description": "test"})
        analyzer.data_fetcher = Mock()
        return analyzer

    def test_rss_runs_when_hotlists_are_disabled(self):
        analyzer = self.analyzer()
        analyzer._crawl_rss_data = Mock(return_value=([{"count": 1}], [], [], set()))
        analyzer._execute_mode_strategy = Mock()
        analyzer.run()
        analyzer.data_fetcher.crawl_websites.assert_not_called()
        analyzer._crawl_rss_data.assert_called_once()
        self.assertEqual(analyzer._execute_mode_strategy.call_args.args[1:4], ({}, {}, []))
        analyzer.ctx.cleanup.assert_called_once()

    def test_no_collection_when_both_sources_are_disabled(self):
        analyzer = self.analyzer(rss=False)
        analyzer._crawl_rss_data = Mock()
        analyzer._execute_mode_strategy = Mock()
        analyzer.run()
        analyzer._crawl_rss_data.assert_not_called()
        analyzer.data_fetcher.crawl_websites.assert_not_called()
        analyzer._execute_mode_strategy.assert_not_called()
        analyzer.ctx.cleanup.assert_called_once()

    def test_existing_hotlist_configuration_still_initializes(self):
        self.assertTrue(self.analyzer(hotlists=True, rss=False)._initialize_and_check_config())

    def test_rss_reports_do_not_require_or_include_hotlist_history(self):
        for mode in ("current", "daily", "incremental"):
            with self.subTest(mode=mode):
                analyzer = self.analyzer()
                analyzer.report_mode = mode
                schedule = SimpleNamespace(report_mode=mode, frequency_file="test.txt",
                    filter_method="keyword", interests_file="", collect=True)
                analyzer.ctx.create_scheduler = Mock(return_value=SimpleNamespace(resolve=lambda: schedule))
                analyzer.ctx.platform_ids = ["legacy-disabled-source"]
                analyzer.ctx.detect_new_titles = Mock()
                analyzer.ctx.format_time = Mock(return_value="10-00")
                analyzer.ctx.load_frequency_words = Mock(return_value=([], [], []))
                analyzer._get_mode_strategy = Mock(return_value={"should_send_notification": False})
                analyzer._load_analysis_data = Mock()
                analyzer._prepare_standalone_data = Mock(return_value=None)
                analyzer._prepare_current_title_info = Mock(return_value={})
                analyzer._run_analysis_pipeline = Mock(return_value=([], "report.html", None, [], None, []))
                analyzer._should_open_browser = Mock(return_value=False)
                analyzer.is_docker_container = False
                rss = [{"count": 1}]
                result = analyzer._execute_mode_strategy({}, {}, {}, [], rss_items=rss)
                self.assertEqual(result, "report.html")
                analyzer._load_analysis_data.assert_not_called()
                analyzer.ctx.detect_new_titles.assert_not_called()
                self.assertEqual(analyzer._run_analysis_pipeline.call_args.args[0], {})
                self.assertEqual(analyzer._run_analysis_pipeline.call_args.kwargs["rss_items"], rss)
