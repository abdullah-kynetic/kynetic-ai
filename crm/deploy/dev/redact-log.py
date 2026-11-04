#!/usr/bin/env python3
"""Keep generated dev credentials out of deployment diagnostics."""
import os
import sys

with open(sys.argv[1], encoding='utf-8') as source:
    secrets = [line.rstrip('\n').split('=', 1)[1] for line in source if '=' in line]
secrets = sorted((value for value in secrets if value), key=len, reverse=True)
fd = os.open(sys.argv[2], os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
with os.fdopen(fd, 'w', encoding='utf-8') as output:
    for line in sys.stdin:
        for secret in secrets:
            line = line.replace(secret, '[REDACTED]')
        output.write(line)
        output.flush()
