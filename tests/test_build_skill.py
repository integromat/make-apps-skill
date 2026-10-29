"""Offline packaging tests. These do not validate Make or provider runtime behavior."""
import os
from pathlib import Path
import stat
import subprocess
import sys
import tempfile
import unittest
import zipfile


REPO = Path(__file__).resolve().parents[1]
BUILDER = REPO / 'scripts' / 'build-skill.py'


class BuildSkillTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='make-skill-package-')
        self.addCleanup(self.temp.cleanup)
        self.root = (Path(self.temp.name) / 'checkout with spaces').resolve()
        self.skill = self.root / 'skills' / 'make-custom-apps'
        self.skill.mkdir(parents=True)
        self.source = {
            'SKILL.md': b'---\nname: make-custom-apps\n---\n# Test fixture\n',
            'references/guide.md': b'# Reference\r\nExact bytes.\r\n',
            'examples/helper.js': b'function helper() { return false; }\n',
        }
        for name, data in self.source.items():
            self.put(name, data)
        (self.root / 'LICENSE').write_bytes((REPO / 'LICENSE').read_bytes())
        (self.root / 'README.md').write_text('Repository-only document.\n')
        self.output = self.root / 'dist' / 'make-custom-apps.zip'

    def put(self, name, data=b'fixture\n'):
        path = self.skill / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return path

    def run_builder(self, *args):
        return subprocess.run(
            [sys.executable, str(BUILDER), '--root', str(self.root), *map(str, args)],
            cwd=self.temp.name, capture_output=True, text=True, timeout=30,
        )

    def assert_success(self, result):
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_packages_exact_canonical_bytes_and_mit_attribution_from_another_cwd(self):
        result = self.run_builder()
        self.assert_success(result)
        self.assertIn('Offline packaging only', result.stdout)
        with zipfile.ZipFile(self.output) as archive:
            expected = {f'make-custom-apps/{name}': data for name, data in self.source.items()}
            expected['make-custom-apps/LICENSE'] = (REPO / 'LICENSE').read_bytes()
            self.assertEqual(set(archive.namelist()), set(expected) | {'make-custom-apps/NOTICE'})
            for name, data in expected.items():
                self.assertEqual(archive.read(name), data, name)
            notice = archive.read('make-custom-apps/NOTICE').decode('utf-8')
            self.assertIn('https://github.com/integromat/make-skills', notice)
            self.assertIn('3dcad8e96a6e040e7eeaf344c16efec25685b5e8', notice)
            self.assertIn('MIT', notice)
            self.assertIsNone(archive.testzip())


    def test_archive_metadata_is_deterministic_across_source_metadata_and_order(self):
        self.assert_success(self.run_builder())
        first = self.output.read_bytes()
        with zipfile.ZipFile(self.output) as archive:
            self.assertEqual(archive.namelist(), sorted(archive.namelist()))
            for entry in archive.infolist():
                self.assertEqual(entry.date_time, (1980, 1, 1, 0, 0, 0))
                self.assertEqual(entry.create_system, 3)
                self.assertEqual(entry.external_attr >> 16, stat.S_IFREG | 0o644)
                self.assertEqual(entry.compress_type, zipfile.ZIP_STORED)
                self.assertEqual(entry.extra, b'')
                self.assertEqual(entry.comment, b'')
        for name, data in reversed(list(self.source.items())):
            path = self.skill / name
            path.unlink()
            path.write_bytes(data)
            path.chmod(0o755)
            os.utime(path, (1700000000, 1700000000))
        second = self.root / 'other.zip'
        self.assert_success(self.run_builder('--output', second))
        self.assertEqual(first, second.read_bytes())


    def test_check_is_read_only_and_detects_source_or_archive_drift(self):
        self.assert_success(self.run_builder())
        first = self.output.read_bytes()
        before = self.output.stat().st_mtime_ns
        self.assert_success(self.run_builder('--check'))
        self.assertEqual(self.output.stat().st_mtime_ns, before)
        for data in [first + b'unexpected trailing bytes', b'not a zip archive']:
            with self.subTest(archive=data[-25:]):
                self.output.write_bytes(data)
                result = self.run_builder('--check')
                self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
                self.assertIn('Archive drift', result.stderr)
                self.assertEqual(self.output.read_bytes(), data)
        self.output.write_bytes(first)
        self.put('SKILL.md', b'changed source\n')
        result = self.run_builder('--check')
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn('Archive drift', result.stderr)
        self.assertEqual(self.output.read_bytes(), first)

    def test_check_missing_archive_does_not_create_one(self):
        result = self.run_builder('--check')
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertFalse(self.output.exists())


    def assert_rejected(self, result, message):
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn(message, result.stderr)
        self.assertFalse(self.output.exists())

    def test_rejects_nonportable_or_private_inclusions_instead_of_silently_omitting(self):
        for name in [
            '.env', '.env.local', '.git/config', '.cache/state.json',
            'node_modules/package/index.js', '__pycache__/cached.pyc',
            'runtime/state.json', 'private/session.json', 'evidence/review.json',
            'raw_data/export.json', 'credentials.json', 'token.txt',
            'references/report.log', 'references/state.sqlite', 'references/nested.zip',
            'references/..\\escape.md', 'references/C:drive.md', 'references/NUL.txt',
            'references/name .md', 'references/trailing.',
        ]:
            with self.subTest(name=name):
                path = self.put(name)
                try:
                    self.assert_rejected(self.run_builder(), 'Unsafe inclusion')
                finally:
                    path.unlink()
                    parent = path.parent
                    while parent != self.skill and not any(parent.iterdir()):
                        parent.rmdir()
                        parent = parent.parent
                    self.output.unlink(missing_ok=True)

    def test_rejects_symlinked_files_and_directories(self):
        outside = self.root / 'outside.txt'
        outside.write_text('private fixture; must not be packaged')
        for name, target in [('linked.md', outside), ('linked-dir', self.root)]:
            with self.subTest(name=name):
                path = self.skill / name
                path.symlink_to(target, target_is_directory=target.is_dir())
                try:
                    self.assert_rejected(self.run_builder(), 'regular')
                finally:
                    path.unlink()
                    self.output.unlink(missing_ok=True)

    @unittest.skipUnless(hasattr(os, 'mkfifo'), 'FIFOs are not available on this OS')
    def test_rejects_special_files_without_reading_them(self):
        os.mkfifo(self.skill / 'pipe.json')
        self.assert_rejected(self.run_builder(), 'regular')

    def test_rejects_symlinked_skill_ancestor(self):
        original = self.root / 'original-skills'
        (self.root / 'skills').rename(original)
        (self.root / 'skills').symlink_to(original, target_is_directory=True)
        self.assert_rejected(self.run_builder(), 'regular')

    def test_rejects_symlinked_license(self):
        license_path = self.root / 'LICENSE'
        license_path.rename(self.root / 'other-license')
        license_path.symlink_to(self.root / 'other-license')
        self.assert_rejected(self.run_builder(), 'regular')


    def test_rejects_an_incomplete_skill_without_an_entry_point(self):
        (self.skill / 'SKILL.md').unlink()
        self.assert_rejected(self.run_builder(), 'Missing SKILL.md')

    def test_never_writes_a_build_into_the_canonical_skill(self):
        target = self.skill / 'generated.zip'
        result = self.run_builder('--output', target)
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn('Unsafe output', result.stderr)
        self.assertFalse(target.exists())

    def test_rejects_symlinked_output_without_modifying_the_target(self):
        outside = self.root / 'outside.zip'
        outside.write_bytes(b'keep this file')
        self.output.parent.mkdir()
        self.output.symlink_to(outside)
        result = self.run_builder()
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn('Unsafe output', result.stderr)
        self.assertEqual(outside.read_bytes(), b'keep this file')


    def test_rejects_credential_material_without_echoing_its_value(self):
        for payload in [
            b'-----BEGIN PRIVATE KEY-----\nsynthetic fixture\n',
            b'ghp_' + b'X' * 36,
            b'{"apiKey": "synthetic-unit-test-credential-value"}',
            b'{"access_token": "00000000-0000-0000-0000-000000000000"}',
        ]:
            with self.subTest(kind=payload[:12]):
                path = self.put('references/unsafe.json', payload)
                try:
                    result = self.run_builder()
                    self.assert_rejected(result, 'Possible credential material')
                    self.assertNotIn(payload.decode(), result.stdout + result.stderr)
                finally:
                    path.unlink()
                    self.output.unlink(missing_ok=True)

    def test_never_overwrites_a_non_zip_output(self):
        target = self.root / 'LICENSE'
        original = target.read_bytes()
        result = self.run_builder('--output', target)
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn('Unsafe output', result.stderr)
        self.assertEqual(target.read_bytes(), original)

    def test_rejects_a_symlinked_output_directory(self):
        outside = self.root / 'outside'
        outside.mkdir()
        self.output.parent.symlink_to(outside, target_is_directory=True)
        self.assert_rejected(self.run_builder(), 'Unsafe output')
        self.assertEqual(list(outside.iterdir()), [])


    def test_preserves_explicit_credential_placeholders_and_iml_expressions(self):
        example = (REPO / 'skills/make-custom-apps/examples/dropbox-oauth/common.example.json').read_bytes()
        self.put('examples/common.example.json', example)
        self.put('examples/parameters.json', b'{"apiKey":"YOUR_SERVICE_API_KEY","accessToken":"{{connection.accessToken}}"}')
        self.assert_success(self.run_builder())
        with zipfile.ZipFile(self.output) as archive:
            self.assertEqual(archive.read('make-custom-apps/examples/common.example.json'), example)


    @unittest.skipUnless(hasattr(os, 'mkfifo'), 'FIFOs are not available on this OS')
    def test_rejects_special_output_before_io(self):
        self.output.parent.mkdir()
        os.mkfifo(self.output)
        try:
            result = subprocess.run(
                [sys.executable, str(BUILDER), '--root', str(self.root)],
                cwd=self.temp.name, capture_output=True, text=True, timeout=1,
            )
        except subprocess.TimeoutExpired:
            self.fail('Special output blocked on I/O instead of being rejected')
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn('Unsafe output', result.stderr)


if __name__ == '__main__':
    unittest.main()
