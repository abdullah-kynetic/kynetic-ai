#!/usr/bin/env python3
"""Read-only DEV runtime readiness. Never starts, restarts, deploys or executes a workflow."""
import json
import os
from pathlib import Path
import re
import subprocess

ROOT = Path('/opt/kynetic-dev-portal')
STATE = Path('/var/lib/kynetic-dev-portal')
PROJECT = 'kynetic-dev-portal'
DOCKER = ['docker', '--host=unix:///var/run/docker.sock']
SAFE_ENV_KEYS = ('provider_mode_stub', 'outbound_disabled', 'elevenlabs_live_disabled', 'persona_disabled', 'test_phone_configured')
NODE_CHECK = """const e=process.env;process.stdout.write(JSON.stringify({provider_mode_stub:e.PROVIDER_MODE==='stub',outbound_disabled:e.OUTBOUND_ENABLED==='false',elevenlabs_live_disabled:e.ELEVENLABS_LIVE_ENABLED==='false',persona_disabled:e.DEV_PERSONA_SWITCHING==='false',test_phone_configured:/^\\+[1-9]\\d{7,14}$/.test(e.TEST_PHONE||'')}));"""


def run(args):
    env = {key: value for key, value in os.environ.items() if key not in {'DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH'}}
    result = subprocess.run(args, capture_output=True, text=True, timeout=30, env=env)
    if result.returncode:
        raise RuntimeError('DEV runtime read command failed; raw diagnostics withheld')
    return result.stdout.strip()


def inspect_dev_container(container_id, runner):
    if not re.fullmatch(r'[a-f0-9]{12,64}', container_id):
        raise RuntimeError('Invalid DEV container selector')
    project = runner(DOCKER + ['inspect', '--format', '{{ index .Config.Labels "com.docker.compose.project" }}', container_id])
    if project != PROJECT:
        raise RuntimeError('Refusing a container outside the DEV project')
    values = json.loads(runner(DOCKER + ['exec', container_id, 'node', '-e', NODE_CHECK]))
    if any(type(values.get(key)) is not bool for key in SAFE_ENV_KEYS):
        raise RuntimeError('Invalid readiness response; raw values withheld')
    # Only allowlisted booleans are ever returned, never arbitrary environment keys/values.
    return {key: values[key] for key in SAFE_ENV_KEYS}


def readiness(root=ROOT, state=STATE, runner=run):
    revision = (state / 'deployed-revision').read_text().strip()
    if not re.fullmatch(r'[0-9a-f]{40}', revision):
        raise RuntimeError('Invalid DEV deployment revision')
    release = (root / 'current').resolve()
    if release != (root / 'releases' / revision).resolve():
        raise RuntimeError('DEV release pointer mismatch')
    compose = DOCKER + ['compose', '--project-name', PROJECT, '--env-file', str(state / 'dev.env'), '-f', str(release / 'crm/deploy/dev/compose.yml')]
    app = runner(compose + ['ps', '-q', 'app'])
    if not app:
        raise RuntimeError('DEV app is not running')
    app_env = inspect_dev_container(app, runner)
    if not all(app_env[key] for key in SAFE_ENV_KEYS if key != 'test_phone_configured'):
        raise RuntimeError('DEV runtime isolation check failed')
    worker = runner(compose + ['ps', '-q', 'worker'])
    blockers = []
    if not app_env['test_phone_configured']:
        blockers.append('TEST_PHONE_NOT_CONFIGURED_IN_DEV_APP')
    if not worker:
        blockers.append('DEV_DISPATCH_WORKER_NOT_RUNNING')
    else:
        worker_env = inspect_dev_container(worker, runner)
        if not all(worker_env[key] for key in SAFE_ENV_KEYS):
            blockers.append('DEV_WORKER_ENV_NOT_READY')
    return {'status': 'BLOCKED' if blockers else 'READY_FOR_SYNTHETIC_WORKER_VERIFICATION', 'deployed_revision': revision, 'project': PROJECT, 'app': app_env, 'worker_running': bool(worker), 'blockers': blockers, 'changes_made': False, 'provider_requests': 0, 'live_test_authorized': False}


if __name__ == '__main__':
    try:
        if os.geteuid() != 0:
            raise RuntimeError('Use the Mac helper with sudo for read-only DEV metadata')
        result = readiness()
        print('DEV_RUNTIME_READINESS ' + json.dumps(result, sort_keys=True))
        # BLOCKED is a useful diagnostic result, not authorization to enable sending.
    except Exception:
        raise SystemExit('FAIL DEV_RUNTIME_READINESS; no service change made; raw diagnostics withheld') from None
