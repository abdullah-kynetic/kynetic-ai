#!/bin/bash
# Forced command for the `deploy` user's SSH key. Installed as /usr/local/sbin/portal-deploy-entry.
# Ignores whatever the client asked to run; only ever runs the deploy script (stdin is passed through).
exec sudo -n /usr/local/sbin/portal-deploy
