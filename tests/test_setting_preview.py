"""Chỉnh bản nháp trực quan, giữ nguyên các trường và chú thích chưa sửa."""
import unittest
import yaml
from local_app import preview_setting, validate_schedule_choices, ConfigurationValidationError


class SettingPreviewTests(unittest.TestCase):
    def edit(self, text, path, value, operation="set"):
        return preview_setting({"text": text, "path": path, "value": value, "operation": operation})["text"]

    def test_deep_scalar_preserves_comments_and_unknown_fields(self):
        text = 'rss:\n  feeds:\n    - id: a\n      name: "A # tên" # giữ\n      unknown: {x: [1, 2]}\nother: true\n'
        result = self.edit(text, ["rss", "feeds", 0, "name"], "B # tên")
        self.assertEqual(result, text.replace('"A # tên"', '"B # tên"'))

    def test_add_optional_field_and_feed_preserve_existing_bytes(self):
        text = 'rss:\n  feeds:\n    - id: a\n      name: A # giữ\nother: true\n'
        enabled = self.edit(text, ["rss", "feeds", 0, "enabled"], False)
        self.assertIn('name: A # giữ\n', enabled)
        self.assertFalse(yaml.safe_load(enabled)["rss"]["feeds"][0]["enabled"])
        added = self.edit(text, ["rss", "feeds"], {"id": "b", "url": "https://example.invalid/feed"}, "append")
        self.assertIn('    - id: a\n      name: A # giữ\n', added)
        self.assertEqual(len(yaml.safe_load(added)["rss"]["feeds"]), 2)

    def test_flow_sequence_and_numeric_week_day(self):
        self.assertEqual(self.edit('a: [one, two] # giữ\n', ['a'], 'three', 'append'), 'a: [one, two, "three"] # giữ\n')
        text = 'custom:\n  week_map:\n    1: workday # thứ hai\n'
        self.assertEqual(self.edit(text, ['custom', 'week_map', 1], 'weekend'), text.replace('workday', '"weekend"'))

    def test_multiline_string_does_not_damage_next_field(self):
        text = 'a:\n  note: |\n    line one\n    line two\n  keep: true\n'
        result = self.edit(text, ['a', 'note'], 'new text')
        self.assertEqual(yaml.safe_load(result), {'a': {'note': 'new text', 'keep': True}})

    def test_multiline_header_comment_is_preserved(self):
        result = self.edit('note: | # keep header\n  old text\nnext: true\n', ['note'], 'new')
        self.assertIn('# keep header', result)
        self.assertEqual(yaml.safe_load(result), {'note': 'new', 'next': True})

    def test_schedule_overnight_overlap_and_adjacent_periods(self):
        plan = {'periods': {'night': {'start': '23:00', 'end': '02:00'}, 'morning': {'start': '02:00', 'end': '03:00'}}, 'day_plans': {'day': {'periods': ['night', 'morning']}}}
        validate_schedule_choices({'custom': plan})
        plan['periods']['morning']['start'] = '01:59'
        with self.assertRaises(ConfigurationValidationError):
            validate_schedule_choices({'custom': plan})
        plan['overlap'] = {'policy': 'last_wins'}
        validate_schedule_choices({'custom': plan})

    def test_delete_source_block_flow_and_last_item(self):
        for text in ['rss:\n  feeds:\n  - id: a\n  - id: b\nother: true\n', '# header\nrss:\n  feeds:\n    - id: a\n      name: A\n    - id: b # keep b\n      name: B\nother: true\n', 'rss: {feeds: [{id: a}, {id: b}]} # keep\n', 'rss:\n  feeds: [{id: a}, {id: b}]\n']:
            for index in (0, 1):
                result = self.edit(text, ['rss', 'feeds', index], None, 'delete')
                self.assertEqual(yaml.safe_load(result)['rss']['feeds'][0]['id'], 'b' if index == 0 else 'a')
                result = self.edit(result, ['rss', 'feeds', 0], None, 'delete')
                self.assertEqual(yaml.safe_load(result)['rss']['feeds'], [])
                self.assertIn('#', result) if '#' in text else None

    def test_delete_schedule_references_are_blocked_until_unlinked(self):
        text = 'custom:\n  periods:\n    a: {start: "08:00", end: "09:00"}\n  day_plans:\n    d: {periods: [a]}\n  week_map: {1: d}\n'
        for path in [['custom', 'periods', 'a'], ['custom', 'day_plans', 'd']]:
            with self.assertRaises(ConfigurationValidationError):
                self.edit(text, path, None, 'delete')
        result = self.edit(text, ['custom', 'day_plans', 'd', 'periods', 0], None, 'delete')
        result = self.edit(result, ['custom', 'periods', 'a'], None, 'delete')
        self.assertEqual(yaml.safe_load(result)['custom']['periods'], {})
        with self.assertRaises(ConfigurationValidationError):
            self.edit('ai: {api_key: secret}\n', ['ai', 'api_key'], None, 'delete')

    def test_delete_rejects_shared_ancestor_alias_and_preserves_flow_comment(self):
        text = 'rss: &shared {feeds: [{id: a}, {id: b}]}\ncopy: *shared\n'
        with self.assertRaises(ConfigurationValidationError):
            self.edit(text, ['rss', 'feeds', 0], None, 'delete')
        header = 'rss:\n  feeds: [ # keep list\n    {id: a}\n  ]\nother: true\n'
        self.assertIn('# keep list', self.edit(header, ['rss', 'feeds', 0], None, 'delete'))
        text = 'rss:\n  feeds: [{id: a}, # keep next\n    {id: b}]\n'
        result = self.edit(text, ['rss', 'feeds', 0], None, 'delete')
        self.assertIn('# keep next', result)
        self.assertEqual(yaml.safe_load(result)['rss']['feeds'], [{'id': 'b'}])

    def test_invalid_edit_is_rejected_without_writing_files(self):
        for data in [
            {'text': 'rss: [broken', 'path': ['rss'], 'value': True},
            {'text': 'a: {}\n', 'path': ['missing', 'x'], 'value': True},
            {'text': 'storage:\n  local:\n    retention_days: 0\n', 'path': ['storage', 'local', 'retention_days'], 'value': 5},
        ]:
            with self.subTest(path=data['path']), self.assertRaises(ValueError):
                preview_setting(data)

    def test_shared_targets_and_ancestors_are_rejected_for_every_edit_operation(self):
        cases = [
            # Chính danh sách thêm nguồn dùng chung với phần không biết của cấu hình.
            ('rss:\n  feeds: &shared [] # keep anchor\nunknown_feature:\n  original: *shared\n', ['rss', 'feeds'], {'id': 'new', 'url': 'https://example.invalid/rss'}, 'append'),
            # Chỉnh qua alias cũng không được lan sang nơi khai báo anchor.
            ('original: &shared []\nrss:\n  feeds: *shared\n', ['rss', 'feeds'], {'id': 'new'}, 'append'),
            # Tổ tiên dùng chung dù danh sách đích không tự có anchor.
            ('rss: &shared {feeds: []}\nunknown_feature: *shared\n', ['rss', 'feeds'], {'id': 'new'}, 'append'),
            ('rss: &shared {enabled: true}\nunknown_feature: *shared\n', ['rss', 'new_option'], False, 'add'),
            ('rss: &shared {enabled: true}\nunknown_feature: *shared\n', ['rss', 'enabled'], False, 'set'),
            ('rss:\n  enabled: &flag true # keep flag\nunknown_feature: *flag\n', ['rss', 'enabled'], False, 'set'),
            ('rss:\n  feeds: &shared [{id: a}]\nunknown_feature: *shared\n', ['rss', 'feeds', 0], None, 'delete'),
        ]
        for text, path, value, operation in cases:
            with self.subTest(path=path, operation=operation):
                raw_before = text.encode('utf-8')
                parsed_before = yaml.safe_load(text)
                data = {'text': text, 'path': path, 'value': value, 'operation': operation}
                with self.assertRaisesRegex(ConfigurationValidationError, 'tách cấu hình dùng chung trước'):
                    preview_setting(data)
                self.assertEqual(data['text'].encode('utf-8'), raw_before)
                self.assertEqual(yaml.safe_load(data['text']), parsed_before)

    def test_unrelated_alias_and_unused_anchor_do_not_block_safe_edits(self):
        for text in [
            'rss:\n  feeds: []\nunknown_feature: &shared [original]\ncopy: *shared\n',
            'rss:\n  feeds: &unused [] # unused anchor\nunknown_feature: true\n',
        ]:
            result = self.edit(text, ['rss', 'feeds'], {'id': 'new'}, 'append')
            self.assertEqual(yaml.safe_load(result)['rss']['feeds'], [{'id': 'new'}])
            self.assertEqual(yaml.safe_load(result)['unknown_feature'], yaml.safe_load(text)['unknown_feature'])
            self.assertIn('unknown_feature:', result)
            if '# unused anchor' in text:
                self.assertIn('# unused anchor', result)


if __name__ == '__main__':
    unittest.main()
