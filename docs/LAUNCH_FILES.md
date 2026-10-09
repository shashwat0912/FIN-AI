# Exact files changed by this task

Statuses: A = added, M = modified, D = deleted. File links are repository-relative for GitHub.

100 task files; many frontend edits remove unused imports to enable the actual app typecheck.

| Status | File                                                                                                                                                                        |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M      | [.dockerignore](../.dockerignore)                                                                                                                                           |
| M      | [.github/workflows/ci.yml](../.github/workflows/ci.yml)                                                                                                                     |
| M      | [.gitignore](../.gitignore)                                                                                                                                                 |
| M      | [Dockerfile.frontend](../Dockerfile.frontend)                                                                                                                               |
| M      | [README.md](../README.md)                                                                                                                                                   |
| M      | [backend/.env.example](../backend/.env.example)                                                                                                                             |
| M      | [backend/DATABASE_SETUP.md](../backend/DATABASE_SETUP.md)                                                                                                                   |
| M      | [backend/Dockerfile](../backend/Dockerfile)                                                                                                                                 |
| M      | [backend/package-lock.json](../backend/package-lock.json)                                                                                                                   |
| M      | [backend/package.json](../backend/package.json)                                                                                                                             |
| M      | [backend/prisma/schema.prisma](../backend/prisma/schema.prisma)                                                                                                             |
| M      | [backend/src/config/env.ts](../backend/src/config/env.ts)                                                                                                                   |
| M      | [backend/src/config/logger.ts](../backend/src/config/logger.ts)                                                                                                             |
| M      | [backend/src/middleware/validation.ts](../backend/src/middleware/validation.ts)                                                                                             |
| M      | [backend/src/services/knowledgeBaseService.ts](../backend/src/services/knowledgeBaseService.ts)                                                                             |
| M      | [backend/src/services/notificationService.ts](../backend/src/services/notificationService.ts)                                                                               |
| M      | [backend/src/services/otpService.ts](../backend/src/services/otpService.ts)                                                                                                 |
| D      | `backend/src/types/sentry.d.ts` (deleted)                                                                                                                                   |
| A      | [backend/tests/demoAuth.test.ts](../backend/tests/demoAuth.test.ts)                                                                                                         |
| A      | [backend/tests/knowledge.test.ts](../backend/tests/knowledge.test.ts)                                                                                                       |
| M      | [backend/tests/otp.test.ts](../backend/tests/otp.test.ts)                                                                                                                   |
| M      | [backend/tests/services/authService.test.ts](../backend/tests/services/authService.test.ts)                                                                                 |
| M      | [backend/tests/setup/testEnv.ts](../backend/tests/setup/testEnv.ts)                                                                                                         |
| M      | [deploy/helm/finance-ai/README.md](../deploy/helm/finance-ai/README.md)                                                                                                     |
| M      | [deploy/helm/finance-ai/templates/backend-service.yaml](../deploy/helm/finance-ai/templates/backend-service.yaml)                                                           |
| M      | [deploy/helm/finance-ai/templates/frontend-service.yaml](../deploy/helm/finance-ai/templates/frontend-service.yaml)                                                         |
| M      | [deploy/helm/finance-ai/templates/migration-job.yaml](../deploy/helm/finance-ai/templates/migration-job.yaml)                                                               |
| A      | [deploy/helm/finance-ai/templates/validate-launch.yaml](../deploy/helm/finance-ai/templates/validate-launch.yaml)                                                           |
| M      | [deploy/helm/finance-ai/values-production.yaml](../deploy/helm/finance-ai/values-production.yaml)                                                                           |
| M      | [deploy/helm/finance-ai/values.schema.json](../deploy/helm/finance-ai/values.schema.json)                                                                                   |
| M      | [deploy/helm/finance-ai/values.yaml](../deploy/helm/finance-ai/values.yaml)                                                                                                 |
| M      | [deploy/local/README.md](../deploy/local/README.md)                                                                                                                         |
| M      | [deploy/local/migrate.yaml](../deploy/local/migrate.yaml)                                                                                                                   |
| A      | [docs/LAUNCH_FILES.md](LAUNCH_FILES.md)                                                                                                                                     |
| A      | [docs/LAUNCH_REPORT.md](LAUNCH_REPORT.md)                                                                                                                                   |
| A      | [docs/PUBLIC_DEMO.md](PUBLIC_DEMO.md)                                                                                                                                       |
| A      | [docs/SECRET_SCAN_REVIEW.md](SECRET_SCAN_REVIEW.md)                                                                                                                         |
| M      | [docs/otp/README.md](otp/README.md)                                                                                                                                         |
| A      | [e2e/demo.spec.ts](../e2e/demo.spec.ts)                                                                                                                                     |
| M      | [frontend/App.tsx](../frontend/App.tsx)                                                                                                                                     |
| M      | [frontend/**tests**/pages/financeLedgerMutations.test.tsx](../frontend/__tests__/pages/financeLedgerMutations.test.tsx)                                                     |
| M      | [frontend/components/Dashboard.tsx](../frontend/components/Dashboard.tsx)                                                                                                   |
| M      | [frontend/components/ErrorBoundary.tsx](../frontend/components/ErrorBoundary.tsx)                                                                                           |
| M      | [frontend/components/MobileHeader.tsx](../frontend/components/MobileHeader.tsx)                                                                                             |
| A      | [frontend/components/OtpLoginForm.test.tsx](../frontend/components/OtpLoginForm.test.tsx)                                                                                   |
| M      | [frontend/components/OtpLoginForm.tsx](../frontend/components/OtpLoginForm.tsx)                                                                                             |
| M      | [frontend/components/Sidebar.tsx](../frontend/components/Sidebar.tsx)                                                                                                       |
| M      | [frontend/components/SimpleLoginForm.tsx](../frontend/components/SimpleLoginForm.tsx)                                                                                       |
| M      | [frontend/components/TopBar.tsx](../frontend/components/TopBar.tsx)                                                                                                         |
| M      | [frontend/components/common/DarkModeToggle.tsx](../frontend/components/common/DarkModeToggle.tsx)                                                                           |
| M      | [frontend/components/common/LoadingScreen.tsx](../frontend/components/common/LoadingScreen.tsx)                                                                             |
| M      | [frontend/components/common/ThemeTransition.tsx](../frontend/components/common/ThemeTransition.tsx)                                                                         |
| M      | [frontend/components/dashboard/AiAdvisor.tsx](../frontend/components/dashboard/AiAdvisor.tsx)                                                                               |
| M      | [frontend/components/dashboard/BalanceChart.tsx](../frontend/components/dashboard/BalanceChart.tsx)                                                                         |
| M      | [frontend/components/dashboard/StatCard.tsx](../frontend/components/dashboard/StatCard.tsx)                                                                                 |
| M      | [frontend/components/dashboard/StatsCards.tsx](../frontend/components/dashboard/StatsCards.tsx)                                                                             |
| M      | [frontend/components/dashboard/charts/ChartHeader.tsx](../frontend/components/dashboard/charts/ChartHeader.tsx)                                                             |
| M      | [frontend/components/dashboard/charts/ChartStats.tsx](../frontend/components/dashboard/charts/ChartStats.tsx)                                                               |
| M      | [frontend/components/dashboard/charts/ChartTooltip.tsx](../frontend/components/dashboard/charts/ChartTooltip.tsx)                                                           |
| M      | [frontend/components/layout/MobileHeader.tsx](../frontend/components/layout/MobileHeader.tsx)                                                                               |
| M      | [frontend/components/layout/Sidebar.tsx](../frontend/components/layout/Sidebar.tsx)                                                                                         |
| M      | [frontend/components/layout/SimpleTopBar.tsx](../frontend/components/layout/SimpleTopBar.tsx)                                                                               |
| M      | [frontend/components/layout/TopBar.tsx](../frontend/components/layout/TopBar.tsx)                                                                                           |
| M      | [frontend/components/settings/NotificationSettings.tsx](../frontend/components/settings/NotificationSettings.tsx)                                                           |
| M      | [frontend/components/settings/PreferenceSettings.tsx](../frontend/components/settings/PreferenceSettings.tsx)                                                               |
| M      | [frontend/components/settings/ProfileSettings.tsx](../frontend/components/settings/ProfileSettings.tsx)                                                                     |
| M      | [frontend/components/settings/SettingsHeader.tsx](../frontend/components/settings/SettingsHeader.tsx)                                                                       |
| M      | [frontend/components/ui/FinanceLedger.tsx](../frontend/components/ui/FinanceLedger.tsx)                                                                                     |
| M      | [frontend/components/ui/PrivateLedger.tsx](../frontend/components/ui/PrivateLedger.tsx)                                                                                     |
| M      | [frontend/config/env.ts](../frontend/config/env.ts)                                                                                                                         |
| M      | [frontend/context/DarkModeContext.tsx](../frontend/context/DarkModeContext.tsx)                                                                                             |
| M      | [frontend/context/LanguageContext.tsx](../frontend/context/LanguageContext.tsx)                                                                                             |
| M      | [frontend/hooks/useBackendAi.ts](../frontend/hooks/useBackendAi.ts)                                                                                                         |
| M      | [frontend/hooks/useBackendAuth.ts](../frontend/hooks/useBackendAuth.ts)                                                                                                     |
| M      | [frontend/lib/openai.ts](../frontend/lib/openai.ts)                                                                                                                         |
| M      | [frontend/pages/Dashboard.tsx](../frontend/pages/Dashboard.tsx)                                                                                                             |
| M      | [frontend/pages/MvpCoach.tsx](../frontend/pages/MvpCoach.tsx)                                                                                                               |
| M      | [frontend/services/tokenRefreshService.ts](../frontend/services/tokenRefreshService.ts)                                                                                     |
| M      | [frontend/test/setup.ts](../frontend/test/setup.ts)                                                                                                                         |
| M      | [frontend/types/index.ts](../frontend/types/index.ts)                                                                                                                       |
| M      | [frontend/utils/apiUtils.ts](../frontend/utils/apiUtils.ts)                                                                                                                 |
| M      | [frontend/utils/logger.ts](../frontend/utils/logger.ts)                                                                                                                     |
| M      | [infra/terraform/environments/production/README.md](../infra/terraform/environments/production/README.md)                                                                   |
| A      | [infra/terraform/environments/production/addons.tf](../infra/terraform/environments/production/addons.tf)                                                                   |
| A      | [infra/terraform/environments/production/backend_irsa.tf](../infra/terraform/environments/production/backend_irsa.tf)                                                       |
| A      | [infra/terraform/environments/production/lbc-iam-policy.json](../infra/terraform/environments/production/lbc-iam-policy.json)                                               |
| A      | [infra/terraform/environments/production/monitoring.tf](../infra/terraform/environments/production/monitoring.tf)                                                           |
| M      | [infra/terraform/environments/production/outputs.tf](../infra/terraform/environments/production/outputs.tf)                                                                 |
| M      | [infra/terraform/environments/production/terraform.tfvars.example](../infra/terraform/environments/production/terraform.tfvars.example)                                     |
| M      | [infra/terraform/environments/production/tests/elasticache_valkey_wiring.tftest.hcl](../infra/terraform/environments/production/tests/elasticache_valkey_wiring.tftest.hcl) |
| M      | [infra/terraform/environments/staging/tests/ecr_wiring.tftest.hcl](../infra/terraform/environments/staging/tests/ecr_wiring.tftest.hcl)                                     |
| M      | [package-lock.json](../package-lock.json)                                                                                                                                   |
| M      | [package.json](../package.json)                                                                                                                                             |
| A      | [playwright.config.ts](../playwright.config.ts)                                                                                                                             |
| M      | [scripts/k8s-local-validate.sh](../scripts/k8s-local-validate.sh)                                                                                                           |
| A      | [scripts/production-values.py](../scripts/production-values.py)                                                                                                             |
| A      | [scripts/smoke-server.mjs](../scripts/smoke-server.mjs)                                                                                                                     |
| M      | [scripts/terraform-validate.sh](../scripts/terraform-validate.sh)                                                                                                           |
| A      | [scripts/test-production-values.py](../scripts/test-production-values.py)                                                                                                   |
| M      | [tsconfig.node.json](../tsconfig.node.json)                                                                                                                                 |

## Existing user work preserved

These changes existed before this task and are not claimed as new implementation:

- `PRODUCT.md`
- `infra/terraform/environments/staging/README.md`
- `infra/terraform/environments/staging/ecr.tf`
- `infra/terraform/environments/staging/outputs.tf`
- `infra/terraform/shared/ecr/.terraform.lock.hcl`
- `infra/terraform/shared/ecr/README.md`
- `infra/terraform/shared/ecr/backend.hcl.example`
- `infra/terraform/shared/ecr/backend.tf`
- `infra/terraform/shared/ecr/main.tf`
- `infra/terraform/shared/ecr/outputs.tf`
- `infra/terraform/shared/ecr/providers.tf`
- `infra/terraform/shared/ecr/versions.tf`

The existing shared-ECR move is validated by the adjusted staging test and Terraform script.
