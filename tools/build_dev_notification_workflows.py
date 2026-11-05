#!/usr/bin/env python3
"""Build inactive synthetic notification workflows from the reviewed local Code source. No API calls."""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
folder = ROOT / 'n8n/workflows/dev'
code = (folder / 'notification-prepare.js').read_text()
for kind in ['missed-call', 'reminder', 'owner-alert', 'error-alert']:
    prepare = 'Prepare ' + kind + ' stub'
    dispatch = 'SMS to TEST_PHONE - disabled'
    workflow = {
        'name': 'DEV - ' + kind, 'active': False, 'tags': [{'name': 'DEV'}],
        'nodes': [
            {'id': 'manual', 'name': 'Manual synthetic input', 'type': 'n8n-nodes-base.manualTrigger', 'typeVersion': 1, 'position': [0, 0], 'parameters': {}},
            {'id': 'prepare', 'name': prepare, 'type': 'n8n-nodes-base.code', 'typeVersion': 2, 'position': [240, 0], 'parameters': {'mode': 'runOnceForAllItems', 'jsCode': "const KIND = '" + kind + "';\n" + code}},
            {'id': 'sms-disabled', 'name': dispatch, 'type': 'n8n-nodes-base.twilio', 'typeVersion': 1, 'position': [480, 0], 'disabled': True, 'parameters': {'resource': 'sms', 'operation': 'send', 'from': '={{ $env.DEV_TWILIO_FROM }}', 'to': '={{ $env.TEST_PHONE }}', 'message': '={{ $json.request.Body }}', 'options': {}}, 'retryOnFail': False},
            {'id': 'stub-result', 'name': 'Record stub result only', 'type': 'n8n-nodes-base.code', 'typeVersion': 2, 'position': [720, 0], 'parameters': {'mode': 'runOnceForAllItems', 'jsCode': "return $input.all().map(item => ({ json: { ...item.json, provider_requests: 0, delivered: false } }));"}},
            {'id': 'safety-note', 'name': 'DEV safety contract', 'type': 'n8n-nodes-base.stickyNote', 'typeVersion': 1, 'position': [200, 220], 'parameters': {'content': 'STUB ONLY. Do not activate or enable SMS. Gate snapshots are test inputs, never permits. A real send must use the portal server sendSms/OutboundGate immediately before dispatch, a TEST_PHONE-only DEV adapter and explicit Abdullah approval. No credentials are attached. Confirmed-booking events only; reminders need explicit due/expiry times. Alerts redact event content.'}}
        ],
        'connections': {'Manual synthetic input': {'main': [[{'node': prepare, 'type': 'main', 'index': 0}]]}, prepare: {'main': [[{'node': dispatch, 'type': 'main', 'index': 0}]]}, dispatch: {'main': [[{'node': 'Record stub result only', 'type': 'main', 'index': 0}]]}},
        'settings': {'executionOrder': 'v1', 'saveDataSuccessExecution': 'none', 'saveDataErrorExecution': 'none', 'saveManualExecutions': False}
    }
    (folder / (kind + '.json')).write_text(json.dumps(workflow, indent=2) + '\n')
print('Built four inactive DEV stub workflows; no remote changes or deliveries')
