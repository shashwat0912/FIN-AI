#!/usr/bin/env bash
set -euo pipefail

readonly CLUSTER_NAME="finance-ai-local"
readonly PID_FILE="${TMPDIR:-/tmp}/finance-ai-local-port-forwards.pids"

for command_name in docker kind; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name" >&2
    exit 1
  fi
done

docker info >/dev/null

if [[ -f "$PID_FILE" ]]; then
  while IFS= read -r pid; do
    [[ "$pid" =~ ^[0-9]+$ ]] || continue
    process_command="$(ps -p "$pid" -o command= 2>/dev/null || true)"
    if [[ "$process_command" == *kubectl* && "$process_command" == *port-forward* ]]; then
      kill "$pid" 2>/dev/null || true
    fi
  done < "$PID_FILE"
  rm -f "$PID_FILE"
fi

if kind get clusters | grep -Fxq "$CLUSTER_NAME"; then
  kubeconfig_dir="$(mktemp -d "${TMPDIR:-/tmp}/finance-ai-local-cleanup.XXXXXX")"
  trap 'rm -rf "$kubeconfig_dir"' EXIT
  kind delete cluster --name "$CLUSTER_NAME" --kubeconfig "$kubeconfig_dir/config"
else
  echo "kind cluster $CLUSTER_NAME is already absent"
fi

if kind get clusters | grep -Fxq "$CLUSTER_NAME"; then
  echo "Failed to remove kind cluster $CLUSTER_NAME" >&2
  exit 1
fi

echo "kind cluster $CLUSTER_NAME is absent"
