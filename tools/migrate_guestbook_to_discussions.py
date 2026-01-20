#!/usr/bin/env python3
"""
Batch migrate entries from data/guestbook.json into GitHub Discussions.

Usage:
  # interactive mode (confirm each create)
  python tools/migrate_guestbook_to_discussions.py --repo owner/repo --category-id DIC_xxx

  # non-interactive, auto confirm
  GITHUB_TOKEN=xxx python tools/migrate_guestbook_to_discussions.py --repo owner/repo --category-id DIC_xxx --yes

  # dry-run (show what would be created)
  python tools/migrate_guestbook_to_discussions.py --repo owner/repo --category-id DIC_xxx --dry-run

Notes:
- Requires a GitHub token with `discussions` or `repo` scope. Set via --token or GITHUB_TOKEN env var.
- Created discussion titles are generated from entry name and date. You can customize with --prefix.
- Script does not deduplicate; if you rerun without checks you may create duplicates.
"""
import os
import sys
import json
import time
import argparse
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

API = 'https://api.github.com/graphql'

parser = argparse.ArgumentParser(description='Migrate guestbook JSON entries to GitHub Discussions')
parser.add_argument('--repo', required=True, help='owner/repo')
parser.add_argument('--category-id', required=True, help='Discussion category ID (DIC_...)')
parser.add_argument('--file', default='data/guestbook.json', help='Path to guestbook JSON')
parser.add_argument('--token', help='GitHub token or set GITHUB_TOKEN env var')
parser.add_argument('--dry-run', action='store_true', help='Show planned creations without performing')
parser.add_argument('--yes', action='store_true', help='Auto confirm creation without prompting')
parser.add_argument('--prefix', default='留言', help='Title prefix for created discussions')
parser.add_argument('--delay', type=float, default=0.8, help='Delay seconds between API calls')
args = parser.parse_args()

token = args.token or os.environ.get('GITHUB_TOKEN')
if not token:
    print('Error: provide --token or set GITHUB_TOKEN environment variable')
    sys.exit(2)

if '/' not in args.repo:
    print('repo should be owner/name format')
    sys.exit(2)
owner, name = args.repo.split('/', 1)

# helper: GraphQL request
def graphql(query, variables):
    payload = json.dumps({'query': query, 'variables': variables}).encode('utf-8')
    req = Request(API, data=payload, method='POST')
    req.add_header('Authorization', 'bearer ' + token)
    req.add_header('Content-Type', 'application/json')
    try:
        resp = urlopen(req)
        body = resp.read().decode('utf-8')
        data = json.loads(body)
        if 'errors' in data:
            return {'errors': data['errors']}
        return data.get('data', {})
    except HTTPError as e:
        print('HTTP Error:', e.code, e.reason)
        try:
            print(e.read().decode())
        except Exception:
            pass
        return {'http_error': True}
    except URLError as e:
        print('URL Error:', e.reason)
        return {'url_error': True}
    except Exception as e:
        print('Request failed:', e)
        return {'exception': str(e)}

# get repository GraphQL id
print('Fetching repository id for', args.repo)
repo_q = '''
query($owner:String!, $name:String!){ repository(owner:$owner, name:$name){ id } }
'''
res = graphql(repo_q, {'owner': owner, 'name': name})
if not res or 'repository' not in res or not res['repository']:
    print('Failed to fetch repository id. Response:', res)
    sys.exit(1)
repo_id = res['repository']['id']
print('Repository id:', repo_id)

# load guestbook file
if not os.path.exists(args.file):
    print('File not found:', args.file)
    sys.exit(1)
with open(args.file, 'r', encoding='utf-8') as f:
    try:
        entries = json.load(f)
    except Exception as e:
        print('Failed to parse JSON:', e)
        sys.exit(1)

if not isinstance(entries, list) or not entries:
    print('No entries found in', args.file)
    sys.exit(0)

print('Found', len(entries), 'entries in', args.file)
plan = []
for i, e in enumerate(entries, 1):
    name = e.get('name') or '匿名'
    date = e.get('date') or ''
    message = e.get('message') or ''
    tags = e.get('tags') or []
    title = f"{args.prefix} — {name} {date}"
    body_lines = [message, '']
    if tags:
        body_lines.append('标签：' + ', '.join(tags))
    body = '\n'.join(body_lines)
    plan.append({'index': i, 'title': title, 'body': body})

# show plan
print('\nPlanned creations:')
for p in plan:
    print(p['index'], p['title'])

if args.dry_run:
    print('\nDry run complete. No discussions created.')
    sys.exit(0)

if not args.yes:
    ok = input('\nProceed to create these discussions? (y/N): ').strip().lower()
    if ok != 'y' and ok != 'yes':
        print('Aborted by user.')
        sys.exit(0)

# create discussions
mutation = '''
mutation($repositoryId:ID!, $categoryId:ID!, $title:String!, $body:String!) {
  createDiscussion(input:{repositoryId:$repositoryId, categoryId:$categoryId, title:$title, body:$body}) {
    discussion { id url }
  }
}
'''

created = []
for p in plan:
    print('Creating:', p['title'])
    vars = {'repositoryId': repo_id, 'categoryId': args.category_id, 'title': p['title'], 'body': p['body']}
    r = graphql(mutation, vars)
    if 'http_error' in r or 'url_error' in r:
        print('Network error, stopping.')
        break
    if 'errors' in r:
        print('API errors:', json.dumps(r['errors'], ensure_ascii=False, indent=2))
        print('Skipping this entry.')
    else:
        disc = r.get('createDiscussion', {}).get('discussion') if isinstance(r.get('createDiscussion', {}), dict) else None
        # GraphQL returns nested data differently; try to extract from raw response if needed
        if not disc:
            # sometimes our helper returned top-level data; try to fetch from last call separately
            print('Warning: unable to parse creation response; result:', r)
        else:
            print('Created:', disc.get('url'))
            created.append(disc.get('url'))
    time.sleep(args.delay)

print('\nDone. Created', len(created), 'discussions.')
if created:
    print('Example URL:', created[0])

