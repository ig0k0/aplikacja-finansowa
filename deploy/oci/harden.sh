#!/usr/bin/env bash
# Utwardzenie VM Oracle Cloud + instalacja Dockera.
# Obslugiwane: Oracle Linux 8/9 (uzytkownik `opc`) oraz Ubuntu 22.04/24.04 (`ubuntu`),
# ARM64 (A1) lub x86. Uruchom jako zwykly uzytkownik z sudo:
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
case "${ID:-}" in
  ubuntu) OS=ubuntu ;;
  ol|rhel|almalinux|rocky|centos) OS=rhel ;;
  *) die "Nieobslugiwany system: ${PRETTY_NAME:-?}. Obslugiwane: Oracle Linux 8/9, Ubuntu 22.04/24.04." ;;
esac
OS_MAJOR="${VERSION_ID%%.*}"

OPERATOR_HOME="$(getent passwd "$OPERATOR" | cut -d: -f6)"
if [[ ! -s "$OPERATOR_HOME/.ssh/authorized_keys" ]]; then
  die "$OPERATOR nie ma $OPERATOR_HOME/.ssh/authorized_keys — wylaczenie hasel odcieloby dostep. Przerwano."
fi
if [[ "$(id -u "$OPERATOR")" != "1000" ]]; then
  warn "$OPERATOR ma uid $(id -u "$OPERATOR"), a proces w kontenerze uid 1000 — katalog backupu dostanie wlasciciela 1000."
fi

# ================================================================ pakiety + auto-aktualizacje
if [[ $OS == ubuntu ]]; then
  export DEBIAN_FRONTEND=noninteractive
  log "Aktualizacja systemu i instalacja pakietow bezpieczenstwa (apt)"
  apt-get update -y
  apt-get -o Dpkg::Options::=--force-confold full-upgrade -y
  apt-get install -y --no-install-recommends \
    ca-certificates curl gnupg git openssl jq \
    fail2ban unattended-upgrades apt-listchanges needrestart \
    auditd iptables-persistent netfilter-persistent

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
else
  log "Aktualizacja systemu i instalacja pakietow bezpieczenstwa (dnf)"
  dnf -y upgrade --refresh
  dnf -y install curl git openssl jq tar audit policycoreutils-python-utils firewalld dnf-automatic dnf-plugins-core

  log "Repozytorium EPEL (dla fail2ban)"
  FAIL2BAN_OK=1
  if [[ "${ID}" == "ol" ]]; then
    dnf -y install "oracle-epel-release-el${OS_MAJOR}" \
      && dnf config-manager --enable "ol${OS_MAJOR}_developer_EPEL" \
      || FAIL2BAN_OK=0
  else
    dnf -y install epel-release || FAIL2BAN_OK=0
  fi
  if [[ $FAIL2BAN_OK == 1 ]]; then
    dnf -y install fail2ban-server fail2ban-firewalld fail2ban-systemd || FAIL2BAN_OK=0
  fi
  [[ $FAIL2BAN_OK == 1 ]] || warn "Nie udalo sie zainstalowac fail2ban (EPEL). Kontynuuje — SSH i tak przyjmuje tylko klucze."

  log "Automatyczne aktualizacje bezpieczenstwa (dnf-automatic)"
  conf=/etc/dnf/automatic.conf
  sed -i 's/^upgrade_type *=.*/upgrade_type = security/' "$conf"
  sed -i 's/^apply_updates *=.*/apply_updates = yes/' "$conf"
  if grep -q '^#\?reboot *=' "$conf"; then
    sed -i 's/^#\?reboot *=.*/reboot = when-needed/' "$conf"
  fi
  systemctl enable --now dnf-automatic.timer
fi

# ================================================================ SSH
log "Utwardzenie SSH (tylko klucze, bez roota, tylko $OPERATOR)"
# Nazwa 00-* — sshd bierze PIERWSZA wartosc, a obrazy chmurowe maja 50-/60-* z wlasnymi ustawieniami.
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
chmod 600 /etc/ssh/sshd_config.d/00-cfo-hardening.conf
[[ -x /usr/sbin/restorecon ]] && restorecon /etc/ssh/sshd_config.d/00-cfo-hardening.conf || true
if ! grep -qE '^\s*Include\s+/etc/ssh/sshd_config.d/' /etc/ssh/sshd_config; then
  warn "sshd_config nie wczytuje sshd_config.d — dopisuje Include na poczatku."
  sed -i '1i Include /etc/ssh/sshd_config.d/*.conf' /etc/ssh/sshd_config
