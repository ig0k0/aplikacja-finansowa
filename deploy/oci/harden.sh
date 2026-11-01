#!/usr/bin/env bash
# Utwardzenie VM Oracle Cloud (Ubuntu 22.04/24.04, ARM64 lub x86) + instalacja Dockera.
# Uruchom na VM jako zwykly uzytkownik z sudo (np. `ubuntu`):
#   sudo bash deploy/oci/harden.sh
#
# Skrypt jest idempotentny — mozna go uruchamiac wielokrotnie.
# NIE zamykaj biezacej sesji SSH, dopoki nie sprawdzisz logowania w drugim terminalu.
set -euo pipefail

log() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m[!] %s\033[0m\n' "$*" >&2; }
die() { printf '\033[1;31m[x] %s\033[0m\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Uruchom przez sudo: sudo bash $0"

OPERATOR="${OPERATOR:-${SUDO_USER:-}}"
[[ -n "$OPERATOR" && "$OPERATOR" != "root" ]] || die "Nie ustalono operatora. Uruchom przez sudo jako zwykly uzytkownik albo ustaw OPERATOR=nazwa."
id "$OPERATOR" >/dev/null 2>&1 || die "Uzytkownik $OPERATOR nie istnieje."

. /etc/os-release
[[ "${ID:-}" == "ubuntu" ]] || die "Skrypt obsluguje Ubuntu (wykryto: ${PRETTY_NAME:-?}). Zobacz docs/14_ORACLE_CLOUD_SECURITY_RUNBOOK.md."

OPERATOR_HOME="$(getent passwd "$OPERATOR" | cut -d: -f6)"
if [[ ! -s "$OPERATOR_HOME/.ssh/authorized_keys" ]]; then
  die "$OPERATOR nie ma $OPERATOR_HOME/.ssh/authorized_keys — wylaczenie hasel odcieloby dostep. Przerwano."
fi

export DEBIAN_FRONTEND=noninteractive

# ---------------------------------------------------------------- pakiety
log "Aktualizacja systemu i instalacja pakietow bezpieczenstwa"
apt-get update -y
apt-get -o Dpkg::Options::=--force-confold full-upgrade -y
apt-get install -y --no-install-recommends \
  ca-certificates curl gnupg git openssl jq \
  fail2ban unattended-upgrades apt-listchanges needrestart \
  auditd iptables-persistent netfilter-persistent

# ---------------------------------------------------------------- auto-aktualizacje
log "Automatyczne aktualizacje bezpieczenstwa"
cat >/etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Download-Upgradeable-Packages "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF
cat >/etc/apt/apt.conf.d/52cfo-unattended <<'EOF'
// Restart w nocy tylko gdy aktualizacja jadra tego wymaga.
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:30";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
EOF
systemctl enable --now unattended-upgrades

# ---------------------------------------------------------------- SSH
log "Utwardzenie SSH (tylko klucze, bez roota, tylko $OPERATOR)"
# Nazwa 00-* — sshd bierze PIERWSZA wartosc, a obrazy chmurowe maja 50-/60-cloudimg-*.
cat >/etc/ssh/sshd_config.d/00-cfo-hardening.conf <<EOF
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitEmptyPasswords no
PubkeyAuthentication yes
AuthenticationMethods publickey
AllowUsers $OPERATOR
MaxAuthTries 3
MaxSessions 4
LoginGraceTime 30
ClientAliveInterval 300
ClientAliveCountMax 2
X11Forwarding no
AllowAgentForwarding no
AllowTcpForwarding local
PermitTunnel no
EOF
chmod 644 /etc/ssh/sshd_config.d/00-cfo-hardening.conf
sshd -t || { rm -f /etc/ssh/sshd_config.d/00-cfo-hardening.conf; die "Bledna konfiguracja sshd — wycofano."; }
systemctl reload ssh 2>/dev/null || systemctl reload sshd 2>/dev/null || systemctl restart ssh

# ---------------------------------------------------------------- fail2ban
log "fail2ban dla SSH"
cat >/etc/fail2ban/jail.d/cfo-sshd.local <<'EOF'
[DEFAULT]
bantime = 1h
bantime.increment = true
bantime.maxtime = 1w
findtime = 10m
maxretry = 4
backend = systemd

[sshd]
enabled = true
mode = aggressive
EOF
systemctl enable fail2ban
systemctl restart fail2ban

# ---------------------------------------------------------------- firewall hosta
# Obrazy Ubuntu w OCI maja wlasne reguly iptables (/etc/iptables/rules.v4):
# wpuszczaja tylko SSH i odrzucaja reszte. Oracle odradza UFW na tych obrazach,
# wiec dopisujemy 80/443 do istniejacych regul zamiast je zastepowac.
log "Firewall hosta: otwarcie 80/443 (reszta pozostaje zamknieta)"
RULES=/etc/iptables/rules.v4
if [[ -f "$RULES" ]] && grep -q -- '-A INPUT -j REJECT' "$RULES"; then
  for port in 80 443; do
    rule="-A INPUT -p tcp -m state --state NEW -m tcp --dport $port -j ACCEPT"
    if ! grep -qF -- "$rule" "$RULES"; then
      sed -i "0,/^-A INPUT -j REJECT/s//${rule//\//\\/}\n-A INPUT -j REJECT/" "$RULES"
    fi
  done
  udp_rule="-A INPUT -p udp -m udp --dport 443 -j ACCEPT"
  grep -qF -- "$udp_rule" "$RULES" || sed -i "0,/^-A INPUT -j REJECT/s//${udp_rule}\n-A INPUT -j REJECT/" "$RULES"
else
  warn "Brak standardowych regul OCI w $RULES — dodaje minimalny zestaw."
  mkdir -p /etc/iptables
  cat >"$RULES" <<'EOF'
*filter
:INPUT ACCEPT [0:0]
:FORWARD ACCEPT [0:0]
:OUTPUT ACCEPT [0:0]
-A INPUT -m state --state RELATED,ESTABLISHED -j ACCEPT
-A INPUT -p icmp -j ACCEPT
-A INPUT -i lo -j ACCEPT
-A INPUT -p udp --sport 123 -j ACCEPT
-A INPUT -p tcp -m state --state NEW -m tcp --dport 22 -j ACCEPT
-A INPUT -p tcp -m state --state NEW -m tcp --dport 80 -j ACCEPT
-A INPUT -p tcp -m state --state NEW -m tcp --dport 443 -j ACCEPT
-A INPUT -p udp -m udp --dport 443 -j ACCEPT
-A INPUT -j REJECT --reject-with icmp-host-prohibited
COMMIT
EOF
fi
# Zastosuj na zywo bez flush (nie kasuje regul Dockera).
for port in 80 443; do
  iptables -C INPUT -p tcp -m state --state NEW -m tcp --dport "$port" -j ACCEPT 2>/dev/null \
    || iptables -I INPUT 1 -p tcp -m state --state NEW -m tcp --dport "$port" -j ACCEPT
done
iptables -C INPUT -p udp -m udp --dport 443 -j ACCEPT 2>/dev/null \
  || iptables -I INPUT 1 -p udp -m udp --dport 443 -j ACCEPT
systemctl enable netfilter-persistent >/dev/null 2>&1 || true
if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
  warn "UFW jest aktywny — na obrazach OCI koliduje z regulami iptables. Rozwaz: sudo ufw disable"
fi

# ---------------------------------------------------------------- sysctl
log "Parametry jadra (sysctl)"
cat >/etc/sysctl.d/90-cfo-hardening.conf <<'EOF'
net.ipv4.tcp_syncookies = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.secure_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.default.accept_source_route = 0
net.ipv4.conf.all.log_martians = 1
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv6.conf.all.accept_redirects = 0
net.ipv6.conf.default.accept_redirects = 0
kernel.kptr_restrict = 2
kernel.dmesg_restrict = 1
kernel.unprivileged_bpf_disabled = 1
kernel.yama.ptrace_scope = 1
fs.protected_hardlinks = 1
fs.protected_symlinks = 1
fs.suid_dumpable = 0
EOF
sysctl --system >/dev/null

# ---------------------------------------------------------------- swap (male VM)
MEM_MB=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
if (( MEM_MB < 3000 )) && ! swapon --show | grep -q .; then
  log "Mala ilosc RAM (${MEM_MB} MB) — tworze 2 GB swap (potrzebny do builda Next.js)"
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
fi

# ---------------------------------------------------------------- Docker
if ! command -v docker >/dev/null; then
  log "Instalacja Docker Engine z oficjalnego repozytorium Dockera"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    >/etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

log "Konfiguracja demona Dockera (rotacja logow, no-new-privileges)"
mkdir -p /etc/docker
cat >/etc/docker/daemon.json <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" },
  "no-new-privileges": true,
  "live-restore": true,
  "userland-proxy": false
}
EOF
systemctl enable docker >/dev/null
systemctl restart docker
# Grupa docker = de facto root. Dodajemy tylko operatora wdrozen.
usermod -aG docker "$OPERATOR"

# ---------------------------------------------------------------- katalogi
log "Katalogi /srv/cfo (app, backups, secrets)"
install -d -m 755 -o "$OPERATOR" -g "$OPERATOR" /srv/cfo
install -d -m 755 -o "$OPERATOR" -g "$OPERATOR" /srv/cfo/app
install -d -m 700 -o "$OPERATOR" -g "$OPERATOR" /srv/cfo/secrets
# Backupy zapisuje proces w kontenerze (uid 1000 = `node`).
install -d -m 700 -o 1000 -g 1000 /srv/cfo/backups

# ---------------------------------------------------------------- audyt
systemctl enable --now auditd >/dev/null 2>&1 || true

log "Gotowe."
cat <<EOF

Nastepne kroki:
  1. NIE zamykaj tej sesji. W DRUGIM terminalu sprawdz: ssh $OPERATOR@<IP>
  2. Wyloguj sie i zaloguj ponownie (grupa docker), potem:
       bash deploy/oci/deploy.sh
  3. W konsoli OCI (VCN -> Security List / NSG) otworz TCP 80 i 443 z 0.0.0.0/0,
     a TCP 22 ogranicz do swojego IP (/32).
EOF
if [[ -f /var/run/reboot-required ]]; then
  warn "Wymagany restart po aktualizacji jadra: sudo reboot (po sprawdzeniu SSH)."
fi
