# EKS module

This module defines one EKS control plane, one managed node group, the minimum
cluster and node IAM policies, and an IAM OIDC provider for future IRSA roles.

```text
EKS private API endpoint
          |
EKS control plane across two private application subnets
          |
One managed node group in the same private application subnets
```

Workers never receive public or private-data subnet IDs. Private endpoint access
is always enabled. Public endpoint access is optional and, when enabled, requires
externally supplied restricted CIDRs; `0.0.0.0/0` is rejected.

The examples use Kubernetes 1.35, while the version remains an external input.
API authentication is explicit, with temporary bootstrap cluster-creator
administration enabled. A later phase will create named access entries and
reassess that bootstrap permission.

The node group has externally configurable instance types, On-Demand or Spot
capacity, disk size, scaling bounds, labels, and update availability. Private
nodes require working NAT egress to pull images and reach external APIs until
later phases add any approved VPC endpoints.

The cluster role receives only `AmazonEKSClusterPolicy`. The node role
temporarily receives only `AmazonEKSWorkerNodePolicy`, `AmazonEKS_CNI_Policy`, and
`AmazonEC2ContainerRegistryPullOnly`. No application roles or access keys are
created.

The AWS provider permits an OIDC provider without `thumbprint_list`; IAM then
retrieves the top intermediate CA thumbprint. This avoids manually selecting a
certificate and avoids a live TLS data source. The provider exposes the issuer
URL and ARN for future IRSA consumers, but this phase creates no service-account
roles.

Before a production apply, move `AmazonEKS_CNI_Policy` from the node role to a
dedicated VPC CNI Pod Identity or IRSA role, provide an in-VPC deployment path
for the private-only API endpoint, and select control-plane CloudWatch log
retention. IRSA versus EKS Pod Identity must also be decided before application
IAM roles are created.

KMS envelope encryption, named EKS access entries, add-ons, autoscaling,
observability, Kubernetes objects, and application deployment remain deferred.
No infrastructure has been deployed. Later phases will add delivery access and
prepare a reviewed, credentialed AWS plan/apply workflow.
