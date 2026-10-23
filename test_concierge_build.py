"""Concierge runner preflight. No HTTP, inference, real stores, or build execution."""
import json
from pathlib import Path
import runpy
import subprocess
import sys
import tempfile
import unittest

RUNNER = Path(__file__).parent / 'verification/verify-concierge-cube-service.py'
require_shell_build = runpy.run_path(str(RUNNER))['require_shell_build']


class ConciergeBuildPrerequisitesTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / 'studio-shell').mkdir()
        (self.root / 'studio-shell/package-lock.json').write_text(json.dumps({'lockfileVersion': 3}))
        self.build = self.root / 'studio-web'

    def entry(self, script='/studio/assets/app.js', style='/studio/assets/app.css'):
        (self.build / 'assets').mkdir(parents=True, exist_ok=True)
        (self.build / 'index.html').write_text(
            f'<script type="module" src="{script}"></script><link rel="stylesheet" href="{style}">')
        (self.build / 'assets/app.js').write_text('// fixture')
        (self.build / 'assets/app.css').write_text('/* fixture */')

    def test_missing_build_exits_before_runtime_import_or_output(self):
        output = self.root / 'output'
        result = subprocess.run([sys.executable, str(RUNNER), str(self.root), str(output)],
                                capture_output=True, text=True, timeout=10)
        self.assertEqual(result.returncode, 2)
        self.assertIn('SHELL_BUILD_MISSING', result.stderr)
        self.assertIn('npm --prefix studio-shell ci', result.stderr)
        self.assertNotIn('ModuleNotFoundError', result.stderr)
        self.assertFalse(output.exists())

    def test_missing_lock_is_explicit(self):
        (self.root / 'studio-shell/package-lock.json').unlink()
        with self.assertRaisesRegex(RuntimeError, 'SHELL_LOCK_MISSING'):
            require_shell_build(self.root)

    def test_missing_script_or_style_is_incomplete(self):
        for filename in ['app.js', 'app.css']:
            with self.subTest(filename=filename):
                self.entry()
                (self.build / 'assets' / filename).unlink()
                with self.assertRaisesRegex(RuntimeError, 'SHELL_BUILD_INCOMPLETE'):
                    require_shell_build(self.root)

    def test_empty_entry_is_not_a_built_shell(self):
        self.entry()
        (self.build / 'index.html').write_text('<html></html>')
        with self.assertRaisesRegex(RuntimeError, 'SHELL_BUILD_INCOMPLETE'):
            require_shell_build(self.root)

    def test_external_or_escaping_assets_are_refused(self):
        for script in ['https://external.invalid/app.js', '/studio/../outside.js', '/studio/%2e%2e/outside.js']:
            with self.subTest(script=script):
                self.entry(script=script)
                with self.assertRaisesRegex(RuntimeError, 'SHELL_ASSET_INVALID'):
                    require_shell_build(self.root)

    def test_complete_build_is_read_only(self):
        self.entry()
        before = {str(p.relative_to(self.root)): p.read_bytes() for p in self.root.rglob('*') if p.is_file()}
        require_shell_build(self.root)
        after = {str(p.relative_to(self.root)): p.read_bytes() for p in self.root.rglob('*') if p.is_file()}
        self.assertEqual(before, after)


if __name__ == '__main__':
    unittest.main()
