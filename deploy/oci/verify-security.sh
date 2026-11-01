#!/usr/bin/env bash
# Kontrola zabezpieczen po harden.sh. Niczego nie zmienia.
#   sudo bash deploy/oci/verify-security.sh
set -uo pipefail
[[ $EUID -eq 0 ]] || { echo "Uruchom przez sudo." >&2; exit 1; }

PASS=0; FAIL=0; WARN=0
ok()   { printf '  \033[1;32m[ OK ]\033[0m %s\n' "$*"; PASS=$((PASS+1)); }
bad()  { printf '  \033[1;31m[BLAD]\033[0m %s\n' "$*"; FAIL=$((FAIL+1)); }
note() { printf '  \033[1;33m[UWAGA]\033[0m %s\n' "$*"; WARN=$((WARN+1)); }
check() { local desc="$1"; shift; if "$@" >/dev/null 2>&1; then ok "$desc"; else bad "$desc"; fi; }

. /etc/os-release
OPERATOR="${SUDO_USER:-}"

echo "== SSH"
SSHD="$(sshd -T 2>/dev/null)"
for kv in "permitrootlogin no" "passwordauthentication no" "kbdinteractiveauthentication no" \
          "pubkeyauthentication yes" "maxauthtries 3" "x11forwarding no" "permitemptypasswords no"; do
  grep -qx "$kv" <<<"$SSHD" && ok "sshd: $kv" || bad "sshd: oczekiwano '$kv', jest '$(grep "^${kv%% *} " <<<"$SSHD")'"
done
grep -q "^allowusers " <<<"$SSHD" && ok "sshd: $(grep '^allowusers ' <<<"$SSHD")" || bad "sshd: brak AllowUsers"
passwd -S root 2>/dev/null | grep -qE ' (L|LK|NP) ' && ok "konto root bez dzialajacego hasla" || note "root ma ustawione haslo (logowanie roota przez SSH i tak zablokowane)"

echo "== Firewall"
if command -v firewall-cmd >/dev/null; then
  check "firewalld dziala" systemctl is-active firewalld
  SERVICES="$(firewall-cmd --list-services 2>/dev/null)"; PORTS="$(firewall-cmd --list-ports 2>/dev/null)"
  echo "     uslugi: $SERVICES | porty: ${PORTS:-brak}"
  for s in ssh http https; do grep -qw "$s" <<<"$SERVICES" && ok "otwarte: $s" || bad "nieotwarte: $s"; done
  extra="$(tr ' ' '\n' <<<"$SERVICES" | grep -vxE 'ssh|http|https|' | tr '\n' ' ')"
  [[ -z "$extra" ]] && ok "brak zbednych uslug w firewallu" || bad "zbedne uslugi w firewallu: $extra"
  extra_ports="$(tr ' ' '\n' <<<"$PORTS" | grep -vxE '443/udp|' | tr '\n' ' ')"
  [[ -z "$extra_ports" ]] && ok "brak zbednych portow w firewallu" || bad "zbedne porty w firewallu: $extra_ports"
else
  iptables -S INPUT | grep -q -- '-j REJECT' && ok "iptables: domyslne odrzucanie ruchu" || bad "iptables: brak koncowej reguly REJECT"
fi

echo "== Porty nasluchujace z zewnatrz (oczekiwane: 22, a po wdrozeniu 80 i 443)"
LISTEN="$(ss -H -tuln | awk '{print $5}' | grep -vE '^(127\.|\[::1\]|::1)' | sed -E 's/.*:([0-9]+)$/\1/' | sort -un | tr '\n' ' ')"
echo "     porty: $LISTEN"
unexpected="$(tr ' ' '\n' <<<"$LISTEN" | grep -vxE '22|80|443|68|546|111|' | tr '\n' ' ')"
[[ -z "$unexpected" ]] && ok "brak nieoczekiwanych portow" || note "inne porty nasluchuja: $unexpected (zablokowane przez firewall, ale sprawdz)"
grep -qw 3000 <<<"$LISTEN" && bad "port 3000 nasluchuje publicznie!" || ok "port 3000 (Next.js) niepubliczny"

echo "== fail2ban"
if command -v fail2ban-client >/dev/null; then
  check "fail2ban dziala" systemctl is-active fail2ban
  check "jail sshd aktywny" fail2ban-client status sshd
else
  note "fail2ban nie zainstalowany (opcjonalny; SSH i tak tylko na klucze)"
fi

echo "== Aktualizacje"
if [[ "${ID}" == "ubuntu" ]]; then
  check "unattended-upgrades wlaczone" systemctl is-enabled unattended-upgrades
else
  check "dnf-automatic.timer aktywny" systemctl is-active dnf-automatic.timer
  grep -q '^apply_updates *= *yes' /etc/dnf/automatic.conf && ok "dnf-automatic instaluje poprawki" || bad "dnf-automatic tylko pobiera (apply_updates != yes)"
  if command -v needs-restarting >/dev/null && ! needs-restarting -r >/dev/null 2>&1; then
    note "wymagany restart po aktualizacji jadra: sudo reboot"
  fi
fi
[[ -f /var/run/reboot-required ]] && note "wymagany restart: sudo reboot"

echo "== System"
if command -v getenforce >/dev/null; then
  [[ "$(getenforce)" == "Enforcing" ]] && ok "SELinux: Enforcing" || bad "SELinux: $(getenforce) (powinien byc Enforcing)"
fi
check "auditd dziala" systemctl is-active auditd
[[ "$(sysctl -n kernel.kptr_restrict 2>/dev/null)" == "2" ]] && ok "sysctl utwardzony" || bad "sysctl nie zastosowany"
empty="$(awk -F: '($2==""){print $1}' /etc/shadow)"
[[ -z "$empty" ]] && ok "brak kont z pustym haslem" || bad "konta z pustym haslem: $empty"

echo "== Docker"
check "docker dziala" systemctl is-active docker
grep -q '"no-new-privileges": true' /etc/docker/daemon.json 2>/dev/null && ok "docker: no-new-privileges + rotacja logow" || bad "brak /etc/docker/daemon.json z utwardzeniem"
[[ -n "$OPERATOR" ]] && { id -nG "$OPERATOR" | grep -qw docker && ok "$OPERATOR w grupie docker" || bad "$OPERATOR nie jest w grupie docker"; }

echo "== Katalogi i sekrety"
[[ "$(stat -c %a /srv/cfo/secrets 2>/dev/null)" == "700" ]] && ok "/srv/cfo/secrets ma 700" || bad "/srv/cfo/secrets nie istnieje albo ma zle uprawnienia"
[[ "$(stat -c %a:%u /srv/cfo/backups 2>/dev/null)" == "700:1000" ]] && ok "/srv/cfo/backups ma 700, wlasciciel uid 1000" || bad "/srv/cfo/backups: zle uprawnienia"
if [[ -f /srv/cfo/app/.env ]]; then
  [[ "$(stat -c %a /srv/cfo/app/.env)" == "600" ]] && ok ".env ma 600" || bad ".env ma $(stat -c %a /srv/cfo/app/.env) (powinno byc 600)"
fi

echo
printf 'Wynik: \033[1;32m%d OK\033[0m, \033[1;31m%d BLAD\033[0m, \033[1;33m%d UWAGA\033[0m\n' "$PASS" "$FAIL" "$WARN"
[[ $FAIL -eq 0 ]]
