"""Kiểm tra thư viện nguồn và thao tác UI bằng dữ liệu cục bộ, không gọi mạng.

Tệp kiểm chứng mạng thực tế nằm trong metadata của catalog. Các fixture test
được giữ tại /tmp, không tự xóa và không ghi config đang dùng.
"""
from collections import Counter
from datetime import datetime
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from urllib.parse import urlparse

import yaml

from local_app import preview_setting
from trendradar.core.loader import _load_rss_config
from trendradar.crawler.rss.fetcher import RSSFetcher


ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "local_ui" / "source-catalog.json"


class SourceCatalogTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
        cls.publishers = cls.catalog["publishers"]
        cls.fixtures = Path(tempfile.mkdtemp(prefix="trendradar-source-catalog-test-"))
        (cls.fixtures / "catalog.json").write_text(json.dumps(cls.catalog, ensure_ascii=False), encoding="utf-8")

    def test_fifty_distinct_publishers_ten_per_country(self):
        self.assertEqual(len(self.publishers), 50)
        self.assertEqual(Counter(p["country"] for p in self.publishers), Counter({"VN": 10, "US": 10, "GB": 10, "JP": 10, "KR": 10}))
        ids = [p["id"] for p in self.publishers]
        self.assertEqual(len(set(ids)), 50)
        self.assertEqual(len({p["name"] for p in self.publishers}), 50)

    def test_all_metadata_and_official_evidence_present(self):
        required = {"id", "name", "country", "country_name", "homepage", "categories", "feeds", "status", "checked_at", "final_url", "content_type", "item_count", "newest_publish", "check_note", "evidence"}
        categories = {c["id"] for c in self.catalog["categories"]}
        self.assertTrue(categories)
        self.assertEqual(len(categories), len(self.catalog["categories"]))
        for publisher in self.publishers:
            with self.subTest(publisher=publisher["id"]):
                self.assertTrue(required.issubset(publisher))
                self.assertTrue(publisher["check_note"])
                self.assertIn(publisher["status"], {"verified", "rss_unavailable"})
                self.assertTrue(set(publisher["categories"]).issubset(categories))
                for field in ("homepage", "evidence"):
                    parsed = urlparse(publisher[field])
                    self.assertIn(parsed.scheme, {"http", "https"})
                    self.assertTrue(parsed.hostname)
                self.assertNotIn("news.google.com", publisher["evidence"])
                self.assertTrue(datetime.fromisoformat(publisher["checked_at"]).tzinfo)
                self.assertIsInstance(publisher["item_count"], int)
                self.assertGreaterEqual(publisher["item_count"], 0)

    def test_verified_feeds_have_xml_items_dates_and_publisher_links(self):
        self.assertLessEqual(self.catalog["verification_policy"]["max_age_days"], 7)
        for publisher in self.publishers:
            for feed in publisher["feeds"]:
                with self.subTest(publisher=publisher["id"], feed=feed["id"]):
                    self.assertEqual(feed["status"], "verified")
                    for field in ("url", "final_url", "evidence"):
                        parsed = urlparse(feed[field])
                        self.assertIn(parsed.scheme, {"http", "https"})
                        self.assertTrue(parsed.hostname)
                    self.assertTrue(feed["xml_valid"])
                    self.assertEqual(feed["http_status"], 200)
                    self.assertGreater(feed["item_count"], 0)
                    self.assertTrue(feed["content_type"])
                    self.assertTrue(feed["final_url"])
                    self.assertTrue(feed["samples"])
                    self.assertTrue(feed["link_domains"])
                    self.assertTrue(feed["category_check_note"])
                    published = datetime.fromisoformat(feed["newest_publish"])
                    checked = datetime.fromisoformat(feed["checked_at"])
                    self.assertIsNotNone(published.tzinfo)
                    self.assertIsNotNone(checked.tzinfo)
                    age = (checked - published).total_seconds() / 86400
                    self.assertLessEqual(age, self.catalog["verification_policy"]["max_age_days"])
                    self.assertGreaterEqual(age, -self.catalog["verification_policy"]["future_tolerance_days"])
                    self.assertAlmostEqual(feed["age_days"], age, delta=0.1)
                    for item in feed["samples"]:
                        self.assertTrue(item["title"])
                        parsed = urlparse(item["link"])
                        self.assertIn(parsed.scheme, {"http", "https"})
                        self.assertTrue(parsed.hostname)
                        self.assertIn(parsed.hostname, feed["link_domains"])
                    self.assertNotIn("news.google.com", feed["url"])

    def test_unavailable_publishers_cannot_offer_unchecked_feeds(self):
        for publisher in self.publishers:
            if publisher["status"] == "rss_unavailable":
                self.assertEqual(publisher["feeds"], [])
                self.assertTrue(publisher["check_note"])
                for check in publisher.get("feed_checks", []):
                    self.assertEqual(check["status"], "rss_unavailable")
                    self.assertTrue(check.get("check_note"))
            else:
                self.assertEqual(publisher["status"], "verified")
                self.assertGreater(len(publisher["feeds"]), 0)

    def test_feed_ids_urls_and_categories_consistent(self):
        feeds = [feed for publisher in self.publishers for feed in publisher["feeds"]]
        self.assertEqual(len({f["id"] for f in feeds}), len(feeds))
        self.assertEqual(len({f["url"] for f in feeds}), len(feeds))
        known_categories = {category["id"] for category in self.catalog["categories"]}
        self.assertTrue(feeds)
        for publisher in self.publishers:
            for feed in publisher["feeds"]:
                self.assertIn(feed["category"], known_categories)
                self.assertIn(feed["category"], publisher["categories"])

    def test_unavailable_sources_include_reason_and_no_enabled_feed(self):
        unavailable = [p for p in self.publishers if p["status"] == "rss_unavailable"]
        self.assertTrue(unavailable)
        for publisher in unavailable:
            self.assertEqual(publisher["feeds"], [])
            self.assertTrue(publisher["check_note"].strip())

    def test_rss_loader_and_fetcher_ignore_catalog_only_metadata(self):
        publisher = next(p for p in self.publishers if p["feeds"])
        catalog_feed = publisher["feeds"][0]
        config_feed = {
            "id": catalog_feed["id"],
            "name": publisher["name"] + " — " + catalog_feed["category_name"],
            "url": catalog_feed["url"],
            "enabled": True,
            "publisher_id": publisher["id"],
            "country": publisher["country"],
            "country_name": publisher["country_name"],
            "category": catalog_feed["category"],
        }
        loaded = _load_rss_config({"rss": {"enabled": False, "feeds": [config_feed]}})
        self.assertFalse(loaded["ENABLED"])
        self.assertEqual(loaded["FEEDS"], [config_feed])

        fetcher = RSSFetcher.from_config({"feeds": loaded["FEEDS"]})
        self.assertEqual(len(fetcher.feeds), 1)
        feed = fetcher.feeds[0]
        self.assertEqual((feed.id, feed.name, feed.url, feed.enabled), (config_feed["id"], config_feed["name"], config_feed["url"], True))
        for field in ("publisher_id", "country", "country_name", "category"):
            self.assertFalse(hasattr(feed, field))

        config_feed["enabled"] = False
        disabled = RSSFetcher.from_config({"feeds": _load_rss_config({"rss": {"feeds": [config_feed]}})["FEEDS"]})
        self.assertEqual(disabled.feeds, [])

    def test_preview_appends_catalog_feed_without_rewriting_or_enabling_rss(self):
        publisher = next(p for p in self.publishers if p["feeds"])
        feed = publisher["feeds"][0]
        raw = (
            "# keep this comment\n"
            "rss:\n"
            "  enabled: false # stay off\n"
            "  feeds: [] # preserve list comment\n"
            "unknown_feature:\n"
            "  keep: yes\n"
        )
        result = preview_setting({
            "text": raw,
            "path": ["rss", "feeds"],
            "operation": "append",
            "value": {
                "id": feed["id"],
                "name": publisher["name"] + " — " + feed["category_name"],
                "url": feed["url"],
                "enabled": True,
                "publisher_id": publisher["id"],
                "country": publisher["country"],
                "country_name": publisher["country_name"],
                "category": feed["category"],
            },
        })["text"]
        parsed = yaml.safe_load(result)
        self.assertFalse(parsed["rss"]["enabled"])
        self.assertEqual(parsed["unknown_feature"], {"keep": True})
        self.assertEqual(parsed["rss"]["feeds"][0]["publisher_id"], publisher["id"])
        self.assertIn("# keep this comment", result)
        self.assertIn("enabled: false # stay off", result)
        self.assertIn("# preserve list comment", result)
        self.assertTrue(result.endswith("unknown_feature:\n  keep: yes\n"))

    def test_country_metadata_does_not_claim_event_scope(self):
        self.assertIn("không xác định", self.catalog["selection_note"])
        for publisher in self.publishers:
            self.assertNotIn("event_scope", publisher)
            for feed in publisher["feeds"]:
                self.assertNotIn("event_scope", feed)

    def test_component_filters_adds_only_draft_and_disables_duplicates(self):
        script = r'''
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
class Node {
  constructor(tag) { this.tag = tag; this.children = []; this.dataset = {}; this.textContent = ''; this.value = ''; this.disabled = false; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(key, value) { this[key] = value; }
}
const all = node => [node, ...node.children.flatMap(all)];
const find = (node, pred) => all(node).find(pred);
const data = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
let fetchCount = 0;
const context = vm.createContext({window: {}, document: {createElement: tag => new Node(tag)}, URL, structuredClone,
  fetch: async url => { assert.equal(url, '/local_ui/source-catalog.json'); fetchCount++; return {ok: true, json: async () => data}; }});
for (const file of ['local_ui/vendor/js-yaml-4.1.0.min.js', 'local_ui/source-catalog.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), context, {filename: file});
const api = context.window.SourceCatalog;
const raw = '# giữ bình luận\nrss:\n  enabled: false\n  feeds: []\nunknown_feature:\n  keep: yes\n';
const card = (box, id) => find(box, n => n.dataset.publisher === id);
const add = (box, id) => find(box, n => n.dataset.catalogAdd === id);
(async () => {
  await Promise.all([api.load(), api.load()]); assert.equal(fetchCount, 1);
  const box = new Node('div'); let calls = [];
  const callback = async (...args) => { calls.push(args); return true; };
  api.render(box, raw, callback, false);
  assert.equal(all(box).filter(n => n.dataset.publisher).length, 50);
  assert.ok(all(box).some(n => n.textContent.includes('Nhóm nguồn báo đang tắt')));
  const country = find(box, n => n.dataset.catalogFilter === 'country'); country.value = 'US'; country.onchange();
  const category = find(box, n => n.dataset.catalogFilter === 'category'); category.value = 'football'; category.onchange();
  const search = find(box, n => n.dataset.catalogFilter === 'query'); search.value = 'espn'; search.oninput();
  assert.equal(all(box).filter(n => n.dataset.publisher).length, 1);
  assert.ok(card(box, 'espn'));
  const feed = data.publishers.find(p => p.id === 'espn').feeds.find(f => f.category === 'football');
  await add(box, feed.id).onclick();
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'config'); assert.equal(JSON.stringify(calls[0][1]), '["rss","feeds"]'); assert.equal(calls[0][3], 'append');
  const source = calls[0][2]; assert.equal(source.enabled, true); assert.equal(source.country, 'US'); assert.equal(source.category, 'football'); assert.equal(source.publisher_id, 'espn');
  assert.equal(source.url, feed.url); assert.ok(!('event_scope' in source));
  assert.ok(add(box, feed.id).disabled); assert.ok(all(box).some(n => n.textContent.includes('chưa lưu')));
  assert.ok(all(box).some(n => n.textContent.includes('Bật “Lấy tin')));
  assert.equal(raw, '# giữ bình luận\nrss:\n  enabled: false\n  feeds: []\nunknown_feature:\n  keep: yes\n');
  const duplicate = new Node('div'); api.render(duplicate, 'rss:\n  enabled: true\n  feeds:\n    - id: other-id\n      enabled: false\n      url: ' + JSON.stringify(feed.url) + '\n', callback, false);
  assert.equal(add(duplicate, feed.id).textContent, 'Theo dõi lại'); assert.ok(!add(duplicate, feed.id).disabled);
  const conflict = new Node('div'); api.render(conflict, 'rss:\n  enabled: true\n  feeds:\n    - id: ' + feed.id + '\n      url: https://example.invalid/unrelated\n', callback, false);
  await add(conflict, feed.id).onclick(); assert.notEqual(calls.at(-1)[2].id, feed.id);
  const denied = new Node('div'); api.render(denied, raw, async () => false, false);
  await add(denied, feed.id).onclick(); assert.ok(!add(denied, feed.id).disabled); assert.ok(all(denied).some(n => n.textContent.includes('Chưa thêm nguồn')));
  const locked = new Node('div'); api.render(locked, raw, callback, true); const previous = calls.length;
  assert.ok(all(locked).filter(n => n.dataset.catalogAdd).every(n => n.disabled)); await add(locked, feed.id).onclick(); assert.equal(calls.length, previous);
  const unavailable = data.publishers.find(p => p.status === 'rss_unavailable'); const unsupportedCard = card(locked, unavailable.id);
  assert.ok(find(unsupportedCard, n => n.tag === 'a' && n.href)); assert.ok(find(unsupportedCard, n => n.tag === 'button').disabled);
  const invalid = new Node('div'); api.render(invalid, 'rss: [broken', callback, false); assert.ok(!all(invalid).some(n => n.dataset.catalogAdd));
  console.log('UI catalog offline checks passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
'''
        result = subprocess.run(["node", "-", str(self.fixtures / "catalog.json")], input=script, text=True, cwd=ROOT, capture_output=True, timeout=20)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("UI catalog offline checks passed", result.stdout)


if __name__ == "__main__":
    unittest.main()
