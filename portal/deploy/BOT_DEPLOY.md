# Deploying the portal with the deploy bot

Flow: someone edits the portal code and opens a PR, Abdullah merges it, then the deploy bot deploys the **merged commit on `main`**. An unmerged PR is never deployed (the server script refuses any commit that is not on `main`).

The bot runs on a different server from the portal VPS. It reaches the VPS with a dedicated `deploy` SSH key that can run exactly one command: the server-side script `portal-deploy.sh`. That script pulls the commit, rebuilds only the app container, health-checks it, and rolls back to the previous image if the new one is unhealthy.

Status: written Oct 18, 2026 from the scripts in this folder. **Untested end to end.** Supervise the first run and read `/var/log/portal-deploy.log` on the VPS afterwards.

## Rules for the bot

- Deploy only a full 40-character commit SHA that is on `main`. Never an unmerged branch or PR.
- Use only the `deploy` key below. Never the owner's personal SSH key, and never edit anything on the VPS by hand during a deploy.
- Read-only on GitHub for this job (view PRs and commits). Do not push, merge or edit portal code.
- Never print secrets or the contents of `/opt/portal/.env`.
- If a deploy fails, report the output and stop. Do not retry in a loop. The script rolls back by itself.

## Each deploy

1. **Get the merged commit.** Require `MERGED`; if it is not merged, stop and say so.

   ```bash
   gh pr view <PR_NUMBER> --repo abdullah-kynetic/kynetic-ai --json state,mergeCommit --jq '{state, sha: .mergeCommit.oid}'
   # or the latest main:
   gh api repos/abdullah-kynetic/kynetic-ai/commits/main --jq .sha
   ```

2. **Run the portal tests in a clean checkout, as a non-root user** (the embedded Postgres refuses to start as root). Stop if anything fails. About 4 minutes.

   ```bash
   gh repo clone abdullah-kynetic/kynetic-ai /tmp/portal-check && cd /tmp/portal-check && git checkout "$SHA"
   cd portal && npm ci && npx vitest run
   ```

3. **Check for database migrations.** If the PR touched `portal/drizzle/`, stop and ask Abdullah first. Migrations run when the container starts, and a rollback restores the old image but does **not** undo a migration. Take a database backup before continuing (see Backups in `portal/ADMIN.md`).

   ```bash
   gh pr diff <PR_NUMBER> --repo abdullah-kynetic/kynetic-ai --name-only | grep '^portal/drizzle/' || echo "no migrations"
   ```

4. **Deploy.**

   ```bash
   printf 'REF=%s\n' "$SHA" | ssh -i ~/.ssh/portal_deploy -o IdentitiesOnly=yes deploy@<vps-host>
   ```

   Success ends with `deploy OK <sha7>` and the health JSON. Failure prints the last build and app log lines and says whether the rollback is healthy.

5. **Report**: PR number, SHA, test result, the last lines of the deploy output, and the health result.

The script also accepts these optional `KEY=VALUE` lines on stdin (empty values are ignored, nothing else is allowed, and values cannot contain quotes, backslashes, `$` or backticks): `RESEND_API_KEY`, `EMAIL_FROM`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`. Only send them when Abdullah asks, and never log them.

## One-time server setup

Do this once, supervised. The steps are reconstructed from the comments and code in `portal-deploy.sh` and `portal-deploy-entry.sh`; check each one on the server before running it. Replace `<vps-host>` with the VPS address (see `portal/ADMIN.md`).

1. **Install the scripts, root-owned.** From a checkout of `main` on the bot's server:

   ```bash
   scp portal/deploy/portal-deploy.sh       ubuntu@<vps-host>:/tmp/portal-deploy.sh
   scp portal/deploy/portal-deploy-entry.sh ubuntu@<vps-host>:/tmp/portal-deploy-entry
   ```

   On the VPS:

   ```bash
   sudo install -m 0755 -o root -g root /tmp/portal-deploy.sh    /usr/local/sbin/portal-deploy
   sudo install -m 0755 -o root -g root /tmp/portal-deploy-entry /usr/local/sbin/portal-deploy-entry
   sudo touch /var/log/portal-deploy.log
   ```

2. **Create the `deploy` user and let it run only the deploy script.**

   ```bash
   sudo useradd -m -s /bin/bash deploy
   echo 'deploy ALL=(root) NOPASSWD: /usr/local/sbin/portal-deploy' | sudo tee /etc/sudoers.d/portal-deploy
   sudo chmod 440 /etc/sudoers.d/portal-deploy && sudo visudo -cf /etc/sudoers.d/portal-deploy
   ```

3. **Give the VPS a read-only GitHub key so it can pull the repo.**

   ```bash
   sudo install -d -m 700 /etc/portal-deploy
   sudo ssh-keygen -t ed25519 -N '' -C portal-vps-readonly -f /etc/portal-deploy/github_deploy_key
   sudo cat /etc/portal-deploy/github_deploy_key.pub
   ```

   Add that public key in GitHub: repo **Settings, Deploy keys, Add deploy key**, and leave **Allow write access unchecked**. Then record GitHub's host key for the script, and check the fingerprint against the ones GitHub publishes before trusting it:

   ```bash
   sudo sh -c 'ssh-keyscan -t ed25519 github.com > /etc/portal-deploy/known_hosts'
   sudo ssh-keygen -lf /etc/portal-deploy/known_hosts
   ```

4. **Create the bot's deploy key and restrict it to the one command.** On the bot's server:

   ```bash
   ssh-keygen -t ed25519 -N '' -C grokbot-portal-deploy -f ~/.ssh/portal_deploy
   cat ~/.ssh/portal_deploy.pub
   ```

   On the VPS, put that public key in `authorized_keys` with a forced command:

   ```bash
   sudo install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
   echo 'restrict,command="/usr/local/sbin/portal-deploy-entry" <PASTE THE PUBLIC KEY LINE HERE>' | sudo tee /home/deploy/.ssh/authorized_keys
   sudo chown deploy:deploy /home/deploy/.ssh/authorized_keys && sudo chmod 600 /home/deploy/.ssh/authorized_keys
   ```

5. **Check the VPS has what the script calls**: `git`, `rsync`, `docker` with the compose plugin, `flock`, `curl`, and the existing `/opt/portal` (with `.env` and `docker-compose.yml`) from the original install.

6. **First run, supervised.** Deploy the current `main` SHA with the command in step 4 of "Each deploy", watch the output, and read `sudo tail -n 40 /var/log/portal-deploy.log`. The first run clones the repo, so it takes longer.

## Prompt to give the bot for a deploy

> Deploy the Kynetic portal. Read `portal/deploy/BOT_DEPLOY.md` in `abdullah-kynetic/kynetic-ai` on `main` and follow "Each deploy" exactly for PR #`<number>`. Stop and tell me if the PR is not merged, if any test fails, or if the PR touched `portal/drizzle/`. Use only the `deploy` key. Do not retry on failure. Do not print secrets. When done, report the PR number, the commit SHA, the test result and the last lines of the deploy output.

## Prompt to give the bot for the one-time setup

> Set up the portal deploy path. Read `portal/deploy/BOT_DEPLOY.md` in `abdullah-kynetic/kynetic-ai` on `main` and follow "One-time server setup" one step at a time. Show me the output of each step, check each command against the server before running it, and stop at the GitHub step so I can add the deploy key (read-only) myself. Do not touch anything in `/opt/portal` other than what the script itself does.
