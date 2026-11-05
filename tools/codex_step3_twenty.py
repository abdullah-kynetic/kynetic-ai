#!/usr/bin/env python3
"""Review-only by default. Apply only the approved synthetic Twenty plan; never DELETE."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import urllib.error
import urllib.request
from urllib.parse import urlparse
from uuid import UUID

ROOT = Path(__file__).resolve().parents[1]
PLAN = ROOT / 'docs/codex/step3-twenty-dry-run.json'
STATE = ROOT / 'docs/codex/step3-twenty-write-state.json'
BASE = 'https://crm.kyneticai.com'
COLLECTIONS = {'clientAccounts': 'ClientAccount', 'endCustomers': 'EndCustomer', 'customerInteractions': 'CustomerInteraction'}


def plan_hash(plan):
    return hashlib.sha256(json.dumps(plan, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def validate_plan(plan):
    if plan.get('target') != BASE or plan.get('mode') != 'dry_run_only' or plan.get('synthetic') is not True:
        raise RuntimeError('Only the synthetic review plan is supported')
    ops = plan.get('operations', [])
    if [(op.get('method'), op.get('path')) for op in ops] != [
        ('POST', '/rest/clientAccounts'), ('POST', '/rest/endCustomers'),
        ('POST', '/rest/customerInteractions'), ('PATCH', '/rest/endCustomers/$created.endCustomer.id')
    ]:
        raise RuntimeError('Unexpected operation sequence')
    allowed = [
        {'name', 'buildStatus'},
        {'name', 'fullName', 'clientAccountId', 'leadSource', 'leadStatus'},
        {'name', 'clientAccountId', 'endCustomerId', 'interactionType', 'channel', 'outcome', 'bookedSlot', 'summary'},
        {'leadStatus', 'lastOutcome', 'attemptCount'}
    ]
    for i, op in enumerate(ops):
        if set(op['body']) != allowed[i]:
            raise RuntimeError('Unexpected write fields')
        if i < 3 and not op['body']['name'].startswith('DEV - Codex Step3 '):
            raise RuntimeError('Refusing a record without the DEV test name')
    if [op.get('saveIdAs') for op in ops[:3]] != ['clientAccount', 'endCustomer', 'interaction']:
        raise RuntimeError('Unexpected created-id references')
    if ops[0]['body']['buildStatus'] != 'TESTING':
        raise RuntimeError('Only test accounts may be created')
    if ops[1]['body']['clientAccountId'] != '$created.clientAccount.id' or ops[2]['body']['clientAccountId'] != '$created.clientAccount.id' or ops[2]['body']['endCustomerId'] != '$created.endCustomer.id':
        raise RuntimeError('Relations must reference new records only')
    if ops[1]['body']['leadSource'] != 'OTHER' or ops[1]['body']['leadStatus'] != 'NEW':
        raise RuntimeError('Unexpected synthetic lead state')
    if ops[2]['body']['channel'] != 'WEB_CHAT' or ops[2]['body']['interactionType'] != 'JOB_BOOKING' or ops[2]['body']['outcome'] != 'BOOKED' or not ops[2]['body']['bookedSlot'].startswith('DEV SIMULATION') or 'SYNTHETIC' not in ops[2]['body']['summary']:
        raise RuntimeError('Booking must be explicitly simulated')
    if ops[3]['body'] != {'leadStatus': 'BOOKED', 'lastOutcome': 'BOOKED', 'attemptCount': 0}:
        raise RuntimeError('Unexpected test writeback')


def save_state(path, state):
    path.parent.mkdir(parents=True, exist_ok=True)
    # Atomic replacement. Only IDs/progress are retained; never credentials or API bodies.
    temporary = path.with_name(path.name + '.tmp')
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w') as stream:
        json.dump(state, stream, indent=2)
        stream.write('\n')
    temporary.replace(path)
    path.chmod(0o600)


def unwrap(response, collection, action):
    data = response.get('data', {})
    key = action + COLLECTIONS[collection]
    # Twenty versions return either action-prefixed or singular object keys.
    singular = COLLECTIONS[collection][0].lower() + COLLECTIONS[collection][1:]
    record = data.get(key, data.get(singular))
    if not isinstance(record, dict):
        raise RuntimeError('Unexpected Twenty response shape; no automatic retry')
    UUID(record.get('id', ''))
    return record


def resolve(value, created):
    if isinstance(value, dict):
        return {key: resolve(item, created) for key, item in value.items()}
    if not isinstance(value, str):
        return value
    for name, record_id in created.items():
        UUID(record_id)
        value = value.replace('$created.' + name + '.id', record_id)
    if '$created.' in value:
        raise RuntimeError('Unresolved created-record reference')
    return value


def apply_plan(plan, approved_hash, path, api):
    validate_plan(plan)
    digest = plan_hash(plan)
    if approved_hash != digest:
        raise RuntimeError('Approval hash does not match the exact reviewed plan')
    state = json.loads(path.read_text()) if path.exists() else {'plan_sha256': digest, 'created': {}, 'completed': []}
    if state.get('plan_sha256') != digest:
        raise RuntimeError('Saved state belongs to a different plan')
    if 'pending' in state:
        raise RuntimeError('Uncertain previous operation: stop for read-only reconciliation; never repeat automatically')
    completed = state.get('completed', [])
    if completed != list(range(len(completed))) or len(completed) > 4:
        raise RuntimeError('Invalid operation journal')
    expected_names = ['clientAccount', 'endCustomer', 'interaction'][:min(len(completed), 3)]
    if set(state['created']) != set(expected_names):
        raise RuntimeError('Created-id journal mismatch')
    for value in state['created'].values():
        UUID(value)
    for i, op in enumerate(plan['operations']):
        if i in completed:
            continue
        route = resolve(op['path'], state['created'])
        body = resolve(op['body'], state['created'])
        # Before creating relations or updating, verify the recorded parents are DEV-owned.
        parents = ['clientAccount'] if i == 1 else ['clientAccount', 'endCustomer'] if i >= 2 else []
        for parent in parents:
            index = 0 if parent == 'clientAccount' else 1
            collection = plan['operations'][index]['path'].split('/')[2]
            record_id = state['created'][parent]
            record = unwrap(api('GET', '/rest/' + collection + '/' + record_id), collection, 'get')
            if record['id'] != record_id or record.get('name') != plan['operations'][index]['body']['name']:
                raise RuntimeError('Recorded parent is not the expected DEV test record')
            if parent == 'endCustomer' and record.get('clientAccountId') != state['created']['clientAccount']:
                raise RuntimeError('DEV lead account ownership mismatch')
        state['pending'] = i
        save_state(path, state)
        # No retry: timeouts/invalid responses leave pending set and stop future writes.
        response = api(op['method'], route, body)
        collection = op['path'].split('/')[2]
        record = unwrap(response, collection, 'create' if op['method'] == 'POST' else 'update')
        if op['method'] == 'POST':
            if record.get('name') != body['name']:
                raise RuntimeError('Unexpected created DEV name; stop without retry')
            state['created'][op['saveIdAs']] = record['id']
        elif record['id'] != state['created']['endCustomer']:
            raise RuntimeError('Unexpected updated record; stop')
        state['completed'].append(i)
        del state['pending']
        save_state(path, state)
    return state


def request(method, path, body=None):
    # Fixed host and allowlisted object paths. No arbitrary API, DELETE, calls or messaging.
    pattern = r'/rest/(clientAccounts|endCustomers|customerInteractions)(/[0-9a-fA-F-]{36})?'
    if method not in {'GET', 'POST', 'PATCH'} or not re.fullmatch(pattern, path):
        raise RuntimeError('Disallowed Twenty request')
    req = urllib.request.Request(BASE + path, method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={'Authorization': 'Bearer ' + os.environ['TWENTY_API_KEY'], 'Content-Type': 'application/json'})
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *args, **kwargs):
            return None
    try:
        with urllib.request.build_opener(NoRedirect()).open(req, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        raise RuntimeError('Twenty request failed: HTTP ' + str(error.code)) from None
    except Exception:
        raise RuntimeError('Twenty transport/response failed; no automatic retry') from None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--approved-plan-sha256')
    args = parser.parse_args()
    plan = json.loads(PLAN.read_text())
    validate_plan(plan)
    if not args.apply:
        print(json.dumps(plan, indent=2))
        print('PLAN_SHA256=' + plan_hash(plan))
        print('DRY RUN ONLY: no API request or write performed. Explicit Abdullah approval required before --apply.')
        return
    if subprocess.check_output(['git', 'branch', '--show-current'], cwd=ROOT, text=True).strip() != 'dev/codex-setup':
        raise RuntimeError('Apply requires dev/codex-setup')
    target = urlparse(os.environ.get('DEV_PORTAL_URL', ''))
    if target.scheme != 'https' or target.hostname != 'dev.kyneticai.com' or target.username or target.password:
        raise RuntimeError('Apply requires DEV_PORTAL_URL')
    if not os.environ.get('TWENTY_API_KEY'):
        raise RuntimeError('TWENTY_API_KEY is required')
    state = apply_plan(plan, args.approved_plan_sha256, STATE, request)
    print('PASS synthetic Twenty test writeback; completed operations: ' + str(len(state['completed'])))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # Only our safe messages are printed, never response bodies or credentials.
        if isinstance(error, RuntimeError):
            raise SystemExit(str(error)) from None
        raise SystemExit('Plan/state validation failed; no automatic retry') from None
