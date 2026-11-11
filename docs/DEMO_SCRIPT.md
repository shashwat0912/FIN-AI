# FIN-AI demo script

Run this 6½-minute walkthrough on a local synthetic ledger with the Advisor
mock provider and Cloud Ops simulation. Open the dashboard, the README
architecture diagram, and the hosted workflow runs before starting.

| Time          | What to show and say                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0:00–0:45** | Open the [architecture diagram](../README.md#architecture). Trace a product request through React, Express, the finance engine, and PostgreSQL. Point out the Advisor inside Express and the admin proxy to the separate FastAPI service. Finish at the MCP readers and the Terraform, Helm, and GitHub Actions foundation.                                                                                                                                                                                                                     |
| **0:45–2:15** | In **AI Advisor**, ask “Reduce dining spending by 20%. How does this change my goal timeline?” Show the recorded cash flow, goal evidence, and scenario impact. Expand **Assumptions and activity**. Explain the previous complete month, fixed costs, and all surplus going to the selected goal. “The LLM decides what information is relevant. The financial engine calculates the money.” The scenario leaves the ledger unchanged.                                                                                                         |
| **2:15–4:00** | In **Cloud Ops**, choose **Database connection saturation** and ask “Why is backend readiness failing?” Point to the simulation label, diagnosis, confidence estimate, and suggested checks. Expand **Evidence and tools** to show Kubernetes readiness and logs, CloudWatch corroboration, and RDS at 98 of 100 connections. Switch to **Stale CloudWatch metrics** or **Contradictory telemetry** and investigate again to show abstention. “The agent operates through scoped MCP readers. There is no arbitrary shell or AWS command tool.” |
| **4:00–5:00** | Select **Bad deployment**, leave the fixture SHA in place, and choose **Review deployment**. Compare baseline and observation windows, then inspect rollout evidence and the recommendation. Explain that missing or stale deployment-aligned metrics can produce **HOLD**. A rollback recommendation goes to an operator.                                                                                                                                                                                                                      |
| **5:00–5:45** | Select **Healthy infrastructure** and choose **Analyse costs**. Compare current and prior service costs, point out the largest driver, and show why missing utilization or pricing evidence leaves estimated savings unavailable.                                                                                                                                                                                                                                                                                                               |
| **5:45–6:30** | Open [main CI](https://github.com/shashwat0912/FIN-AI/actions/runs/42204417711) and [Agent Platform](https://github.com/shashwat0912/FIN-AI/actions/runs/42204417784). Point to Gitleaks, Trivy, Docker, PostgreSQL integration tests, Terraform and Helm validation, and the agent evaluation artifacts. Explain the distinction between synthetic regression coverage and production accuracy.                                                                                                                                                |

Close with this line:

> FIN-AI is intentionally not kept live on AWS continuously. The same architecture can be deployed through the checked-in Terraform and Helm definitions, while simulation mode keeps the project reproducible at near-zero idle cost.

## Local setup and screenshot capture

From the repository root, install dependencies and generate the Prisma client as
shown in the [README](../README.md#local-development-and-demo). Install the
existing Playwright browser and prepare the disposable Compose database.

```sh
npx playwright install chromium
docker compose -f backend/docker-compose.test.yml up -d --wait postgres-test
TEST_DATABASE_URL=postgresql://financeai_test@localhost:5433/finance_ai_test \
  npm --prefix backend run test:db:prepare
```

Start the [Cloud Ops simulator](AGENTIC_PLATFORM.md#local-demonstration-without-aws)
on port 8000 with the mock provider and write actions disabled. In a second
terminal, run the existing smoke server with the same reader token in the
backend environment. This server uses port 3001, development OTP, the test
database, and mock Advisor.

```sh
export TEST_DATABASE_URL=postgresql://financeai_test@localhost:5433/finance_ai_test
export AGENT_SERVICE_URL=http://127.0.0.1:8000
# Set AGENT_API_TOKEN to the simulator's local reader token in this terminal.
OPENAI_API_KEY='' node scripts/smoke-server.mjs
```

In a third terminal, start the frontend.

```sh
VITE_API_BASE_URL=http://127.0.0.1:3001/api/v1 npm run dev:frontend -- --host 127.0.0.1 --port 5173 --strictPort
```

For a live walkthrough, run `node scripts/capture-portfolio-demo.mjs --walkthrough`
from another terminal. It opens a signed-in browser with the synthetic ledger
ready to use. Press Enter in that terminal when the walkthrough ends.

Run the same command without `--walkthrough` to regenerate the screenshots. It creates a
temporary administrator with a synthetic ledger in the disposable database,
signs in through the local OTP flow, calls the real Advisor and Cloud Ops
routes, and writes three workspace crops to [`docs/assets/demo/`](assets/demo/).
The capture excludes the account sidebar and browser chrome, shows selected
Cloud Ops evidence cards, checks the visible
workspace for private-looking text, and removes the seeded user on exit.
Stop the three local services and the test database when finished.

```sh
docker compose -f backend/docker-compose.test.yml stop postgres-test
```
