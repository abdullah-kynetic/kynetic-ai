#!/bin/bash
# One-time installer, run on the VPS as root: sudo bash install.sh <dir with scripts and key.pub>
set -euo pipefail
D="${1:?dir}"
U=portalnew-deploy
id "$U" >/dev/null 2>&1 || useradd -m -s /bin/bash "$U"
passwd -l "$U" >/dev/null
install -o root -g root -m 0755 "$D/portal-new-deploy" /usr/local/sbin/portal-new-deploy
install -o root -g root -m 0755 "$D/portal-new-deploy-entry" /usr/local/sbin/portal-new-deploy-entry
install -d -m 0700 -o "$U" -g "$U" "/home/$U/.ssh"
printf 'restrict,command="/usr/local/sbin/portal-new-deploy-entry" %s\n' "$(cat "$D/key.pub")" >"/home/$U/.ssh/authorized_keys"
chown "$U:$U" "/home/$U/.ssh/authorized_keys"; chmod 600 "/home/$U/.ssh/authorized_keys"
cat >/etc/sudoers.d/portal-new-deploy.tmp <<EOF
$U ALL=(root) NOPASSWD: /usr/local/sbin/portal-new-deploy status, /usr/local/sbin/portal-new-deploy rollback, /usr/local/sbin/portal-new-deploy seed, /usr/local/sbin/portal-new-deploy deploy [0-9a-f]*
EOF
chmod 0440 /etc/sudoers.d/portal-new-deploy.tmp
visudo -cf /etc/sudoers.d/portal-new-deploy.tmp
mv /etc/sudoers.d/portal-new-deploy.tmp /etc/sudoers.d/portal-new-deploy
touch /var/log/portal-new-deploy.log; chmod 640 /var/log/portal-new-deploy.log
echo INSTALL_OK
