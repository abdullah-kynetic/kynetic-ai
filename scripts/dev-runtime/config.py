#!/usr/bin/env python3
"""DEV-only runtime override; the phone value is read from env and never printed."""
import json
import os
from pathlib import Path
import re
import sys


DEFAULT_COMPOSE = Path('/opt/kynetic-dev-portal/current/crm/deploy/dev/compose.yml')


def configure(state, base_compose=DEFAULT_COMPOSE):
    phone = os.environ.get('TEST_PHONE', '')
    if not re.fullmatch(r'\+[1-9]\d{7,14}', phone):
        raise RuntimeError('TEST_PHONE must be E.164; no configuration changed')
    path = state / 'dev.env'
    if path.is_symlink() or not path.is_file():
        raise RuntimeError('Expected regular private DEV env file')
    lines = path.read_text().splitlines()
    if lines.count('APP_BASE_URL=https://dev.kyneticai.com') != 1:
        raise RuntimeError('Refusing a non-dev env file')
    if sum(line.startswith('TEST_PHONE=') for line in lines) > 1:
        raise RuntimeError('Duplicate TEST_PHONE entry')
    values = [line for line in lines if not line.startswith('TEST_PHONE=')]
    temporary = state / 'dev.env.runtime-tmp'
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w') as output:
        output.write('\n'.join(values) + '\nTEST_PHONE=' + phone + '\n')
    temporary.replace(path)
    path.chmod(0o600)
    flags = {'TEST_PHONE': '${TEST_PHONE:?set TEST_PHONE}', 'PROVIDER_MODE': 'stub', 'OUTBOUND_ENABLED': 'false', 'ELEVENLABS_LIVE_ENABLED': 'false', 'DEV_PERSONA_SWITCHING': 'false'}
    files = [str(state / name) + ':/app/src/server/leads/' + name + ':ro' for name in ['dev-runtime-worker.ts', 'dev-runtime-smoke.ts']]
    override = {'services': {
        'app': {'environment': flags},
        'worker': {'build': {'target': 'tools'}, 'entrypoint': ['bun', '/app/src/server/leads/dev-runtime-worker.ts'], 'command': [], 'working_dir': '/app', 'user': '1001:1001', 'init': True, 'restart': 'unless-stopped', 'environment': {**flags, 'NODE_ENV': 'production', 'BUN_RUNTIME_TRANSPILER_CACHE_PATH': '0'}, 'volumes': [files[0]], 'healthcheck': {'test': ['CMD', 'node', '-e', "process.exit(require('fs').existsSync('/tmp/kynetic-dev-synthetic-worker-ready')&&process.env.OUTBOUND_ENABLED==='false'?0:1)"], 'interval': '3s', 'timeout': '3s', 'retries': 20}},
        'runtime-smoke': {'extends': {'file': str(base_compose), 'service': 'verify-step3'}, 'profiles': ['verify'], 'entrypoint': ['bun', '/app/src/server/leads/dev-runtime-smoke.ts'], 'command': [], 'environment': flags, 'volumes': files}
    }}
    target = state / 'runtime-override.json'
    target.write_text(json.dumps(override, indent=2) + '\n')
    target.chmod(0o600)
    return override


if __name__ == '__main__':
    try:
        configure(Path('/var/lib/kynetic-dev-portal'))
        print('PASS DEV_RUNTIME_CONFIG TEST_PHONE configured (value hidden); provider stubs; outbound disabled')
    except Exception:
        raise SystemExit('DEV runtime configuration refused; raw values withheld') from None
