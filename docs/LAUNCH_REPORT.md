# Public demo preparation report

Work is on `codex/public-demo-readiness`. No push, deployment, Terraform apply,
ACM certificate, DNS record or paid AWS test infrastructure was created.
The existing architecture and UI are preserved. This is a portfolio demo.

## Fixes

- OTP uses Node crypto.randomInt and six digits across generation, verification,
  validation and UI. Production permits email only; phone remains a development
  option. Existing production logging does not expose OTP values.
- Access JWT defaults to 15 minutes; refresh remains 30 days. Logout now calls the
  existing backend revocation endpoint. Refresh storage remains unchanged.
- Production backend IRSA trusts only its namespace/ServiceAccount and grants
  elasticache:Connect to its own replication group/application user ARNs.
  Generated Helm overrides supply actual Terraform outputs for IAM Valkey.
- Production enables the existing migration hook with a separate migrator Secret,
  the same backend digest, no AWS workload identity and migration failure gating.
  One-time DB bootstrap/reconciliation is documented before Helm installation.
- Public ALB configuration uses IP targets, ACM, HTTPS redirect, `/api` backend
  routing and separate readiness health checks. Explicit required overrides avoid
  an invented domain. Terraform supplies the controller's scoped OIDC role and
  upstream version-paired IAM policy; add-on installation stays manual.
- CloudWatch collector identity/log retention and SNS-backed RDS, Valkey and failed
  EKS node alarms are configured. Operator collection installation, subscription,
  dimensions and delivery verification remain necessary. Removed nonfunctional
  Sentry code/config; Sentry is not enabled.
- Knowledge create/update now uses Prisma JSON strings in existing TEXT columns.
  The actual RAG reads JSON and calculates cosine similarity in the application;
  pgvector and a schema migration are unnecessary. Existing stored data is retained.
  PostgreSQL integration verifies metadata, embeddings and updates.
- CI adds full-history Gitleaks, runtime npm high-severity gates, Trivy filesystem
  and image scans, and one deterministic Playwright journey. Publishing requires
  those gates; no production auto-deploy was added.
- Removed unused Firebase, updated vulnerable runtime dependencies and scoped the
  Prisma deepmerge-ts override. Runtime audits have no high/critical findings.
- Fixed the previously ineffective frontend typecheck (empty reference root).
  It now checks the actual app/config; the resulting existing errors required
  unused-import cleanup plus small type/prop fixes. No visual redesign occurred.
  Frontend builder uses Node 22; SMTP transporter typing works in the Docker build.
  Runtime Alpine packages are upgraded. Backend removes builder-only npm and
  invokes the installed Prisma CLI directly with Node for migrations.

## Checks actually run

| Check                                                        | Result                                                                                                                                                                               |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| npm ci (frontend and backend)                                | Pass                                                                                                                                                                                 |
| Frontend actual typecheck, tests and production build        | Pass; 61 tests                                                                                                                                                                       |
| Backend Prisma generate, typecheck and build                 | Pass                                                                                                                                                                                 |
| Backend test:ci                                              | Pass; 196 passed, 13 skipped (integration-gated suites)                                                                                                                              |
| Backend test:integration against disposable PostgreSQL       | Pass; 14 tests, including knowledge storage                                                                                                                                          |
| Focused SMTP tests after transporter typing change           | Pass; 3 tests                                                                                                                                                                        |
| Playwright Chromium journey                                  | Pass; 1 test covering login/dashboard/transaction/goal/advice/refresh/revocation                                                                                                     |
| Terraform formatting/init/validate/mock tests                | Pass; 5 roots validated, 44 tests, no apply                                                                                                                                          |
| Staging and production helm lint/template                    | Pass                                                                                                                                                                                 |
| Production override generator and rendered launch assertions | Pass; invalid/missing inputs rejected                                                                                                                                                |
| K8S_LOCAL_STATIC_ONLY static validation                      | Pass; no live Kubernetes rollout                                                                                                                                                     |
| GitHub Actions YAML parsing / git diff --check               | Pass                                                                                                                                                                                 |
| Runtime npm audits (omit dev, audit-level high)              | Pass gate; frontend 2 moderate, backend 4 moderate remain                                                                                                                            |
| Trivy filesystem high/critical fixable + secrets scan        | Pass; zero findings at gate                                                                                                                                                          |
| Docker frontend/backend builds                               | Pass, including final runtime package patches; local host architecture                                                                                                               |
| Docker image scans                                           | Final PASS for both; zero gated vulnerabilities/secrets. Initial failures fixed by Alpine upgrades and removing runtime npm                                                          |
| Final image Prisma migration invocation                      | Pass; exact hook command runs with --help without DB access                                                                                                                          |
| Gitleaks v8.30.1 full Git history                            | PASS: zero findings / 182 scanned commits; 42 exact reviewed fingerprints including 8 scoped fresh-demo JWT exceptions; historical external use C/unknown; see SECRET_SCAN_REVIEW.md |
| Ignored-file-inclusive working tree secret audit             | PASS: persisted local signing values removed; unused session/encryption values retired; fresh development keys generated only in memory                                              |
| Live AWS/staging, real SMTP, ACM/DNS, collector/alarms       | Not run; operator inputs/infrastructure absent                                                                                                                                       |

