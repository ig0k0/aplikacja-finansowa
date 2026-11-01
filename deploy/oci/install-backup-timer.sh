#!/usr/bin/env bash
# Instaluje systemd timer z codziennym backupem o 03:15.
#   sudo bash deploy/oci/install-backup-timer.sh
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo "Uruchom przez sudo." >&2; exit 1; }

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OPERATOR="${OPERATOR:-${SUDO_USER:?Uruchom przez sudo jako operator}}"

cat >/etc/systemd/system/cfo-backup.service <<EOF
[Unit]
Description=Encrypted CFO backup (local + optional Google Drive)
Wants=network-online.target
After=network-online.target docker.service
Requires=docker.service

[Service]
Type=oneshot
User=$OPERATOR
Group=$OPERATOR
WorkingDirectory=$REPO_DIR
ExecStart=/usr/bin/env bash $REPO_DIR/deploy/oci/backup.sh
EOF

cat >/etc/systemd/system/cfo-backup.timer <<'EOF'
[Unit]
Description=Daily CFO encrypted backup

[Timer]
OnCalendar=*-*-* 03:15:00
Persistent=true
RandomizedDelaySec=10m

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now cfo-backup.timer
echo "Test teraz:  sudo systemctl start cfo-backup.service && journalctl -u cfo-backup.service -n 30 --no-pager"
systemctl list-timers cfo-backup.timer --no-pager
