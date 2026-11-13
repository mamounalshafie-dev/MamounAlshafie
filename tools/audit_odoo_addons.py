#!/usr/bin/env python3
"""Read-only inventory of Odoo addons. Never imports addon code or connects to Odoo."""
import argparse
import ast
import csv
import json
from pathlib import Path
import xml.etree.ElementTree as ET


def audit(root):
    root = Path(root)
    if not root.is_dir():
        raise ValueError('Addons path is not a directory')
    modules = []
    for manifest in sorted(root.rglob('__manifest__.py')):
        item = {'module': manifest.parent.name, 'path': str(manifest.parent.relative_to(root)),
                'errors': [], 'missing_data_files': [], 'xml_errors': [], 'access_rows': 0}
        try:
            data = ast.literal_eval(manifest.read_text(encoding='utf-8'))
            if not isinstance(data, dict):
                raise ValueError('manifest must be a dictionary')
            depends = data.get('depends', [])
            files = data.get('data', [])
            if not isinstance(depends, list) or not all(isinstance(x, str) for x in depends):
                raise ValueError('depends must be a list of strings')
            if not isinstance(files, list) or not all(isinstance(x, str) for x in files):
                raise ValueError('data must be a list of strings')
            item.update(version=data.get('version'), depends=depends,
                        installable=data.get('installable', True), data_files=len(files))
            for entry in files:
                path = (manifest.parent / entry).resolve()
                if not path.is_relative_to(manifest.parent.resolve()):
                    item['errors'].append(f'data path outside module: {entry}')
                elif not path.is_file():
                    item['missing_data_files'].append(entry)
                elif path.suffix.lower() == '.xml':
                    try:
                        ET.parse(path)
                    except (ET.ParseError, OSError) as exc:
                        item['xml_errors'].append({'file': entry, 'error': str(exc)})
                elif path.name == 'ir.model.access.csv':
                    with path.open(encoding='utf-8-sig', newline='') as stream:
                        item['access_rows'] += sum(1 for _ in csv.DictReader(stream))
        except (OSError, UnicodeError, SyntaxError, ValueError) as exc:
            item['errors'].append(str(exc))
        modules.append(item)
    names = {m['module'] for m in modules}
    for item in modules:
        item['local_dependencies'] = [d for d in item.get('depends', []) if d in names]
        item['external_dependencies_unverified'] = [d for d in item.get('depends', []) if d not in names]
    return {'scope': 'static read-only inventory; installation and runtime compatibility not verified',
            'module_count': len(modules), 'modules': modules}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('addons_path', help='Directory containing extracted addons')
    args = parser.parse_args()
    try:
        result = audit(args.addons_path)
    except ValueError as exc:
        parser.error(str(exc))
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if not result['modules'] or any(
        m['errors'] or m['missing_data_files'] or m['xml_errors'] for m in result['modules']
    ) else 0


if __name__ == '__main__':
    raise SystemExit(main())
