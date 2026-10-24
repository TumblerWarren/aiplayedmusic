"""Real pinned artifact passes; a one-byte modification must fail before extraction."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

spec=importlib.util.spec_from_file_location('fetch_model',Path(__file__).with_name('fetch_model.py'))
fetch=importlib.util.module_from_spec(spec);spec.loader.exec_module(fetch)


class BundleChecks(unittest.TestCase):
    def test_pinned_bundle_and_tamper_rejection(self):
        original=fetch.ROOT/'.build-tools/model-assets/ssondo-fp32-v1.zip'
        self.assertTrue(original.exists(),'Run fetch_model.py before artifact verification')
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary)
            fetch.install(original,root/'approved')
            self.assertEqual(len(list((root/'approved').iterdir())),5)
            changed=bytearray(original.read_bytes());changed[len(changed)//2]^=1
            damaged=root/'changed.zip';damaged.write_bytes(changed)
            with self.assertRaisesRegex(AssertionError,'checksum mismatch'):
                fetch.install(damaged,root/'rejected')
            self.assertFalse((root/'rejected').exists(),'Tampered data must never be extracted')


if __name__=='__main__':unittest.main()