Earlier local attempts exposed stale shared-ECR assertions, unknown mock ARN
assertions, real frontend type errors and Docker SMTP typing; those were corrected
and the applicable checks passed. Static migration assertions were also updated for direct Node execution and rerun.
An incorrectly rooted focused Vitest command
failed to locate setup; the correct backend-root invocation passed. Browser tests
use ephemeral credentials and a disposable local database, not production auth
bypasses. Failure traces may contain tokens and remain private/short-lived.

Image scans initially failed on Alpine packages and bundled npm. Updating npm
alone still left three high findings, so runtime npm was removed. Helm and local
migration manifests now invoke the same installed Prisma CLI directly with Node.
Static assertions and final image command verification passed. Rebuild and scan
for the selected AWS node architecture; no amd64 AWS rollout was claimed.

Builder/development dependency audits still report high/critical findings; they
are not represented as clean. The runtime threshold is intentional, not a global
suppression. Production browser build retains existing inline-style/script CSP
allowances and browser localStorage tokens. HttpOnly refresh migration remains
explicitly deferred. Remove the scoped Prisma override after upstream fixes it.

## Launch blockers and reachability

1. Enforce the fresh demo authentication boundary: independent new cryptographic
   JWT keys, a fresh runtime Secret, and a fresh database with no imported old
   refresh/session records. Production now rejects both historical keys in either
   JWT role. All 42 findings are accounted for with exact exceptions; both JWT
   external-use classifications remain C/unknown. Old EC2/shared environments
   remain unverified and require owner-side rotation/revocation or decommissioning.
   No history rewrite is recommended; see SECRET_SCAN_REVIEW.md and PUBLIC_DEMO.md.
2. Supply/review production state configuration, sizing, supported EKS version and
   operator access. Apply only after reviewing the saved plan and AWS cost.
3. Build/scan/publish node-architecture-matched immutable images, bootstrap private
   RDS identities and grants, and supply distinct runtime/migrator Secrets.
4. Install/verify Load Balancer Controller and CloudWatch collection with their
   dedicated identities; subscribe/confirm alerts and validate metric delivery.
5. Supply an issued regional ACM certificate and actual hostname, generate launch
   overrides, approve Helm installation, verify target health, then point DNS.
6. Verify real email delivery, HTTPS/redirect/API and run the staging smoke against
   an isolated test deployment with a private SMTP sink. No live AWS path is proven.

FIN-AI is not publicly reachable from this work: no production apply, image push,
Secrets, add-ons, certificate, Helm rollout or DNS change was performed.

## Exact manual operator steps and first-deployment commands

Follow [PUBLIC_DEMO.md](PUBLIC_DEMO.md) in order. It contains copyable Terraform
init/plan/review/apply, image build/scan/publish/digest, add-on identity installation,
DB bootstrap, Secret creation, generated overrides and Helm lint/template/install
commands. Stop for human plan/release review at the marked boundaries. Production
EKS/RDS are private: use an approved private operator network and temporary scoped
bootstrap access. The CA assets currently constrain this release to ap-south-1.

