#!/usr/bin/env bash
# Ponawia tworzenie instancji Always Free VM.Standard.A1.Flex, dopoki Oracle nie zwolni pojemnosci
# ("Out of capacity / Out of host capacity"). Probuje kolejno wszystkie availability domains.
#
# Wymaga skonfigurowanego OCI CLI (`oci setup config`) albo uruchomienia w OCI Cloud Shell.
# Wymagane zmienne (wartosci OCID skopiuj z konsoli OCI):
#   COMPARTMENT_ID  - OCID compartmentu (np. cfo-prod albo root tenancy)
#   SUBNET_ID       - OCID publicznego subnetu w VCN
#   IMAGE_ID        - OCID obrazu Ubuntu 24.04 aarch64 dla Twojego regionu
#   SSH_KEY_FILE    - sciezka do klucza publicznego, np. ~/.ssh/cfo_oracle_ed25519.pub
# Opcjonalne:
#   OCPUS=2 MEMORY_GB=12 BOOT_GB=50 DISPLAY_NAME=cfo-prod RETRY_SECONDS=60
#
# Przyklad:
#   COMPARTMENT_ID=ocid1... SUBNET_ID=ocid1... IMAGE_ID=ocid1... \
#   SSH_KEY_FILE=~/.ssh/cfo_oracle_ed25519.pub ./deploy/oci-launch-retry.sh
set -euo pipefail

: "${COMPARTMENT_ID:?Set COMPARTMENT_ID}"
: "${SUBNET_ID:?Set SUBNET_ID}"
: "${IMAGE_ID:?Set IMAGE_ID}"
: "${SSH_KEY_FILE:?Set SSH_KEY_FILE}"
OCPUS="${OCPUS:-2}"
MEMORY_GB="${MEMORY_GB:-12}"
BOOT_GB="${BOOT_GB:-50}"
DISPLAY_NAME="${DISPLAY_NAME:-cfo-prod}"
RETRY_SECONDS="${RETRY_SECONDS:-60}"

mapfile -t ads < <(oci iam availability-domain list --compartment-id "$COMPARTMENT_ID" \
  --query 'data[].name' --raw-output | tr -d '[]", ' | sed '/^$/d')

if [ "${#ads[@]}" -eq 0 ]; then
  echo "No availability domains found - check COMPARTMENT_ID and OCI CLI config." >&2
  exit 1
fi

existing=$(oci compute instance list --compartment-id "$COMPARTMENT_ID" \
  --display-name "$DISPLAY_NAME" --lifecycle-state RUNNING --query 'length(data)' --raw-output 2>/dev/null || echo 0)
if [ "${existing:-0}" != "0" ]; then
  echo "Instance '$DISPLAY_NAME' is already running - nothing to do."
  exit 0
fi

attempt=0
while true; do
  for ad in "${ads[@]}"; do
    attempt=$((attempt + 1))
    echo "[$(date '+%F %T')] attempt $attempt: $ad (${OCPUS} OCPU / ${MEMORY_GB} GB)"

    if output=$(oci compute instance launch \
      --compartment-id "$COMPARTMENT_ID" \
      --availability-domain "$ad" \
      --shape VM.Standard.A1.Flex \
      --shape-config "{\"ocpus\": ${OCPUS}, \"memoryInGBs\": ${MEMORY_GB}}" \
      --subnet-id "$SUBNET_ID" \
      --image-id "$IMAGE_ID" \
      --assign-public-ip true \
      --boot-volume-size-in-gbs "$BOOT_GB" \
      --ssh-authorized-keys-file "$SSH_KEY_FILE" \
      --display-name "$DISPLAY_NAME" 2>&1); then
      echo "Instance created in $ad:"
      echo "$output" | grep -E '"(id|lifecycle-state)"' | head -2
      echo "Public IP appears in the OCI console in about a minute."
      exit 0
    fi

    if grep -qi "capacity" <<<"$output"; then
      echo "  out of capacity"
    elif grep -qi "TooManyRequests" <<<"$output"; then
      echo "  rate limited - waiting longer"
      sleep $((RETRY_SECONDS * 3))
    elif grep -qi "LimitExceeded" <<<"$output"; then
      echo "$output" >&2
      echo "Service limit exceeded - an A1 instance probably already exists, or OCPUS/MEMORY_GB exceed Always Free." >&2
      exit 1
    else
      echo "$output" >&2
      echo "Unexpected error - fix the parameters before retrying." >&2
      exit 1
    fi
  done
  sleep "$RETRY_SECONDS"
done
