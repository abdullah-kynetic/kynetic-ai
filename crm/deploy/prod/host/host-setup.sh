#!/usr/bin/env bash
# One-time hardening for the VPS (ARCHITECTURE "Network"). Run by hand as root, after reading it. It changes
# live-system settings (firewall, sshd), so Abdullah approves the run first and keeps a second SSH session open.
#   - ufw: deny incoming; allow 22 (SSH) and 80; 443 only from Cloudflare (update-cloudflare-ips.sh)
#   - sshd: key only, no root login
#   - fail2ban, unattended security updates
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }

apt-get update -qq
apt-get install -y -qq ufw fail2ban unattended-upgrades

cat >/etc/ssh/sshd_config.d/10-kynetic-crm.conf <<'CONF'
PasswordAuthentication no
PermitRootLogin no
KbdInteractiveAuthentication no
CONF
sshd -t && systemctl reload ssh

ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'ssh'
ufw allow 80/tcp comment 'http (redirect only)'
ufw --force enable
systemctl enable --now fail2ban
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "next: run host/update-cloudflare-ips.sh to open 443 to Cloudflare"
# Note: Docker publishes ports around ufw. compose.yml binds only 80, 443 and loopback 3001; if the host later
# needs stricter control, add rules to the DOCKER-USER chain (README "Firewall and Docker").