fi
sshd -t || { rm -f /etc/ssh/sshd_config.d/00-cfo-hardening.conf; die "Bledna konfiguracja sshd — wycofano."; }
systemctl reload sshd 2>/dev/null || systemctl reload ssh 2>/dev/null || systemctl restart sshd

# ================================================================ fail2ban
if command -v fail2ban-server >/dev/null; then
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
  systemctl enable fail2ban >/dev/null
  systemctl restart fail2ban
fi

# ================================================================ firewall hosta
if [[ $OS == rhel ]]; then
  log "Firewall hosta (firewalld): otwarte tylko ssh, http, https"
  systemctl enable --now firewalld
  firewall-cmd --permanent --add-service=ssh >/dev/null
  firewall-cmd --permanent --add-service=http >/dev/null
  firewall-cmd --permanent --add-service=https >/dev/null
  firewall-cmd --permanent --add-port=443/udp >/dev/null
  # Usun uslugi otwarte domyslnie, ktorych aplikacja nie potrzebuje.
  for svc in cockpit dhcpv6-client; do
    firewall-cmd --permanent --remove-service="$svc" >/dev/null 2>&1 || true
  done
  firewall-cmd --reload >/dev/null
  firewall-cmd --list-services
else
  # Obrazy Ubuntu w OCI maja wlasne reguly iptables (/etc/iptables/rules.v4):
  # wpuszczaja tylko SSH i odrzucaja reszte. Oracle odradza UFW na tych obrazach,
  # wiec dopisujemy 80/443 do istniejacych regul zamiast je zastepowac.
  log "Firewall hosta (iptables): otwarcie 80/443 (reszta pozostaje zamknieta)"
  RULES=/etc/iptables/rules.v4
  if [[ -f "$RULES" ]] && grep -q -- '-A INPUT -j REJECT' "$RULES"; then
    for port in 80 443; do
      rule="-A INPUT -p tcp -m state --state NEW -m tcp --dport $port -j ACCEPT"
      if ! grep -qF -- "$rule" "$RULES"; then
        sed -i "0,/^-A INPUT -j REJECT/s//${rule}\n-A INPUT -j REJECT/" "$RULES"
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
fi

# ================================================================ sysctl
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
sysctl --system >/dev/null 2>&1 || warn "Niektore parametry sysctl nie sa obslugiwane przez to jadro — pominiete."

# ================================================================ swap (male VM)
MEM_MB=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
if (( MEM_MB < 3000 )) && ! swapon --show | grep -q .; then
  log "Mala ilosc RAM (${MEM_MB} MB) — tworze 2 GB swap (potrzebny do builda Next.js)"
  dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
  chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
fi

# ================================================================ Docker
if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
  log "Instalacja Docker Engine z oficjalnego repozytorium Dockera"
  if [[ $OS == ubuntu ]]; then
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
      >/etc/apt/sources.list.d/docker.list
    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  else
    # Podman/runc z systemu koliduja z containerd.io — --allowerasing je zastepuje.
    dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
    dnf -y install --allowerasing docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  fi
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

# ================================================================ katalogi
log "Katalogi /srv/cfo (app, backups, secrets)"
install -d -m 755 -o "$OPERATOR" -g "$OPERATOR" /srv/cfo
install -d -m 755 -o "$OPERATOR" -g "$OPERATOR" /srv/cfo/app
install -d -m 700 -o "$OPERATOR" -g "$OPERATOR" /srv/cfo/secrets
# Backupy zapisuje proces w kontenerze (uid 1000 = `node`).
install -d -m 700 -o 1000 -g 1000 /srv/cfo/backups

# ================================================================ audyt
systemctl enable --now auditd >/dev/null 2>&1 || true

log "Gotowe."
cat <<EOF

Nastepne kroki:
  1. NIE zamykaj tej sesji. W DRUGIM terminalu sprawdz: ssh $OPERATOR@<IP>
  2. Wyloguj sie i zaloguj ponownie (grupa docker), potem:
       cd /srv/cfo/app && bash deploy/oci/deploy.sh
EOF
if [[ -f /var/run/reboot-required ]] || { command -v needs-restarting >/dev/null && ! needs-restarting -r >/dev/null 2>&1; }; then
  warn "Wymagany restart po aktualizacji jadra: sudo reboot (po sprawdzeniu SSH)."
fi
