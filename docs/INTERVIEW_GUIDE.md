# FIN-AI interview guide

## 60–90 second pitch

FIN-AI is a personal finance platform that lets users track transactions, manage
budgets, and plan goals. The Finance Advisor sits inside the authenticated
Express API. It turns a question into a bounded tool plan, then cites the user's
recorded evidence. For a scenario like cutting dining spending by 20%, the
finance engine calculates the change in monthly savings and the modeled goal
timeline. The workflow leaves the ledger unchanged.

A separate FastAPI service helps an operator diagnose incidents, review
deployments, and investigate AWS cost drivers. It reads structured infrastructure
evidence through MCP and can abstain if the evidence is stale, incomplete, or
contradictory. IAM, Kubernetes RBAC, and the approval policy sit outside the
model. Both agent systems emit OpenTelemetry spans and metrics.

The repository includes Terraform and Helm for an EKS deployment, OIDC-based
image publishing, PostgreSQL integration tests, container scans, and deterministic
agent evaluations. The local demo reproduces the workflows with fixtures and
mock providers. The validation results describe synthetic coverage.

## Why MCP?

MCP gives the operations service a standard, discoverable interface with typed
inputs, structured results, and source provenance. The same readers serve SRE,
Deployment, FinOps, and an independent MCP client. Each reader has a code-enforced
policy, bounded scope, timeout, and output sanitizer. The exposed surface is a
fixed set of infrastructure reads.

## Why deterministic finance tools?

An LLM can interpret intent and choose useful checks. Money calculations need
repeatable decimal arithmetic and application-owned data. Tools derive amounts
from the authenticated ledger and goals, and the renderer builds findings from
validated evidence. An invented salary, transaction, or goal balance cannot
override those values. The same inputs reproduce the same scenario arithmetic.

## Why simulation mode?

Leaving EKS, RDS, and Valkey running for a portfolio demo adds idle cost. Fixtures
let CI repeat realistic and adversarial cases on demand. Live adapters and
fixtures use the same workflow contracts, and the dashboard identifies simulated
infrastructure results explicitly.

## Why bounded agents?

Unrestricted loops make latency, cost, and security difficult to reason about.
Both systems enforce tool budgets, timeouts, and request deadlines. Tool
authorization is checked in code. Workflows stop and report insufficient
evidence when the available observations cannot support a conclusion.

## Why separate Finance Advisor and Cloud Ops?

The Advisor belongs beside authenticated finance services and user-scoped data
in Express. Cloud Ops has an administrator entry point, infrastructure
credentials, and a different failure boundary. The separate service and fixed
proxy reduce unnecessary movement of personal data and keep product and
infrastructure privileges separate.

## Why require approval for remediation?

Diagnosis can run with read access. Remediation changes system state, so approval
uses separate operator credentials, a policy check, an expiring proposal, and a
hash that binds the reviewed payload. The current implementation validates and
audits this workflow in simulation. Real executors remain future work.

[Architecture](../README.md#architecture) · [Demo walkthrough](DEMO_SCRIPT.md) ·
[Validation](../README.md#validated)
