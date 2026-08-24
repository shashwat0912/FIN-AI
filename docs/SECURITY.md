# Security

This document summarizes the controls implemented in Finance AI and the
configuration responsibilities that remain with an operator. It is not a claim
of regulatory compliance or a completed penetration test.

## Reporting a vulnerability

Do not publish credentials, personal data, or exploit details in a public issue.
Use the repository's private vulnerability-reporting channel when available, or
contact the repository owner privately through their GitHub profile.

Include the affected component, reproduction steps, expected impact, and any
temporary mitigation. Do not access data that is not yours while validating a
report.

## Application controls

- Passwords are hashed with bcrypt.
- Access and refresh tokens use independent secrets with a 64-character minimum.
- OTP values are hashed, expire, and are subject to request and verification
  limits.
- Login failures use shared lockout state when Valkey is configured.
- State-changing browser requests use CSRF protection and explicit CORS origins.
- Helmet security headers, request-size limits, and route validation are applied
  by the Express application.
- Prisma parameterization is used for normal database access.
- Authentication, authorization, rate-limit, and lifecycle events use structured
  logging without logging token or OTP values.

## Platform controls

- GitHub Actions authenticates to AWS through OIDC; no static AWS access key is
  required by the workflow.
- The backend service account uses an IRSA role restricted to its required AWS
  permissions.
- RDS PostgreSQL and ElastiCache Valkey are private and accept application traffic
  only from the EKS network boundary.
- PostgreSQL connections verify the RDS certificate chain using the bundled AWS
  regional CA plus the system trust store.
- Valkey uses TLS and IAM authentication in the staging configuration.
- Runtime and migration database identities are separate. The runtime identity
  cannot perform migrations or access the Prisma migration ledger.
- Application and migration credentials are supplied through separate external
  Kubernetes Secrets, not through Helm values.
- Containers use restricted security contexts; the backend image runs as a
  non-root user.

## Local configuration

Copy the canonical example and replace every security placeholder before use:

```sh
cp backend/.env.example backend/.env
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Generate independent values for `JWT_SECRET`, `JWT_REFRESH_SECRET`, and
`SECURITY_STATE_HMAC_SECRET`. Keep `.env`, Terraform state, real `tfvars`, saved
plans, Kubernetes Secrets, provider credentials, and database URLs out of Git.
The credentials in `backend/docker-compose.yml` are deliberately local-only and
must not be reused in a shared environment.

## Validation

Relevant repository checks include:

```sh
npm run typecheck
npm run test:run
npm --prefix backend run typecheck
npm --prefix backend test
./scripts/terraform-validate.sh
K8S_LOCAL_STATIC_ONLY=true ./scripts/k8s-local-validate.sh
```

Before publishing or mirroring the repository, scan both the current tracked
tree and the full Git history; a clean current tree does not prove clean history.

## Historical scan allowlist

`.gitleaksignore` contains only exact fingerprints for reviewed documentation
examples, CI fixtures, and unused historical session/encryption dummy values.
It does not suppress any rule or path, so new findings remain visible.

## Known boundaries

- Helm installation or upgrade is an operator action, not an automated deployment
  workflow.
- Public ingress, DNS, and certificates require environment-specific review.
- SMTP must be configured for production email OTP delivery; production SMS
  delivery is not integrated.
- Structured logs and health endpoints are present, but there is no complete
  application metrics or tracing stack.
- Operators remain responsible for credential rotation, dependency updates,
  backup validation, access review, and incident response.