Required backend Secret keys (names only): DATABASE_URL, JWT_SECRET,
JWT_REFRESH_SECRET, SECURITY_STATE_HMAC_SECRET, CSRF_SECRET, SMTP_HOST, SMTP_PORT,
SMTP_USER, SMTP_PASS. Migrator Secret: DATABASE_URL, using its distinct role.
Optional external AI: OPENAI_API_KEY. No AWS static access key belongs in pods.

Operator inputs (names only): PRODUCTION_HOSTNAME, ACM_CERTIFICATE_ARN,
FRONTEND_IMAGE_DIGEST, BACKEND_IMAGE_DIGEST, AWS_REGION, CLUSTER_NAME, VPC_ID,
LBC_CHART_VERSION, CLOUDWATCH_ADDON_VERSION, EKS_VERSION, RUNTIME_ENV_FILE,
MIGRATOR_ENV_FILE. Staging smoke inputs: SMOKE_BASE_URL, SMOKE_MAILPIT_URL,
SMOKE_EMAIL. Local tests require a guarded TEST_DATABASE_URL.

## Conservative readiness

| Rating            | Assessment                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------------- |
| Local-ready       | Yes, verified application/database/browser checks                                             |
| Staging-ready     | Configuration/test ready; live deployment and real delivery unverified; security gate blocked |
| Public-demo-ready | No: historical secret review plus manual AWS/operator launch and external verification remain |
| Production-ready  | No: portfolio scope; not a regulated/real-money service, refresh storage migration deferred   |

Exact file changes are in [LAUNCH_FILES.md](LAUNCH_FILES.md). Existing user work
moving staging ECR to shared/ecr and PRODUCT.md was preserved and listed separately.

## Credential retirement follow-up

ENCRYPTION_KEY and SESSION_SECRET have no application consumers in current or
available historical code. Removing them does not alter PostgreSQL data and no
re-encryption is required. Local JWT values were removed from ignored backend/root
env files; development generates fresh process-only keys, while production requires
supplied keys. Existing local Docker key configuration does not match historical
values; it was left unchanged. No external retirement is claimed.

Fixed a refresh-session issue uncovered by retirement: the shared service now
verifies the refresh JWT signature/expiry before DB lookup. Rotate access/refresh
keys together across every accepting process and clear refresh_tokens using the
controlled operator procedure in SECRET_SCAN_REVIEW.md. Existing per-user
logout-all remains available. Production images must be rebuilt from this change;
previous image scan evidence applies to the earlier builds.

Boundary follow-up: backend typecheck/build and 203 tests passed (13 integration
skips); both actual historical keys were rejected in both production JWT roles.
The preceding retirement pass had 14 integration tests pass. Gitleaks full history (182 scanned commits) and ignored-inclusive working tree
(468 files) both pass with zero findings; runtime audits pass high thresholds with six moderate
findings total; Trivy filesystem/secrets gate and git diff --check pass.
No AWS rollout or Git rewrite was performed.

The historical-secret gate is scoped to the isolated fresh public demo. It does
not certify old EC2 retirement or replace the remaining AWS/operator launch checks.
This follow-up changes exactly `.gitleaksignore`, `backend/src/config/env.ts`,
`backend/tests/configRetirement.test.ts`, `docs/SECRET_SCAN_REVIEW.md`,
`docs/PUBLIC_DEMO.md` and this report.

## GitHub pre-push review

The readiness commits were replayed onto the current GitHub main after the old
local main and GitHub main were found to have unrelated histories. No remote
history was rewritten, no force push used and local main was left untouched.
Main's newer router/test-runner dependency fixes were preserved. Review corrected
the production new-user name input, converted local documentation links to
repository-relative paths and added the existing static Kubernetes/Helm checks
to CI. No env files, Terraform state, generated overrides, browser traces or
production Secret values are tracked. Final all-ref Gitleaks passed over 188
scanned commits and the ignored-inclusive working scan passed over 468 files.
Actual PR checks are the merge gate; PR #24 is intentionally not merged.
