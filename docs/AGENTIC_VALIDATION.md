# Agentic platform validation

Updated **3 November 2026** after hardening `feat/agentic-cloud-ops`. FIN-AI remains
the workload. No new major agent, replacement architecture, AWS deployment,
Terraform apply, DNS change or live remediation was introduced.

## Adversarial coverage and actual results

The suite has the original 12 incident cases plus 12 adversarial/ambiguous or
healthy cases:

| New case                     | Expected outcome                                    |
| ---------------------------- | --------------------------------------------------- |
| Contradictory telemetry      | INSUFFICIENT_EVIDENCE                               |
| Stale CloudWatch metrics     | INSUFFICIENT_EVIDENCE                               |
| Missing Kubernetes events    | OOM diagnosis from remaining authoritative evidence |
| MCP/tool timeout             | INSUFFICIENT_EVIDENCE                               |
| Malformed tool output        | INSUFFICIENT_EVIDENCE                               |
| Two simultaneous faults      | Both PostgreSQL and Valkey causes                   |
| Misleading application logs  | INSUFFICIENT_EVIDENCE                               |
| Prompt injection inside logs | INSUFFICIENT_EVIDENCE, no action                    |
| Healthy system / no incident | HEALTHY, no action                                  |
| Unknown root cause           | INSUFFICIENT_EVIDENCE                               |
| Incorrect initial hypothesis | Actual OOM cause, not the suggested database cause  |
| Partial AWS outage           | INSUFFICIENT_EVIDENCE                               |

[Machine-generated results](agent-evaluation.json) are produced by
`python -m app.evals.run`, never manually edited. Actual local results:

- **24/24 correct outcomes:** 15/15 diagnoses, 8/8 abstentions, 1/1 healthy result.
- **100%** required usable-evidence coverage and required attempted tool selection.
- **Zero unsafe actions**, one pending permitted proposal, zero executions.
- Mean **5.38 tool calls**, **10.38 investigation steps**, **2.88 calls above the
  scenario minimum**. Extra calls are an overhead proxy, not proof each was useless.
- Non-abstention confidence Brier score **0.0119**; zero false confident diagnoses.

These are deterministic synthetic results, not held-out incident accuracy or
real-world confidence calibration. OpenAI is contract-tested with a mocked
response; no paid inference or live AWS investigation was run.

## Security and interoperability results

The shared adapter/MCP-receiver boundary now applies typed field projection,
16 KB output bounds, bounded nesting/collections/strings, explicit truncation,
credential/environment/Secret redaction, fixed untrusted labels and provenance.
Stale, malformed, truncated and timestamp-unknown data cannot support diagnosis.
Log text cannot authorize a tool/action. Terraform state shapes are explicitly
rejected; only plan/change summaries and selected non-sensitive outputs are exposed.

An **independent official SDK Client connected over stdio to a separate server
process**, bypassing the FIN-AI client code. Discovery, input schemas, valid calls,
invalid/missing/malformed argument rejection, actual deadline cancellation,
structured errors, correlation metadata and no-secret-leakage assertions passed.
SDK argument validation was configured to omit submitted values from errors.

Approval review/tests cover payload hashing, human-supplied hash comparison,
identity, action/environment/target/parameter binding, expiry, full-record atomic
claims, concurrent/replayed approval, denied/failed/executing records and mutation
between validation and claim. PostgreSQL checks expiry inside the claim UPDATE.
There is no live executor. SHA-256 binds the reviewed payload; it does not replace
operator authentication or provide per-person SSO attribution.

Trace tests inspect complete exported span JSON and metric labels using injected
prompt, log and credential markers, including exceptions raised inside provider
correlation. No markers reach attributes, events or labels. Fixed names and
low-cardinality status/count metadata are retained. External OTLP is unvalidated.

## Deployment windows

The API accepts a deployment timestamp and bounded baseline/observation durations,
or resolves the matching SHA's timestamp from GitHub deployment metadata. Before/
after windows cover P95, optional P99, error rate, 5xx, readiness failures, restarts,
rollout and migration evidence. Percentile comparisons use median one-minute bucket
percentiles, not claimed pooled percentiles. Required windows need at least 80%
minute coverage and three buckets. A lone current point, sparse/missing baseline,
future/stale observation or timestamp mismatch returns HOLD/INSUFFICIENT_EVIDENCE
with confidence zero. Tests confirm a single minute spike does not force a
regression, while sustained P99/5xx/readiness/restart regressions are detected.

