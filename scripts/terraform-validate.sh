#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
terraform_root="$repo_root/infra/terraform"
data_root="$(mktemp -d)"
trap 'rm -rf "$data_root"' EXIT

export AWS_EC2_METADATA_DISABLED=true
export TF_PLUGIN_CACHE_DIR="$data_root/plugin-cache"
mkdir -p "$TF_PLUGIN_CACHE_DIR"

printf '%s\n' '==> Checking Terraform formatting'
terraform -chdir="$terraform_root" fmt -check -recursive

for root in bootstrap environments/staging environments/production; do
  data_dir="$data_root/${root//\//-}"
  printf '==> Initializing %s with its backend disabled\n' "$root"
  TF_DATA_DIR="$data_dir" terraform -chdir="$terraform_root/$root" init \
    -backend=false \
    -input=false
  printf '==> Validating %s\n' "$root"
  TF_DATA_DIR="$data_dir" terraform -chdir="$terraform_root/$root" validate

  if [[ "$root" == "environments/staging" ]]; then
    printf '%s\n' '==> Testing VPC NAT modes with a mocked AWS provider'
    TF_DATA_DIR="$data_dir" terraform -chdir="$terraform_root/$root" test
  fi
done
