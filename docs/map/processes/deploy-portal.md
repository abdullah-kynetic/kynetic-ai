---
type: process
status: verified
consumes: [portal-deploy]
produces: [portal-deploy]
verified_on: 2026-10-22
verified_at: 5888b13
---

# deploy-portal

Ship a merged `main` commit of `portal/` to the VPS.

## Input -> Movement -> Output
Input: a 40-character sha plus optional allowed env keys on stdin. Movement: the server script checks the sha is on `main`, rsyncs `portal/` to `/opt/portal/src`, builds, restarts `portal-app`, health-checks, rolls back on failure. Output: new image live, previous image tagged.

## Steps (`portal/deploy/portal-deploy.sh`)
1. Fetch `main`; refuse a sha that is not an ancestor (`:59`).
2. Tag the current image as `previous`; back up `.env` (`:62-70`).
3. `rsync --delete` the folder, copy `docker-compose.yml` (`:74-75`); update only allowed env keys (`:18`).
4. Build, restart, wait for `/api/health`; roll back if unhealthy.

## If you change this
- **Hits:** [[portal-deploy]], D-022, KI-010. The deploy scripts on the server are separate copies; the trigger (bot or Action) is outside the repo.
