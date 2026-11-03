# Agentic platform implementation and validation

Validated on **3 November 2026**, on `feat/agentic-cloud-ops`. No push, AWS
resource creation, Terraform apply, DNS change or application deployment was
performed. The existing application remains the FIN-AI workload.

## Delivered scope

1. **Architecture:** optional FastAPI operations API, bounded orchestrator, three
   responsibility-specific workflows, official MCP 2.3 server/client, existing
   PostgreSQL records, OpenTelemetry and deterministic simulation. No new database,
   queue, vector store, service mesh or GPU dependency.
2. **Exact files:** [AGENTIC_FILES.md](AGENTIC_FILES.md) is the complete added/changed
   file manifest relative to `main`. Application changes are confined to dashboard
   routing/navigation, the new page, and a narrow administrator-only backend proxy.
3. **MCP:** 20 reader tools for Kubernetes, CloudWatch, RDS, Valkey, GitHub Actions
   and deployment metadata, Terraform artifacts, and Cost Explorer. Every reader
   runs through policy, scope/input validation, deadline, projection/redaction,
   structured result/error, correlation/trace identifiers and audit metadata.
4. **SRE:** evidence plan → scoped reads → symptom-driven follow-up → correlation
   → cited hypothesis/RCA → operator recommendations. Empty/unavailable evidence,
   tool budget or provider failure produces an incomplete result. Mock diagnosis
   is a deterministic signal/metric baseline; optional OpenAI inference is bounded
   and returns validated Pydantic reasoning, never fabricated tool evidence.
5. **Deployment:** workflow SHA/result and jobs, GitHub deployment metadata,
   deployed image/tag or supplied immutable digest, rollout/pod health, migration,
   log signals, P95 and error-rate comparison. PROMOTE, HOLD, or
   ROLLBACK_RECOMMENDED are assessments only. No automatic promotion/rollback.
6. **FinOps:** two 30-day billing periods, service drivers, NAT usage-type
   separation, sampled RDS/Valkey utilization and candidate follow-up checks.
   Savings are null when utilization/pricing evidence cannot justify an estimate.
   The synthetic monthly total is $277; it is not a real AWS bill.
7. **Approval:** server-created action IDs bind target, parameters, requester,
   investigation and 15-minute expiry. A separate approver credential, code policy
   and atomic PostgreSQL claim prevent bypass/replay. Execution is simulated only.
   Live writes remain unavailable even with the enable flag set.
8. **IAM/RBAC:** opt-in dedicated IRSA role, exact OIDC audience/subject, scoped
   log/RDS/Valkey/alarm reads and optional explicit billing view. Only
   GetMetricStatistics requires wildcard resources. Separate namespaced reader
   Role, no Secrets/exec/write grants or backend privilege inheritance.
9. **Observability:** investigation/plan/tool/correlation/RCA and remediation spans;
   request/tool count, latency, failures, tokens, estimated model cost, step and
   approval metrics. None/console/OTLP exporters. Sensitive inputs are excluded
   from span attributes. In-memory tracing is tested; external export is not.
10. **Evaluation:** 12 synthetic incident cases, each with expected RCA, required
    evidence tools and forbidden actions. Actual result: 12/12 RCA, 100% required
    tool selection and evidence availability, zero forbidden proposed actions,
    5.58 mean calls, 10.58 mean steps, 3.58 calls above the scenario minimum.
    See [machine-generated results](agent-evaluation.json). These are fixture
    results, not a live or held-out model benchmark.
11. **Simulation:** shared healthy objects plus scenario observations cover all
    required incidents and dependency/cost fixtures. No AWS/paid model is needed.
    API/tool responses and UI visibly identify simulation. Memory records are
    ephemeral; optional existing PostgreSQL makes simulation records durable.
12. **Packaging/infrastructure:** pinned multi-stage non-root Python image, patched
    Debian base, runtime-only locked dependencies, healthcheck; optional component
    in the existing Helm chart; dedicated resources/probes/security/secret refs;
    opt-in IRSA module in staging/production. Existing components remain the default.
13. **CI:** additive Agent Platform workflow installs locks, checks format/lint/types,
    runs PostgreSQL tests and evaluations, uploads results, validates Helm, builds
    and scans the image. Existing application/security workflows are preserved.
    CI forces mock/simulation, has no paid-model or deployment step, and should be
    added to branch protection as a required check after review.
14. **Validation:** actual commands/results are recorded below, including resolved
    failures and intentional existing test skips.
15. **Limits:** service identities rather than individual operator SSO; no live
    executor, image-attestation verification, retention/immutable external audit,
    sustained capacity model, deploy-time-aligned metric windows, or automatic
    post-deploy callback. Current metric-window comparisons require operator
    alignment before using them as a promotion gate. Missing metrics yield HOLD.
    Existing successful migration hooks are deleted by Helm; absent migration
    evidence therefore yields HOLD unless retained evidence is made available.
16. **Live validation remaining:** EKS RBAC and IRSA authorization, actual metric
    names/dimensions and availability, GitHub permissions, billing-view scope,
    RDS network/TLS/schema role privileges, secret provisioning, CNI NetworkPolicy
    enforcement, collector export, and deployment-specific diagnosis. None was
    tested against a live AWS environment.
