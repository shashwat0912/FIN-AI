# ECR module

This module creates exactly two environment-isolated repositories:

```text
<project>-<environment>/frontend
<project>-<environment>/backend
```

Repository identity is internally fixed and keyed by `frontend` and `backend`.
Tags are immutable, repository `scan_on_push` is enabled, encryption uses
ECR-managed AES256, and deletion of non-empty repositories is blocked. One
lifecycle rule expires only untagged images older than 14 days; tagged-image
retention is deferred until promotion and rollback requirements are defined.

Effective basic versus enhanced scanning also depends on the private-registry
scanning configuration. Registry-level scanning is intentionally deferred
because it is account- and Region-scoped. Basic ECR scanning has no additional
scanning charge; enhanced scanning is billed through Amazon Inspector. ECR
storage and transfer charges may still apply.

The Helm chart already supports digest-based images. A later integration can
combine these repository URL outputs with promoted digests without committing
unresolved URLs to Helm values.

No repository policies are created. EKS nodes already have pull-only ECR access;
GitHub Actions push permissions and AWS OIDC federation belong to a later
delivery-access phase. No registry, repositories, or images have been created by
this statically validated configuration.