## Executed local checks

| Check                                                    | Actual result                                         |
| -------------------------------------------------------- | ----------------------------------------------------- |
| Root `npm ci`, typecheck, tests, build                   | Passed; 63 frontend tests                             |
| Backend `npm ci`, Prisma generation, typecheck, build    | Passed                                                |
| Backend `test:ci`                                        | 206 passed, 13 existing intentional skips             |
| Backend `test:integration`                               | All 14 passed against isolated PostgreSQL             |
| Agent pytest with isolated PostgreSQL                    | 66 passed, zero skipped                               |
| Agent Ruff lint/format and mypy                          | Passed; 29 application source files                   |
| Evaluation runner                                        | All 24 outcomes passed; JSON committed                |
| Docker build and packaged read-only/non-root evaluations | Passed; 24/24 outcomes                                |
| Trivy HIGH/CRITICAL, ignore-unfixed, exit-code 1         | Passed; zero fixable findings                         |
| CycloneDX SBOM inventory                                 | Generated locally; CI uploads the agent SBOM artifact |
| Terraform validation and mocked tests                    | Passed; no apply or live provider operations          |
| Helm lint and optional agent render/policy tests         | Passed                                                |
| Existing production-values and static Kubernetes checks  | Passed                                                |
| Targeted frontend lint / commit hooks                    | Passed                                                |

Existing dependency deprecation notices, the Vite import warning, Helm icon
recommendation and Terraform backend-in-module warnings remain non-blocking.
Security and CI thresholds were not relaxed. Hosted Actions results are assessed
on the draft PR's latest head; local checks do not stand in for hosted CI.

## Image milestone, scope and merge recommendation

SBOM inventory is implemented as a separate additive CI step. Image signing,
attested SHA-to-digest provenance and verification are the next DevSecOps milestone;
no signing framework or deployment gate claiming those properties was added.

The exact diff is listed in [AGENTIC_FILES.md](AGENTIC_FILES.md). Architecture and
local demo instructions are in [AGENTIC_PLATFORM.md](AGENTIC_PLATFORM.md).

This is a simulation-tested platform/read-adapter PR. Merge can be considered
only after normal review and green hosted CI. It does not establish production
readiness. Remaining validation includes real AWS/GitHub telemetry and access,
custom CloudWatch metric availability, actual billing scope, external OTLP,
production deployment and live incident accuracy. No live remediation, individual
SSO approval, immutable external audit archive or image attestation is claimed.

A truthful resume description is: “Built and adversarially tested an AI operations
layer for a finance workload targeting EKS, using FastAPI, MCP, OpenTelemetry,
PostgreSQL approval/audit records, simulation-only remediation, scoped IRSA/RBAC,
deployment-window analysis, and deterministic incident evaluations.”

## Hosted security corrections

The first hosted Security and Docker jobs failed on existing HIGH runtime findings
in body-parser 1.20.5 and Joi 17.13.8. The backend lockfile now resolves compatible
body-parser 1.20.9 and Joi 17.13.9 patches within the existing declared ranges;
additional compatible transitive/address-parser patches were resolved by npm.
Backend install, generation, types/build, all 206 unit/service tests and 14
integration tests passed again. Runtime audit passes the unchanged HIGH threshold;
two existing moderate qs advisories remain below that threshold. The patched
backend image also passed the unchanged Trivy HIGH/CRITICAL gate. As before,
runtime gates omit development dependencies; this does not claim that all
Dependabot advisories across the repository are resolved.

Gitleaks also identified a synthetic base64 API-key field in the new Secret
redaction test. It was replaced by an obvious short public dummy value without
changing the redaction assertion. The correction was squashed into the three new
feature-branch hardening commits so the false positive is absent from their
history. No detector, ignore list, severity threshold or CI gate was relaxed.
The complete history reachable from the corrected feature head passes Gitleaks;
main and the six earlier implementation commits were preserved. The remote
feature update uses an explicit expected-SHA lease to avoid overwriting another
contributor's changes.

The partial-AWS-outage fixture deliberately retains healthy-looking Kubernetes
observations while dependency reads fail: a HEALTHY outcome requires every
attempted check to be usable, so unavailable AWS evidence is never silently
summarized as healthy. Corroborated diagnoses can still use sufficient remaining
authoritative observations, as the missing-events OOM case demonstrates.
