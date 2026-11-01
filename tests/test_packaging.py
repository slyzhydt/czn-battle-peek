from pathlib import Path
import ast
import hashlib
import importlib.util
import json
import unittest

ROOT=Path(__file__).resolve().parent.parent


class PackagingChecks(unittest.TestCase):
    def test_source_manifest_excludes_local_data(self):
        m=json.loads((ROOT/'SOURCE-MANIFEST.json').read_text(encoding='utf-8'))
        for name,digest in m['files'].items():
            self.assertNotIn(name.split('/')[0],('runs','runtime','vendor','.git'))
            self.assertFalse(name.startswith(('latest.','live-','plan.json')))
            self.assertEqual(hashlib.sha256((ROOT/name).read_bytes()).hexdigest(),digest)

    def test_python_sources_parse(self):
        for name in ['peek.py','cache-reader.py','build_portable.py','collector/native_host.py','collector/export_supervisor.py','collector/version_report.py']:
            ast.parse((ROOT/name).read_text(encoding='utf-8-sig'))

    def test_cache_extension_changes_only_declared_key_list(self):
        spec=importlib.util.spec_from_file_location('reader',ROOT/'cache-reader.py')
        reader=importlib.util.module_from_spec(spec)
        spec.loader.exec_module(reader)
        expression="for(const key of [98,122,323]){};scope:'three-declared-powerstep-keys'"
        source='const untouched=42;\nconst gameCaptureExpression='+json.dumps(expression)+';\n'
        built=reader.extend_existing_cache_reader(lambda *_:source)({}, {})
        self.assertEqual(built.replace('[81,98,122,323]','[98,122,323]').replace('four-declared-powerstep-keys','three-declared-powerstep-keys'),source)


if __name__=='__main__':
    unittest.main()
