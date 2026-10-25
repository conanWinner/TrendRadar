import json
import stat
import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path
from local_app import App, FILES, ConfigurationValidationError

class VersionTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp(prefix='trendradar-version-tests-'))
        (self.root / 'config').mkdir()
        for key, value in {'config': 'ai: {api_key: fake-secret}\nrss: {enabled: true, feeds: []}\n', 'frequency': '[旧版本]\n中国\n', 'timeline': 'presets: {}\ncustom: {}\n'}.items():
            (self.root / 'config' / FILES[key]).write_text(value)
        self.app = App(self.root)

    def test_named_snapshot_does_not_apply_and_old_version_stays_exact(self):
        old = self.app.configuration()
        first = self.app.create_version(old, 'Cấu hình cũ')
        new = {**old, 'frequency': '[Football]\nV-League\n'}
        second = self.app.create_version(new, 'Việt Anh')
        self.assertEqual(self.app.configuration(), old)
        self.assertEqual(self.app.version(first['id'])['frequency'], old['frequency'])
        self.app.save({**new, 'version_name': 'Việt Anh'})
        self.assertEqual(self.app.configuration()['frequency'], new['frequency'])
        self.assertEqual(self.app.version(first['id'])['frequency'], old['frequency'])
        self.assertEqual(len(self.app.versions()), 2)
        self.assertNotIn('fake-secret', json.dumps(self.app.versions()))
        path = self.root / 'output' / 'config_versions' / (second['id'] + '.json')
        self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)

    def test_same_contents_can_have_two_named_versions_and_partial_write_is_not_published(self):
        old = self.app.configuration()
        first = self.app.create_version(old, 'A')
        directory = self.root / 'output' / 'config_versions'
        directory.chmod(0o755)
        self.app.create_version(old, 'reuse', reuse=True)
        self.assertEqual(stat.S_IMODE(directory.stat().st_mode), 0o700)
        second = self.app.create_version(old, 'B')
        self.assertNotEqual(first['id'], second['id'])
        def fail(record, stream, **kwargs):
            stream.write('{')
            raise OSError('disk error')
        with patch('local_app.json.dump', side_effect=fail), self.assertRaises(OSError):
            self.app.create_version(old, 'Failed')
        self.assertEqual(len(self.app.versions()), 2)
        self.assertEqual(self.app.configuration(), old)

    def test_valid_version_can_restore_broken_current_config(self):
        old = self.app.configuration()
        self.app.create_version(old, 'Good')
        (self.root / 'config' / FILES['config']).write_text('rss: [broken')
        bad = self.app.configuration()
        self.app.save({**old, 'revision': bad['revision']})
        self.assertEqual(self.app.configuration()['config'], old['config'])
        directory = self.root / 'output' / 'config_versions'
        self.assertEqual(stat.S_IMODE(directory.stat().st_mode), 0o700)

    def test_invalid_path_and_invalid_draft_cannot_change_active_config(self):
        old = self.app.configuration()
        for identifier in ['../config/config.yaml', '', 'missing']:
            with self.assertRaises(ConfigurationValidationError): self.app.version(identifier)
        with self.assertRaises(ValueError): self.app.create_version({**old, 'config': 'a: [bad'}, 'Broken')
        self.assertEqual(self.app.configuration(), old)

if __name__ == '__main__': unittest.main()
