#!/usr/bin/env python3
"""
Append a guestbook entry to data/guestbook.json from the command line.
Usage:
  python tools/add_guestbook_entry.py --name "Your Name" --message "Hello" --tags tag1,tag2

This edits the file in place.
"""
import argparse
import json
from pathlib import Path
from datetime import date

DATA = Path(__file__).resolve().parents[1] / 'data' / 'guestbook.json'

parser = argparse.ArgumentParser(description='Append a guestbook entry to data/guestbook.json')
parser.add_argument('--name', required=True)
parser.add_argument('--message', required=True)
parser.add_argument('--tags', default='')
args = parser.parse_args()

def load():
    if not DATA.exists():
        return []
    try:
        return json.loads(DATA.read_text(encoding='utf-8'))
    except Exception as e:
        print('Failed to read JSON:', e)
        return []

entries = load()
entry = {
    'name': args.name,
    'date': date.today().isoformat(),
    'message': args.message,
    'tags': [t.strip() for t in args.tags.split(',') if t.strip()]
}
entries.append(entry)
DATA.write_text(json.dumps(entries, ensure_ascii=False, indent=2), encoding='utf-8')
print('Appended entry to', DATA)
