#!/usr/bin/env python3
"""
Check GitHub Discussions categories for a repository and print their IDs.
Usage:
  # set GITHUB_TOKEN environment variable with a Personal Access Token (repo:read or discussions scope)
  python tools/check_github_discussions.py --repo jiahaozhang6/jiahaozhang6.github.io

You can also pass --token directly (less secure).
"""
import os
import sys
import json
import argparse
try:
    # Python 3 stdlib
    from urllib.request import Request, urlopen
    from urllib.error import URLError, HTTPError
except Exception:
    print('Unsupported Python environment')
    sys.exit(1)

API = 'https://api.github.com/graphql'

parser = argparse.ArgumentParser()
parser.add_argument('--repo', required=True, help='owner/repo')
parser.add_argument('--token', help='GitHub token (or set GITHUB_TOKEN env var)')
args = parser.parse_args()

token = args.token or os.environ.get('GITHUB_TOKEN')
if not token:
    print('Error: provide --token or set GITHUB_TOKEN environment variable with a GitHub token.')
    sys.exit(2)

if '/' not in args.repo:
    print('repo should be in owner/repo format')
    sys.exit(2)
owner, name = args.repo.split('/', 1)

query = '''
query($owner:String!, $name:String!){
  repository(owner:$owner, name:$name){
    discussionCategories(first:100){
      nodes{ id name }
    }
  }
}
'''

payload = json.dumps({ 'query': query, 'variables': { 'owner': owner, 'name': name } }).encode('utf-8')
req = Request(API, data=payload, method='POST')
req.add_header('Authorization', 'bearer ' + token)
req.add_header('Content-Type', 'application/json')

try:
    resp = urlopen(req)
    body = resp.read().decode('utf-8')
    data = json.loads(body)
    if 'errors' in data:
        print('API errors:')
        print(json.dumps(data['errors'], indent=2, ensure_ascii=False))
        sys.exit(1)
    cats = data.get('data', {}).get('repository', {}).get('discussionCategories', {}).get('nodes', [])
    if not cats:
        print('No discussion categories found. Ensure Discussions are enabled in repository settings.')
        sys.exit(0)
    print('Discussion categories for', args.repo)
    for c in cats:
        print('- Name:', c.get('name'), '  ID:', c.get('id'))
except HTTPError as e:
    print('HTTP Error:', e.code, e.reason)
    try:
        print(e.read().decode())
    except Exception:
        pass
    sys.exit(1)
except URLError as e:
    print('URL Error:', e.reason)
    sys.exit(1)
except Exception as e:
    print('Request failed:', e)
    sys.exit(1)
