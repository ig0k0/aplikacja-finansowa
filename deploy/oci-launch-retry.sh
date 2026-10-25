#!/usr/bin/env bash
# Ponawia tworzenie instancji Always Free VM.Standard.A1.Flex, dopoki Oracle nie zwolni pojemnosci
# ("Out of capacity / Out of host capacity"). Na zmiane probuje AD-1, AD-2 i AD-3 — kazda AD
# jest sprawdzana mniej wiecej co minute. Zatrzymuje sie po utworzeniu JEDNEJ instancji.
#
# Uruchomienie w OCI Cloud Shell (CLI jest juz zalogowane, nic nie trzeba konfigurowac):
#   bash oci-launch-retry.sh
#
# Domyslne wartosci odpowiadaja formularzowi "Create instance" (Frankfurt, root compartment,
# VCN Network2, subnet cfo-public-subnet, 1 OCPU / 6 GB, 50 GB boot, publiczny IPv4).
# Kazda wartosc mozna nadpisac zmienna srodowiskowa, np.:
#   OCPUS=2 MEMORY_GB=12 bash oci-launch-retry.sh
#   IMAGE_OS="Oracle Linux" IMAGE_OS_VERSION=9 bash oci-launch-retry.sh
#
# Automatycznie, bez otwartego Cloud Shell: .github/workflows/oci-launch-retry.yml uruchamia
# skrypt co 5 minut z MAX_RUNTIME_SECONDS, wiec proby ida praktycznie bez przerwy.
set -uo pipefail

COMPARTMENT_ID="${COMPARTMENT_ID:-${OCI_TENANCY:-}}"
DISPLAY_NAME="${DISPLAY_NAME:-APP}"
VCN_NAME="${VCN_NAME:-Network2}"
SUBNET_NAME="${SUBNET_NAME:-cfo-public-subnet}"
SHAPE="VM.Standard.A1.Flex"
OCPUS="${OCPUS:-1}"
MEMORY_GB="${MEMORY_GB:-6}"
BOOT_GB="${BOOT_GB:-50}"
# Ubuntu 24.04 — pod niego napisany jest runbook (iptables, Docker). Oracle Linux 9 tez zadziala.
IMAGE_OS="${IMAGE_OS:-Canonical Ubuntu}"
IMAGE_OS_VERSION="${IMAGE_OS_VERSION:-24.04}"
SSH_PUBLIC_KEY="${SSH_PUBLIC_KEY:-ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIH5vwUMwNmc0TMRMoGYU5rYO5yZnxaaZqDmxB/Qvhnpe oracle-oci}"
# Odstep miedzy kolejnymi probami (kolejna AD). 3 AD x 20 s = kazda AD co ~60 s.
DELAY_SECONDS="${DELAY_SECONDS:-20}"
# 0 = bez limitu. W GitHub Actions skrypt konczy sie po tym czasie i startuje ponownie z harmonogramu.
MAX_RUNTIME_SECONDS="${MAX_RUNTIME_SECONDS:-0}"

log() { echo "[$(date '+%F %T')] $*"; }
summary() { [ -n "${GITHUB_STEP_SUMMARY:-}" ] && echo "$*" >> "$GITHUB_STEP_SUMMARY"; return 0; }
die() { echo "BLAD: $*" >&2; exit 1; }

command -v oci >/dev/null || die "Brak OCI CLI - uruchom skrypt w OCI Cloud Shell."
command -v jq >/dev/null || die "Brak jq."
[ -n "$COMPARTMENT_ID" ] || die "Ustaw COMPARTMENT_ID (OCID compartmentu/tenancy)."

# --- jednorazowe wyszukanie zasobow ---------------------------------------------------------
mapfile -t ADS < <(oci iam availability-domain list --compartment-id "$COMPARTMENT_ID" | jq -r '.data[].name')
[ "${#ADS[@]}" -gt 0 ] || die "Nie znaleziono availability domains."

VCN_ID="${VCN_ID:-$(oci network vcn list --compartment-id "$COMPARTMENT_ID" --display-name "$VCN_NAME" \
  | jq -r '.data[0].id // empty')}"
[ -n "$VCN_ID" ] || die "Nie znaleziono VCN '$VCN_NAME'."

SUBNET_ID="${SUBNET_ID:-$(oci network subnet list --compartment-id "$COMPARTMENT_ID" --vcn-id "$VCN_ID" \
  --display-name "$SUBNET_NAME" | jq -r '.data[0].id // empty')}"
[ -n "$SUBNET_ID" ] || die "Nie znaleziono subnetu '$SUBNET_NAME' w VCN '$VCN_NAME'."

IMAGE_ID="${IMAGE_ID:-$(oci compute image list --compartment-id "$COMPARTMENT_ID" \
  --operating-system "$IMAGE_OS" --operating-system-version "$IMAGE_OS_VERSION" --shape "$SHAPE" \
  --sort-by TIMECREATED --sort-order DESC --limit 1 | jq -r '.data[0].id // empty')}"
[ -n "$IMAGE_ID" ] || die "Nie znaleziono obrazu '$IMAGE_OS $IMAGE_OS_VERSION' dla $SHAPE."
IMAGE_NAME=$(oci compute image get --image-id "$IMAGE_ID" | jq -r '.data."display-name"')

