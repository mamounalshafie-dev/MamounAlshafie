import tempfile
import unittest
from pathlib import Path
from tools.audit_odoo_addons import audit


class AuditTests(unittest.TestCase):
    def test_inventory_and_missing_and_invalid_xml(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            mod = root / 'mc_core'
            mod.mkdir()
            (mod / '__manifest__.py').write_text(repr({'depends': ['base'], 'data': ['bad.xml', 'missing.xml']}))
            (mod / 'bad.xml').write_text('<odoo>')
            result = audit(root)
            self.assertEqual(result['module_count'], 1)
            self.assertEqual(result['modules'][0]['missing_data_files'], ['missing.xml'])
            self.assertEqual(result['modules'][0]['xml_errors'][0]['file'], 'bad.xml')
            self.assertEqual(result['modules'][0]['external_dependencies_unverified'], ['base'])

    def test_manifest_is_not_executed_and_traversal_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for name, manifest in [('a', "__import__('os').system('false')"),
                                   ('b', repr({'data': ['../outside.xml']}))]:
                mod = root / name
                mod.mkdir()
                (mod / '__manifest__.py').write_text(manifest)
            result = audit(root)
            self.assertTrue(result['modules'][0]['errors'])
            self.assertIn('outside module', result['modules'][1]['errors'][0])

    def test_local_dependency_and_access_rows(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for name in ('a', 'b'):
                (root / name).mkdir()
            (root / 'a' / '__manifest__.py').write_text(repr({'depends': ['b'], 'data': ['ir.model.access.csv']}))
            (root / 'a' / 'ir.model.access.csv').write_text('id,name\nx,X\ny,Y\n')
            (root / 'b' / '__manifest__.py').write_text('{}')
            item = audit(root)['modules'][0]
            self.assertEqual(item['access_rows'], 2)
            self.assertEqual(item['local_dependencies'], ['b'])


if __name__ == '__main__':
    unittest.main()