17. **Truthful resume claim:** “Implemented a simulation-tested AI operations layer
    for a finance workload targeting EKS using FastAPI, MCP, typed policies,
    human-approved simulated remediation, PostgreSQL audit records, OpenTelemetry,
    Terraform/Helm security boundaries, and 12 deterministic incident evaluations.”
    Do not claim autonomous production remediation, live incident accuracy,
    realized cost savings or a continuously running AWS platform from this work.
18. **PR readiness:** ready for a **draft PR for the simulation platform and scoped
    read-adapter implementation**, subject to normal review and hosted CI. It is
    not a production rollout approval. The branch is local and has not been pushed.

## Executed checks

| Command / check                                                                             | Actual outcome                                                                                   |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `npm ci`                                                                                    | Passed; existing deprecation notices                                                             |
| `npm run typecheck`                                                                         | Passed                                                                                           |
| `npm run test:run`                                                                          | 63 passed, 13 test files                                                                         |
| `npm run build`                                                                             | Passed; existing Vite static/dynamic import warning                                              |
| `npm --prefix backend ci`                                                                   | Passed; existing deprecation notices                                                             |
| `npm --prefix backend run db:generate`                                                      | Passed after allowing Prisma cache access                                                        |
| `npm --prefix backend run typecheck`                                                        | Passed                                                                                           |
| `npm --prefix backend run build`                                                            | Passed                                                                                           |
| `npm --prefix backend run test:db:prepare`                                                  | Passed against isolated `finance_ai_test`                                                        |
| `npm --prefix backend run test:ci`                                                          | 206 passed, 13 intentionally skipped; integration coverage run separately                        |
| `npm --prefix backend run test:integration`                                                 | 14 passed, all 5 integration files                                                               |
| `pytest agent-service/tests` with local test PostgreSQL                                     | 33 passed, zero skipped                                                                          |
| Agent Ruff lint/format                                                                      | Passed                                                                                           |
| Agent mypy                                                                                  | Passed, 26 source files                                                                          |
| `pip check`                                                                                 | Passed                                                                                           |
| `python -m app.evals.run`                                                                   | All 12 scenarios passed; actual JSON committed                                                   |
| `docker build -t finance-ai-agent:test agent-service`                                       | Passed                                                                                           |
| Packaged evaluations in `docker run --rm --read-only --tmpfs /tmp`                          | 12/12 passed under image's non-root runtime                                                      |
| `trivy image --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 finance-ai-agent:test` | Final scan passed; zero fixable HIGH/CRITICAL findings                                           |
| `./scripts/terraform-validate.sh`                                                           | Formatting and all root validations/mock tests passed, including both new IRSA module tests      |
| `helm lint deploy/helm/finance-ai`                                                          | Passed; chart icon recommendation only                                                           |
| `python3 scripts/test-agent-helm.py`                                                        | Disabled, simulation, live RBAC, secret references and denied live writes passed                 |
| `python3 scripts/test-production-values.py`                                                 | Existing production values/rendering checks passed                                               |
| `K8S_LOCAL_STATIC_ONLY=true ./scripts/k8s-local-validate.sh`                                | Existing static chart checks passed                                                              |
| Targeted frontend ESLint and commit hooks                                                   | Passed                                                                                           |
| Browser QA                                                                                  | All three workflows rendered; desktop 1440px and mobile 390px/320px, no horizontal page overflow |
| `git diff --check`                                                                          | Passed                                                                                           |

The browser check used responses generated by the real simulation orchestrator and
intercepted the backend HTTP layer; it does not claim a live identity/AWS browser
integration. The administrator proxy has separate boundary tests.

## Failures encountered and resolved

- Sandbox restrictions initially blocked PyPI/provider downloads, Prisma cache
  writes, local listeners, Docker access, and PostgreSQL connections. The affected
  commands were rerun with explicit execution permission. The database remained
  the isolated local test container, never the application database.
- Docker Desktop was initially stopped; it was started for the requested checks.
- Backend types initially failed because Prisma generation had been blocked;
  generation and subsequent type/build checks passed.
- Initial Python typing/lint and frontend compatibility issues were fixed before
  the final successful checks.
- The first image scan found 13 fixable HIGH/CRITICAL findings in Debian PCRE2,
  OpenSSL and Perl packages; the Docker base now applies published distribution
  security updates. The final scan reports zero such findings. The gate was not
  relaxed and no CVEs were ignored to achieve this result.

## Deliberately not executed

No Terraform apply, real AWS API investigation, paid OpenAI inference, GitHub remote
mutation, DNS change, cluster deployment, live rollback, or resource deletion.
Full existing kind-cluster lifecycle/browser-smoke workflows and hosted Actions
execution were not run; their static checks and the required local unit,
integration, image, Terraform, Helm and new browser checks were run as listed.

The local PostgreSQL test container and Docker Desktop were started for validation.
No test database was added to Git. No runtime cache, Terraform state, dependency
installation directory or screenshot is part of the committed deliverable.
