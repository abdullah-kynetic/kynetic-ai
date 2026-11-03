# portal-new restricted deploy tooling

Scripts for deploying the `portal-new` Compose project on the OVH VPS (`/opt/portal-new`) through one
restricted SSH key, instead of a personal login. Nothing here is installed yet; this folder is for review.

| File | Installed at | Purpose |
| --- | --- | --- |
| `portal-new-deploy-entry` | `/usr/local/sbin/portal-new-deploy-entry` | SSH forced command. Accepts only `status`, `rollback`, `seed`, `deploy <40-hex sha>`. |
| `portal-new-deploy` | `/usr/local/sbin/portal-new-deploy` | Root-owned worker. Backup, build, migrate, switch app and worker only, health check, auto rollback. |
| `install.sh` | run once as root | Creates user `portalnew-deploy`, installs the scripts, authorized_keys line, sudoers rule, log file. |

## authorized_keys line (public key only)

```
restrict,command="/usr/local/sbin/portal-new-deploy-entry" ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAILkQNVRjlhR2jHl3r8PxcR2ew2JqhKHz4WgyAc9SKey9 kynetic-portal-new-deploy
```

## sudoers rule (`/etc/sudoers.d/portal-new-deploy`, mode 0440)

```
portalnew-deploy ALL=(root) NOPASSWD: /usr/local/sbin/portal-new-deploy status, /usr/local/sbin/portal-new-deploy rollback, /usr/local/sbin/portal-new-deploy seed, /usr/local/sbin/portal-new-deploy deploy [0-9a-f]*
```

## Notes for review

- The user's shell is `/bin/bash` because sshd runs a forced command through the user's shell; `restrict` plus the
  forced command stop any normal login, and the password is locked.
- Migrations are forward-only. `rollback` restores the previous app and worker images, not the database; the
  pre-deploy dump in `/var/backups` is the database restore path (ask before using it).
- `seed` runs `bun run db:seed:prospects` after a dump. It skips existing tenants and never deletes.
- Never touched: Caddy, DNS, Twenty, n8n, Kien, the legacy portal, secrets, Postgres data beyond migrations.
  Never uses `--remove-orphans`.
- The private key lives only on Abdullah's Mac (`~/.ssh/kynetic-portal-new-deploy`). It is never committed.
- **Trust:** whoever holds this key can ship any code to the portal, which runs with the portal's database
  credentials and secrets. That is inherent to a deploy key. It is restricted away from the rest of the server
  (n8n, Twenty, Kien, Caddy, DNS), not from the portal itself.
- **Tar safety:** the deploy tar is saved to a file first and refused if it holds anything other than plain files
  and directories (symlinks, hardlinks, devices) or any absolute or `..` path, before it is extracted as root.
  A failed deploy removes its half-built `src-<tag>` folder so the same commit can be retried; a `src-<tag>`
  folder that existed before the run is never deleted.
- **Seed:** `seed` only works after a deploy of a commit that includes PR #127. Live is still `7eea4129`, which has
  no `db:seed:prospects` script. The live database already holds a different 13 businesses, so running the PR #127
  seed as is would add 13 more (26 in total). Do not run `seed` until Abdullah decides.
