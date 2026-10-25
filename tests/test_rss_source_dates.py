"""Tuoi Tre's localized RSS date fallback stays scoped to its feed host."""
import unittest

from trendradar.crawler.rss.parser import RSSParser


FEED_URL = "https://tuoitre.vn/home.rss"


def rss_with_date(date_value):
    return f'''<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0"><channel>
      <title>TUOI TRE ONLINE - RSS Feed</title>
      <link>https://tuoitre.vn/home.htm</link>
      <item>
        <title>TP.HCM cập nhật tin tức trong ngày</title>
        <link>https://tuoitre.vn/tin-tuc-202610071234.htm</link>
        <guid>https://tuoitre.vn/tin-tuc-202610071234.htm</guid>
        <pubDate>{date_value}</pubDate>
        <description><![CDATA[<p>Tin tức trong ngày.</p>]]></description>
      </item>
    </channel></rss>'''


class RSSSourceDateTests(unittest.TestCase):
    def setUp(self):
        self.parser = RSSParser()

    def test_tuoitre_ampm_date_parses_with_either_narrow_nbsp_form(self):
        date_values = (
            r"10/7/2026 8:15:00\u202fPM",
            "10/7/2026 8:15:00\u202fPM",
        )

        for date_value in date_values:
            with self.subTest(date_value=repr(date_value)):
                items = self.parser.parse(rss_with_date(date_value), FEED_URL)

                self.assertEqual(len(items), 1)
                self.assertEqual(
                    items[0].published_at,
                    "2026-10-07T20:15:00+07:00",
                )

    def test_malformed_tuoitre_date_remains_missing(self):
        items = self.parser.parse(rss_with_date("not a date"), FEED_URL)

        self.assertEqual(len(items), 1)
        self.assertIsNone(items[0].published_at)

    def test_www_tuoitre_host_uses_the_same_fallback(self):
        items = self.parser.parse(
            rss_with_date("10/7/2026 8:15:00\u202fPM"),
            "https://www.tuoitre.vn/home.rss",
        )

        self.assertEqual(len(items), 1)
        self.assertEqual(items[0].published_at, "2026-10-07T20:15:00+07:00")

    def test_tuoitre_format_is_not_guessed_for_other_hosts(self):
        items = self.parser.parse(
            rss_with_date("10/7/2026 8:15:00\u202fPM"),
            "https://example.com/feed.xml",
        )

        self.assertEqual(len(items), 1)
        self.assertIsNone(items[0].published_at)

    def test_rfc_and_iso_dates_keep_existing_parsing(self):
        rfc_date = self.parser._parse_date(
            {"published": "Tue, 06 Oct 2026 13:15:00 +0000"},
            "https://example.com/feed.xml",
        )
        iso_date = self.parser._parse_date(
            {"published": "2026-10-07T20:15:00+07:00"},
            FEED_URL,
        )

        self.assertEqual(rfc_date, "2026-10-06T13:15:00+00:00")
        self.assertEqual(iso_date, "2026-10-07T20:15:00+07:00")


if __name__ == "__main__":
    unittest.main()
