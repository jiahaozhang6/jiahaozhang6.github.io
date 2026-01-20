#!/usr/bin/env python3
"""
Create a single GitHub Discussion containing all guestbook entries, or append them
as a single comment to an existing discussion.

Usage examples:
  # create a new discussion with combined entries
  GITHUB_TOKEN=xxx python tools/merge_guestbook_to_single_discussion.py --repo owner/repo --category-id DIC_xxx

  # append to an existing discussion by number
  GITHUB_TOKEN=xxx python tools/merge_guestbook_to_single_discussion.py --repo owner/repo --discussion-number 2

Options:
  --file         Path to guestbook JSON (default: data/guestbook.json)
  --title        Title for the created discussion (default: '合并留言')
  --token        GitHub token or set GITHUB_TOKEN env var
  --dry-run      Show the combined body without performing API calls
  --yes          Skip confirmation

Notes:
  - Token requires `discussions` or `repo` scope for creating discussions/comments.
  - When using --discussion-number the script will append a single comment to that discussion.
"""
import os
import sys
import json
import argparse
import time
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

API = 'https://api.github.com/graphql'

parser = argparse.ArgumentParser(description='Merge guestbook JSON into a single GitHub Discussion')
parser.add_argument('--repo', required=True, help='owner/repo')
parser.add_argument('--category-id', help='Discussion category ID (DIC_...) — required when creating a new discussion')
parser.add_argument('--discussion-number', type=int, help='Append to an existing discussion by its number (repository discussion number)')
parser.add_argument('--file', default='data/guestbook.json', help='Path to guestbook JSON')
parser.add_argument('--token', help='GitHub token or set GITHUB_TOKEN env var')
parser.add_argument('--dry-run', action='store_true', help='Show combined content without creating/adding')
parser.add_argument('--yes', action='store_true', help='Auto confirm')
parser.add_argument('--title', default='合并留言', help='Title for the created discussion')
args = parser.parse_args()

token = args.token or os.environ.get('GITHUB_TOKEN')
if not token:
    print('Error: provide --token or set GITHUB_TOKEN environment variable')
    sys.exit(2)

if '/' not in args.repo:
    print('repo should be owner/name format')
    sys.exit(2)
owner, name = args.repo.split('/', 1)

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

# load guestbook
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

def render_markdown(entries):
    parts = []
    for i, e in enumerate(entries, 1):
        name = e.get('name') or '匿名'
        date = e.get('date') or ''
        message = e.get('message') or ''
        tags = e.get('tags') or []
        header = f"### {i}. {name} — {date}" if (name or date) else f"### {i}"
        parts.append(header)
        parts.append('')
        # preserve newlines
        parts.append(message)
        if tags:
            parts.append('')
            parts.append('标签：' + ', '.join(tags))
        parts.append('---')
    body = '\n'.join(parts)
    return body

combined_body = render_markdown(entries)

if args.dry_run:
    print('--- Combined body preview ---')
    print(combined_body)
    print('--- end preview ---')
    sys.exit(0)

if not args.yes:
    print(f'About to merge {len(entries)} entries from {args.file}')
    ok = input('Proceed? (y/N): ').strip().lower()
    if ok not in ('y', 'yes'):
        print('Aborted by user.')
        sys.exit(0)

# If user specified discussion-number -> resolve to GraphQL id and append as a comment
if args.discussion_number:
    # fetch discussion GraphQL id
    q = '''
query($owner:String!, $name:String!, $number:Int!) { repository(owner:$owner, name:$name) { discussion(number:$number) { id url } } }
'''
    res = graphql(q, {'owner': owner, 'name': name, 'number': args.discussion_number})
    if not res or 'repository' not in res or not res['repository'] or not res['repository'].get('discussion'):
        print('Failed to fetch discussion by number. Response:', res)
        sys.exit(1)
    discussion = res['repository']['discussion']
    discussion_id = discussion['id']
    print('Resolved discussion:', discussion.get('url'))

    mutation = '''
mutation($discussionId:ID!, $body:String!) { addDiscussionComment(input:{discussionId:$discussionId, body:$body}) { comment { id url } } }
'''
    vars = {'discussionId': discussion_id, 'body': combined_body}
    r = graphql(mutation, vars)
    if 'errors' in r:
        print('API errors:', json.dumps(r['errors'], ensure_ascii=False, indent=2))
        sys.exit(1)
    print('Appended combined comment to discussion.')
    sys.exit(0)

# Otherwise create a new discussion (requires category id)
if not args.category_id:
    print('Error: --category-id is required when creating a new discussion')
    sys.exit(2)

# fetch repository id
repo_q = '''
query($owner:String!, $name:String!){ repository(owner:$owner, name:$name){ id } }
'''
res = graphql(repo_q, {'owner': owner, 'name': name})
if not res or 'repository' not in res or not res['repository']:
    print('Failed to fetch repository id. Response:', res)
    sys.exit(1)
repo_id = res['repository']['id']
print('Repository id:', repo_id)

mutation = '''
mutation($repositoryId:ID!, $categoryId:ID!, $title:String!, $body:String!) {
  createDiscussion(input:{repositoryId:$repositoryId, categoryId:$categoryId, title:$title, body:$body}) {
    discussion { id url }
  }
}
'''

vars = {'repositoryId': repo_id, 'categoryId': args.category_id, 'title': args.title, 'body': combined_body}
r = graphql(mutation, vars)
if 'errors' in r:
    print('API errors:', json.dumps(r['errors'], ensure_ascii=False, indent=2))
    sys.exit(1)
disc = r.get('createDiscussion', {}).get('discussion') if isinstance(r.get('createDiscussion', {}), dict) else None
if not disc:
    print('Failed to parse creation response; result:', r)
    sys.exit(1)
print('Created discussion:', disc.get('url'))
