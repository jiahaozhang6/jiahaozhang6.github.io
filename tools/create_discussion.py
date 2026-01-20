#!/usr/bin/env python3
"""
Create a GitHub Discussion in a repository discussion category via GraphQL.
Usage:
  python tools/create_discussion.py --repo owner/repo --category-id CATEGORY_ID --title "Title" --body "Body text"
Requires GITHUB_TOKEN env var or --token (the token needs 'repo' or 'discussions' scope).
"""
import os, sys, json, argparse
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

API = 'https://api.github.com/graphql'
parser = argparse.ArgumentParser()
parser.add_argument('--repo', required=True)
parser.add_argument('--repo-id', help='GraphQL repository ID (optional)')
parser.add_argument('--category-id', required=True)
parser.add_argument('--title', required=True)
parser.add_argument('--body', required=True)
parser.add_argument('--token', help='GitHub token or set GITHUB_TOKEN env var')
args = parser.parse_args()

token = args.token or os.environ.get('GITHUB_TOKEN')
if not token:
    print('Error: provide --token or set GITHUB_TOKEN')
    sys.exit(2)

# Ensure we have the repository GraphQL ID. Accept --repo-id or query it.
repo_id = args.repo_id
if not repo_id:
    # args.repo is owner/name
    if '/' not in args.repo:
        print('repo should be owner/name format')
        sys.exit(2)
    owner, name = args.repo.split('/', 1)
    repo_query = '''
query($owner:String!, $name:String!){
  repository(owner:$owner, name:$name){ id }
}
'''
    try:
        payload = json.dumps({'query': repo_query, 'variables': {'owner': owner, 'name': name}}).encode('utf-8')
        req = Request(API, data=payload, method='POST')
        req.add_header('Authorization', 'bearer ' + token)
        req.add_header('Content-Type', 'application/json')
        resp = urlopen(req)
        body = resp.read().decode('utf-8')
        data = json.loads(body)
        repo_id = data.get('data', {}).get('repository', {}).get('id')
        if not repo_id:
            print('Failed to determine repository id. Response:')
            print(json.dumps(data, indent=2, ensure_ascii=False))
            sys.exit(1)
    except Exception as e:
        print('Failed to fetch repository id:', e)
        sys.exit(1)

query = '''
mutation($repositoryId: ID!, $categoryId: ID!, $title: String!, $body: String!) {
    createDiscussion(input: {repositoryId: $repositoryId, categoryId: $categoryId, title: $title, body: $body}) {
        discussion { id url }
    }
}
'''

payload = json.dumps({ 'query': query, 'variables': { 'repositoryId': repo_id, 'categoryId': args.category_id, 'title': args.title, 'body': args.body } }).encode('utf-8')
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
    out = data.get('data', {}).get('createDiscussion', {}).get('discussion')
    if out:
        print('Created discussion:', out.get('url'))
    else:
        print('No discussion returned. Response:')
        print(json.dumps(data, indent=2, ensure_ascii=False))
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
