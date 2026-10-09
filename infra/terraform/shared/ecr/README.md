# Staging ECR Terraform root

This root exclusively owns the persistent staging frontend and backend ECR
repositories and their lifecycle policies. Its state is isolated at
`shared/ecr/terraform.tfstate`, so staging runtime teardown cannot delete the
repositories or their images.

Initialize and plan this root with the bootstrap bucket:

```sh
cp backend.hcl.example backend.hcl
# Replace the bucket placeholder; keep the ap-south-1 region.
terraform init -backend-config=backend.hcl
terraform plan -out=ecr.tfplan
```

The repositories use immutable tags, scan images on push, and expire untagged
images after 14 days. The GitHub Actions publisher role remains in the separate
`shared/github-actions/terraform.tfstate` state.
