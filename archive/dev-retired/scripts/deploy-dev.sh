#!/usr/bin/env bash
# Retired 2026-11-09 PST. The separate DEV environment stays down until after go-live.
# Production deploys use the main build at portal.kyneticai.com, and only after an explicit yes.
# See docs/STATUS.md. The previous deployer is in git history.
echo 'DEV environment retired until after go-live (2026-11-09 PST). This script does not deploy. Production target is the main build at portal.kyneticai.com.' >&2
exit 1
