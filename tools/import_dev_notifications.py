#!/usr/bin/env python3
"""Create only NEW inactive DEV notification stubs. Dry-run by default; never execute/activate."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
KINDS = ('missed-call', 'reminder', 'owner-alert', 'error-alert')
STATE = ROOT / 'docs/codex/dev-notification-resources.json'
BASE = 'https://n8n.kyneticai.com/api/v1'


def validate(workflow, expected_name):
    if workflow.get('name') != expected_name or workflow.get('active') is not False:
        raise RuntimeError('Refusing a non-owned or active workflow')
    nodes = workflow.get('nodes', [])
    allowed = {'n8n-nodes-base.manualTrigger', 'n8n-nodes-base.code', 'n8n-nodes-base.twilio', 'n8n-nodes-base.stickyNote'}
    if not nodes or any(node.get('type') not in allowed or node.get('credentials') for node in nodes):
        raise RuntimeError('Unexpected node type or attached credentials')
    sends = [node for node in nodes if node.get('type') == 'n8n-nodes-base.twilio']
    if len(sends) != 1 or sends[0].get('disabled') is not True or sends[0].get('retryOnFail') is not False or sends[0].get('parameters', {}).get('to') != '={{ $env.TEST_PHONE }}':
        raise RuntimeError('SMS must remain disabled, without retries, and TEST_PHONE-only')
    settings = workflow.get('settings', {})
    if settings.get('saveDataSuccessExecution') != 'none' or settings.get('saveDataErrorExecution') != 'none' or settings.get('saveManualExecutions') is not False:
        raise RuntimeError('Execution payload storage must remain off')


def payload(workflow):
    return {key: workflow[key] for key in ('name', 'nodes', 'connections', 'settings')}


def digest(workflow):
    return hashlib.sha256(json.dumps(payload(workflow), sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def save(path, state):
    temporary = path.with_name(path.name + '.tmp')
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w') as stream:
        json.dump(state, stream, indent=2)
        stream.write('\n')
    temporary.replace(path)
    path.chmod(0o600)


def assert_content(remote, local):
    validate(remote, local['name'])
    # Servers may add defaults; compare every requested field rather than whole responses.
    if remote.get('connections') != local['connections'] or remote.get('nodes') != local['nodes']:
        raise RuntimeError('Remote DEV node/connection content differs; refusing to edit')
    if any(remote.get('settings', {}).get(key) != value for key, value in local['settings'].items()):
        raise RuntimeError('Remote DEV settings differ; refusing to edit')


def apply(workflows, path, api):
    state = json.loads(path.read_text()) if path.exists() else {'workflows': {}}
    if state.get('pending'):
        raise RuntimeError('Uncertain prior create: reconcile read-only before any retry')
    known = state['workflows']
    names = {}
    cursor = None
    while True:
        page = api('GET', '/workflows?limit=100' + ('&cursor=' + urllib.parse.quote(cursor, safe='') if cursor else ''))
        for item in page['data']:
            names.setdefault(item.get('name'), []).append(item['id'])
        cursor = page.get('nextCursor')
        if not cursor:
            break
    tags = api('GET', '/tags?limit=100')['data']
    tag = next((item for item in tags if item.get('name') == 'DEV'), None)
    if not tag:
        raise RuntimeError('DEV tag missing; no workflows created')
    # Reject all unowned collisions before any mutation.
    for kind, local in workflows.items():
        validate(local, 'DEV - ' + kind)
        owned = known.get(kind)
        matching = names.get(local['name'], [])
        if matching and (not owned or matching != [owned['id']]):
            raise RuntimeError('Unrecorded DEV name collision; existing workflows unchanged')
        if owned and owned.get('source_sha256') != digest(local):
            raise RuntimeError('Owned source changed; importer never edits existing workflow definitions')
    for kind, local in workflows.items():
        owned = known.get(kind)
        if not owned:
            state['pending'] = {'kind': kind, 'name': local['name']}
            save(path, state)
            created = api('POST', '/workflows', payload(local))
            workflow_id = str(created.get('id', ''))
            if not re.fullmatch(r'[A-Za-z0-9_-]{1,64}', workflow_id):
                raise RuntimeError('Invalid create response; no automatic retry')
            known[kind] = {'id': workflow_id, 'name': local['name'], 'source_sha256': digest(local), 'tagged': False, 'verified_inactive': False}
            del state['pending']
            save(path, state)
            owned = known[kind]
        workflow_id = owned['id']
        remote = api('GET', '/workflows/' + workflow_id)
        assert_content(remote, local)
        if not owned.get('tagged'):
            # Only tag the just-created/journal-owned inactive object, never a pre-existing workflow.
            api('PUT', '/workflows/' + workflow_id + '/tags', [{'id': tag['id']}])
        remote = api('GET', '/workflows/' + workflow_id)
        assert_content(remote, local)
        if not any(item.get('name') == 'DEV' for item in remote.get('tags', [])):
            raise RuntimeError('DEV tag read-back failed')
        owned.update(tagged=True, verified_inactive=True)
        save(path, state)
    return state


def request(method, path, data=None):
    valid = (method == 'GET' and (path.startswith('/workflows?limit=100') or path == '/tags?limit=100' or re.fullmatch(r'/workflows/[A-Za-z0-9_-]{1,64}', path))) or (method == 'POST' and path == '/workflows') or (method == 'PUT' and re.fullmatch(r'/workflows/[A-Za-z0-9_-]{1,64}/tags', path))
    if not valid:
        raise RuntimeError('Disallowed n8n operation; execution/activation/deletion are unavailable')
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *args, **kwargs):
            return None
    req = urllib.request.Request(BASE + path, method=method, data=json.dumps(data).encode() if data is not None else None, headers={'X-N8N-API-KEY': os.environ['n8n_vps'], 'Content-Type': 'application/json'})
    try:
        with urllib.request.build_opener(NoRedirect()).open(req, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        raise RuntimeError('n8n request failed: HTTP ' + str(error.code)) from None
    except Exception:
        raise RuntimeError('n8n transport/response failed; no automatic retry') from None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    workflows = {kind: json.loads((ROOT / 'n8n/workflows/dev' / (kind + '.json')).read_text()) for kind in KINDS}
    for kind, workflow in workflows.items():
        validate(workflow, 'DEV - ' + kind)
    if not args.apply:
        print('DRY RUN: create four NEW DEV-tagged inactive notification stubs; SMS disabled, no credentials, no executions or activation.')
        return
    raise RuntimeError('DEV environment retired until after go-live (2026-11-09 PST). This apply path does not run. See docs/STATUS.md.')

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        raise SystemExit(str(error) if isinstance(error, RuntimeError) else 'Importer validation failed; no automatic retry') from None