KEY_FILE=$(mktemp)
trap 'rm -f "$KEY_FILE"' EXIT
printf '%s\n' "$SSH_PUBLIC_KEY" > "$KEY_FILE"

log "AD:      ${ADS[*]}"
log "Subnet:  $SUBNET_NAME ($VCN_NAME)"
log "Obraz:   $IMAGE_NAME"
log "Ksztalt: $SHAPE ${OCPUS} OCPU / ${MEMORY_GB} GB, boot ${BOOT_GB} GB"

# --- ochrona przed duplikatem ----------------------------------------------------------------
existing_count() {
  oci compute instance list --compartment-id "$COMPARTMENT_ID" --display-name "$DISPLAY_NAME" --all \
    | jq '[.data[]? | select(."lifecycle-state" != "TERMINATED" and ."lifecycle-state" != "TERMINATING")] | length'
}
if [ "$(existing_count)" != "0" ]; then
  log "Instancja '$DISPLAY_NAME' juz istnieje - koniec."
  exit 0
fi

# --- petla ------------------------------------------------------------------------------------
attempt=0
started=$SECONDS
while true; do
  for ad in "${ADS[@]}"; do
    if [ "$MAX_RUNTIME_SECONDS" -gt 0 ] && [ $((SECONDS - started)) -ge "$MAX_RUNTIME_SECONDS" ]; then
      log "Limit czasu ${MAX_RUNTIME_SECONDS}s, $attempt prob bez pojemnosci - kolejne uruchomienie z harmonogramu."
      exit 0
    fi
    attempt=$((attempt + 1))

    # --no-retry: bez tego CLI samo ponawia blad 500 przez kilka minut, zamiast przejsc do kolejnej AD.
    output=$(oci compute instance launch --no-retry \
      --compartment-id "$COMPARTMENT_ID" \
      --availability-domain "$ad" \
      --display-name "$DISPLAY_NAME" \
      --shape "$SHAPE" \
      --shape-config "{\"ocpus\": $OCPUS, \"memoryInGBs\": $MEMORY_GB}" \
      --image-id "$IMAGE_ID" \
      --boot-volume-size-in-gbs "$BOOT_GB" \
      --subnet-id "$SUBNET_ID" \
      --assign-public-ip true \
      --is-pv-encryption-in-transit-enabled true \
      --instance-options '{"areLegacyImdsEndpointsDisabled": true}' \
      --availability-config '{"recoveryAction": "RESTORE_INSTANCE"}' \
      --ssh-authorized-keys-file "$KEY_FILE" 2>&1)
    status=$?

    if [ $status -eq 0 ]; then
      instance_id=$(jq -r '.data.id' <<<"$output" 2>/dev/null)
      log "SUKCES w $ad (proba $attempt). Instance: $instance_id"
      log "Czekam na stan RUNNING..."
      oci compute instance get --instance-id "$instance_id" \
        --wait-for-state RUNNING --max-wait-seconds 600 >/dev/null 2>&1
      ip=$(oci compute instance list-vnics --instance-id "$instance_id" | jq -r '.data[0]."public-ip" // empty')
      user=ubuntu
      [ "$IMAGE_OS" = "Oracle Linux" ] && user=opc
      log "Publiczny IP: ${ip:-sprawdz w konsoli}"
      log "Logowanie:    ssh -i <twoj_klucz_prywatny> ${user}@${ip:-<IP>}"
      summary "## Instancja $DISPLAY_NAME utworzona w $ad"
      summary "IP: \`${ip:-sprawdz w konsoli}\` — \`ssh ${user}@${ip:-<IP>}\`"
      exit 0
    fi

    short=$(grep -oE '"message": "[^"]*"' <<<"$output" | head -1)
    if grep -qiE 'capacity' <<<"$output"; then
      log "#$attempt $ad: brak pojemnosci"
    elif grep -qiE 'TooManyRequests|"status": 429' <<<"$output"; then
      log "#$attempt $ad: limit zapytan (429) - pauza 2 min"
      sleep 120
    elif grep -qiE 'LimitExceeded|QuotaExceeded' <<<"$output"; then
      echo "$output" >&2
      die "Przekroczony limit - masz juz instancje A1 albo OCPUS/MEMORY_GB przekraczaja Always Free."
    elif grep -qiE 'NotAuthorized|InvalidParameter|CannotParseRequest|"status": 400|"status": 404' <<<"$output"; then
      echo "$output" >&2
      die "Bledne parametry - popraw i uruchom ponownie."
    else
      # Bledy przejsciowe (500 inne niz capacity, timeout sieci) - probujemy dalej.
      log "#$attempt $ad: inny blad, ponawiam ${short:+($short)}"
      # Na wszelki wypadek: zapytanie moglo sie powiesc mimo bledu po stronie klienta.
      if [ "$(existing_count)" != "0" ]; then
        log "Instancja '$DISPLAY_NAME' jednak powstala - sprawdz konsole."
        exit 0
      fi
    fi

    sleep "$DELAY_SECONDS"
  done
done
