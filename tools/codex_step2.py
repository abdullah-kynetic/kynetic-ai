#!/usr/bin/env python3
"""Provision NEW isolated step-2 resources. No calls, bookings, activation or existing-resource edits."""
import argparse
import base64
import hashlib
import json
import os
import subprocess
from pathlib import Path
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
LIVE = 'agent_8201m5afn2rbeb7v29xfkhh1pjef'
STATE = ROOT / 'docs/codex/dev-resources.json'


def api(base, path, headers, method='GET', data=None, form=False):
    encoded = None
    if data is not None:
        encoded = urllib.parse.urlencode(data).encode() if form else json.dumps(data).encode()
    req = urllib.request.Request(base + path, data=encoded, method=method, headers={
        **headers, 'Content-Type': 'application/x-www-form-urlencoded' if form else 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        # Provider messages can echo credentials/phone numbers. Print only safe status/code.
        try:
            raw = json.load(error)
            code = raw.get('code') if isinstance(raw, dict) else None
            code = code if isinstance(code, int) else None
        except Exception:
            code = None
        raise RuntimeError(f'{method} provider request failed: HTTP {error.code}, code {code}') from None


def fingerprint(agent):
    fields = {k: agent.get(k) for k in ['name', 'conversation_config', 'platform_settings', 'workflow', 'phone_numbers', 'branch_id', 'version_id']}
    return hashlib.sha256(json.dumps(fields, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    if not args.apply:
        print('Plan: create DEV agent, inactive DEV workflow, NEW DEV Twilio number and import it to Blitz; disable inbound/SMS on the new number. No calls or bookings. Existing resources unchanged.')
        return
    branch = subprocess.run(['git', 'branch', '--show-current'], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()
    if branch != 'dev/codex-setup':
        raise RuntimeError('Provisioning is allowed only from dev/codex-setup')
    for key in ['ELEVENLABS_API_KEY_blitz', 'n8n_vps', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TEST_PHONE']:
        if not os.environ.get(key):
            raise RuntimeError('Missing env variable: ' + key)
    state = json.loads(STATE.read_text())
    step = state.setdefault('step2', {})
    def save():
        STATE.write_text(json.dumps(state, indent=2) + '\n')
    el_headers = {'xi-api-key': os.environ['ELEVENLABS_API_KEY_blitz']}
    n8n_headers = {'X-N8N-API-KEY': os.environ['n8n_vps']}
    tw_headers = {'Authorization': 'Basic ' + base64.b64encode((os.environ['TWILIO_ACCOUNT_SID'] + ':' + os.environ['TWILIO_AUTH_TOKEN']).encode()).decode()}
    el = lambda path, **kw: api('https://api.elevenlabs.io', path, el_headers, **kw)
    n8n = lambda path, **kw: api('https://n8n.kyneticai.com/api/v1', path, n8n_headers, **kw)
    tw = lambda path, **kw: api('https://api.twilio.com/2010-04-01/Accounts/' + os.environ['TWILIO_ACCOUNT_SID'], path, tw_headers, **kw)
    before = fingerprint(el('/v1/convai/agents/' + LIVE))
    step['live_config_fingerprint_before'] = before
    save()
    if not step.get('agent_id'):
        template = json.loads((ROOT / 'providers/elevenlabs/templates/alex.json').read_text())
        if not template['name'].startswith('DEV-') or LIVE in json.dumps(template):
            raise RuntimeError('Unsafe agent template')
        new = el('/v1/convai/agents/create', method='POST', data=template)
        step['agent_id'] = new['agent_id']
        save()
        print('Created NEW DEV-Alex Step2 Synthetic on Blitz')
    agent = el('/v1/convai/agents/' + step['agent_id'])
    if not agent.get('name', '').startswith('DEV-') or step['agent_id'] == LIVE:
        raise RuntimeError('Refusing non-DEV agent')
    if not step.get('workflow_id'):
        wf = json.loads((ROOT / 'n8n/workflows/dev/elevenlabs-speed-to-lead.json').read_text())
        existing = n8n('/workflows?limit=100')['data']
        if any(w.get('name') == wf['name'] for w in existing):
            raise RuntimeError('Unrecorded matching workflow exists; refusing to edit')
        new = n8n('/workflows', method='POST', data={k: wf[k] for k in ['name', 'nodes', 'connections', 'settings']})
        step['workflow_id'] = new['id']
        save()
        tags = n8n('/tags?limit=100')['data']
        tag = next((t for t in tags if t['name'] == 'DEV'), None) or n8n('/tags', method='POST', data={'name': 'DEV'})
        n8n('/workflows/' + new['id'] + '/tags', method='PUT', data=[{'id': tag['id']}])
        print('Created new DEV - ElevenLabs Speed to Lead, inactive and DEV tagged')
    workflow = n8n('/workflows/' + step['workflow_id'])
    if workflow['active'] or not workflow['name'].startswith('DEV -'):
        raise RuntimeError('Workflow is not an inactive DEV resource')
    if not step.get('twilio_number_sid'):
        candidates = tw('/AvailablePhoneNumbers/US/Local.json?VoiceEnabled=true&PageSize=1')['available_phone_numbers']
        if not candidates:
            raise RuntimeError('No new US voice number available')
        # A brand-new dedicated dev number, never reuse TWILIO_FROM or any existing number.
        new = tw('/IncomingPhoneNumbers.json', method='POST', form=True, data={
            'PhoneNumber': candidates[0]['phone_number'], 'FriendlyName': 'DEV - Codex Alex Step2',
            'VoiceUrl': '', 'SmsUrl': ''})
        step['twilio_number_sid'] = new['sid']
        save()
        print('Provisioned NEW DEV Twilio voice number (number not printed)')
    number = tw('/IncomingPhoneNumbers/' + step['twilio_number_sid'] + '.json')
    if not number.get('friendly_name', '').startswith('DEV -'):
        raise RuntimeError('Refusing non-DEV caller number')
    if not step.get('phone_number_id'):
        new = el('/v1/convai/phone-numbers', method='POST', data={
            'phone_number': number['phone_number'], 'label': 'DEV - Codex Alex Step2',
            'provider': 'twilio', 'sid': os.environ['TWILIO_ACCOUNT_SID'],
            'token': os.environ['TWILIO_AUTH_TOKEN'], 'agent_id': step['agent_id'],
            'supports_inbound': False, 'supports_outbound': True, 'enable_sms': False})
        step['phone_number_id'] = new['phone_number_id']
        save()
        print('Imported only the NEW DEV number to Blitz and assigned the NEW DEV agent')
    # Import can configure Twilio inbound hooks. Clear hooks on this new owned number only.
    tw('/IncomingPhoneNumbers/' + step['twilio_number_sid'] + '.json', method='POST', form=True,
       data={'VoiceUrl': '', 'VoiceFallbackUrl': '', 'VoiceApplicationSid': '', 'SmsUrl': '', 'SmsFallbackUrl': '', 'SmsApplicationSid': ''})
    checked = tw('/IncomingPhoneNumbers/' + step['twilio_number_sid'] + '.json')
    if any(checked.get(k) for k in ['voice_url', 'voice_application_sid', 'sms_url', 'sms_application_sid']):
        raise RuntimeError('New number inbound hooks were not cleared')
    phone = el('/v1/convai/phone-numbers/' + step['phone_number_id'])
    if (phone.get('assigned_agent') or {}).get('agent_id') != step['agent_id']:
        raise RuntimeError('DEV phone assignment not verified')
    after = fingerprint(el('/v1/convai/agents/' + LIVE))
    step['live_config_fingerprint_after'] = after
    step['live_config_unchanged'] = before == after
    step['inbound_hooks_disabled'] = True
    step['workflow_active'] = False
    save()
    if before != after:
        raise RuntimeError('Live configuration fingerprint changed; investigate read-only')
    print('PASS new DEV resources verified; live Alex configuration unchanged; no calls/bookings/messages/activation')


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, urllib.error.URLError, KeyError) as error:
        # Avoid tracebacks/request objects that might carry authentication headers.
        print(str(error) if isinstance(error, RuntimeError) else 'Provisioning failed: ' + type(error).__name__)
        raise SystemExit(1)
