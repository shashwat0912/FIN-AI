# Secret-history audit — 9 October 2026

Audit branch: `codex/public-demo-readiness`; HEAD `5beb914` unchanged.
No credential was used to authenticate to a provider. Local key retirement is
documented below; no external rotation, history rewrite, commit, push or AWS
operation was performed. Secret values are intentionally omitted.

## Outcome after deployment-boundary review

All **42 original findings** remain accounted for: **8 potentially real JWT
occurrences**, **12 retired unused-key occurrences**, **4 CI fixture occurrences**,
and **18 curl/example false positives**. The original 20 potentially real
occurrences represent four distinct values; this review does not relabel the JWT
values as fake. Both JWT keys are **C — cannot determine historical external use**.
The operator answered Unknown. No evidence proves the old EC2 environment was
terminated or that its accepting keys were replaced.

The eight remaining exact fingerprints are excepted on a narrower basis:
**retired for the isolated future public-demo environment**, with a production
startup guard against either historical value in either JWT role, independent
fresh signing keys, a fresh deployment Secret and no imported refresh/session
records. See the mandatory deployment boundary below and PUBLIC_DEMO.md. This
is defensible for that new trust domain; it does not certify old EC2/shared stores
as safe or revoke their credentials. An old accepting environment must be treated
as compromised until its owner rotates both keys/revokes sessions or decommissions it.

`.gitleaksignore` now contains **42 exact historical fingerprints**: 22 safe
fixture/example entries, 12 retired unused-key entries and 8 explicitly scoped
JWT retirement entries. No rule, file, directory or secret value is broadly
allowed. New occurrences remain detectable. Full-history and ignored-inclusive
working-tree results are recorded below after verification.

## Method and limits

Reviewed each historical blob at the reported commit and line, surrounding
configuration and callers. Compared all six distinct detected values against all
available Git blob objects across local refs and first-party working files. Both
HEAD tracked blobs and tracked/untracked first-party source contain none of those
six values. The four formerly persisted values have now been removed from ignored `backend/.env`.
The two test values appear in history only in `.github/workflows/ci.yml`, under
NODE_ENV=test with disposable SQLite configuration; neither exists in the current
tree. Both fixture values are distinct from all four operational keys.

`git rev-list --all --count` counts 194 reachable commits (189 non-merge); Gitleaks
reports 182 scanned commits and the same original 42 findings using `--all`.
The scanner count is not used as the reachability count. All reachable blob objects
were separately checked for the six underlying historical values.
This audit covers locally available refs, not unknown remote-only refs, deleted
GitHub objects, forks, other clones, account configuration or cloud secret stores.
No evidence proves account-side retirement. No new commit or staged file exists.

The original audit copied 466/467 first-party files; the retirement verification
copied 468 files into a private temporary
directory, preserving content, and ran Gitleaks there. It included `.env*`, workflows,
Terraform/tfvars/state/backend config, Kubernetes/Helm, docs, fixtures and Docker files.
Excluded only `.git` object storage, dependency/vendor/build caches (`node_modules`,
`.terraform`, `dist`, `dist-ssr`, `__pycache__`) and generated browser traces/reports.
Those generated/dependency files were not claimed secret-clean; browser traces may
contain ephemeral tokens and must stay private. Historical Git objects were
inspected separately. The temporary private copy was removed after verification.

Ignored sensitive paths inspected: `.env`, `backend/.env`,
`infra/terraform/bootstrap/terraform.tfstate`, `infra/terraform/bootstrap/terraform.tfvars`,
`infra/terraform/environments/staging/backend.hcl`,
`infra/terraform/environments/staging/terraform.tfvars`,
`infra/terraform/shared/ecr/backend.hcl`, and
`infra/terraform/shared/github-actions/backend.hcl`.
Tracked `frontend/.env.example` and `backend/.env.example` were also inspected.
No Gitleaks findings were reported in the Terraform/Helm/Docker/doc/test
files or other inspected configuration outside the two private env files in this current-tree scan. This is a scanner/equality check, not a guarantee
that every possible secret format is detected.

## Current status of the four historical keys

| Group                                                                     | Historical occurrences  | Status                                                                                                                               | Remaining action                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| K1: JWT_SECRET (historically also used for JWT_REFRESH_SECRET in Compose) | F01,F02,F10,F17,F21     | Removed locally; fresh process-only development signing key. External use unknown.                                                   | Inventory any deployed/shared copies, replace every accepting key (including any refresh role reusing K1), and revoke affected sessions. Five exact exceptions scoped to the fresh demo boundary; old external environments remain unverified. |
| K2: JWT_REFRESH_SECRET                                                    | F11,F18,F22             | Removed locally; fresh process-only development signing key. External use unknown.                                                   | Inventory/replace every accepting copy; clear stored refresh sessions. Three exact exceptions scoped to the fresh demo boundary; old external environments remain unverified.                                                                  |
| K3: SESSION_SECRET                                                        | F12,F19,F23,F31,F35,F37 | Proven unused in current code and all available historical application source; removed locally and permanently retired for this app. | Six exact historical exceptions added; do not generate a replacement.                                                                                                                                                                          |
| K4: ENCRYPTION_KEY                                                        | F13,F20,F24,F32,F36,F38 | Proven unused in current code and all available historical application source; removed locally and permanently retired for this app. | Six exact historical exceptions added; no replacement or data migration needed for repository-managed data.                                                                                                                                    |

### Historical EC2/CD trace and A/B/C classification

| Key                                                               | External-use classification | Comparison identifier         | Evidence and limits                                                                                                                                                        |
| ----------------------------------------------------------------- | --------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| K1 / JWT_SECRET (also used in both development Compose JWT roles) | **C — cannot determine**    | SHA-256 prefix `2cb69e67e55e` | Committed local setup/development recipe; no exact-value link to EC2 runtime. No current project-file match; existing local development container comparison was NO MATCH. |
| K2 / JWT_REFRESH_SECRET                                           | **C — cannot determine**    | SHA-256 prefix `9a59139cc9cd` | Committed local setup/documentation; no exact-value link to EC2 runtime. No current project-file match; existing local development container comparison was NO MATCH.      |

Reviewed all four distinct historical `.github/workflows/cd.yml` versions:
`f5171b78dc38`, `ef9e82dc6a17`, `f7e5bcf59ba7`, `830f2113ce2f`.
They build/publish images and optionally deploy over SSH. The newest transfers
only `docker-compose.prod.yml` to `/home/ubuntu/apps/FIN-AI`; older versions use
DEPLOY_PATH and permit a DEPLOY_COMMAND override. Generated `.release.env` contains
image references, not JWT material. The relevant GitHub Secret references are
DEPLOY_HOST, DEPLOY_USER, DEPLOY_SSH_KEY and GITHUB_TOKEN. **There is no JWT_SECRET,
JWT_REFRESH_SECRET or ENV_FILE Secret reference, encoded env payload or local
.env transfer in these workflows.** A reference alone would not establish a
stored secret value or successful deployment anyway. Repository variable overrides,
manual server setup and GitHub run/account configuration remain unknown.

Reviewed all eight distinct production Compose versions at `9398ad360335`,
`ef9e82dc6a17`, `86650a80015b`, `043d243db825`, `4b20df97a074`, `c6870eb4eefa`,
`d02f97d182d9`, `63702fef0660`. They interpolate JWT_SECRET/JWT_REFRESH_SECRET
from the host environment/Compose env file. Both exact historical values are
**NO MATCH** in every production manifest; placeholders cannot identify the host's
actual values. `backend/docker-compose.yml` at `043d243db825` directly commits K1
in both roles with NODE_ENV=development. `secure-env-setup.sh` at `63702fef0660`
contains literal K1/K2 and writes a local .env; its wording about generation is
not evidence that keys were generated on EC2. ENVIRONMENT_SECURITY_GUIDE and
DEPLOYMENT_READY describe random key generation/manual environment setup, but
provide no execution record. README local env-copy instructions also do not prove
server copying. Thus: independent server generation **unknown**; copying local
.env **unknown**; JWT delivery through the inspected CD workflow **not present**;
values committed directly **yes, in local recipes/docs**; exact deployed match
**not established**.

All reachable historical blobs and project-local env/backups/deployment artifacts
were compared without printing values. No exact JWT match was found in historical
Kubernetes/Helm or Terraform/shared-store configuration. No recoverable old EC2
env backup was found in this project. Current legacy-EC2 migration documentation
mentions EC2 coexistence; it does not prove retirement. No unrelated personal
directories, remote host, cloud account or GitHub secret values were inspected.
These negative searches cannot prove A; there is also no affirmative evidence for B.

### Mandatory fresh public-demo boundary

1. Generate two independent new cryptographic JWT keys, never copy old local/EC2
   env files or shared secrets. Production config rejects either known historical
   fingerprint in either signing role, before startup; fresh generation remains
   required for every other key as well. Hash prefixes are denial identifiers,
   not secret values or authentication verifiers.
2. Create a fresh runtime Kubernetes Secret in the new isolated environment; do
   not reuse an existing Secret or route traffic to old accepting processes.
3. Bootstrap a fresh database and import no old refresh-token/session records,
   DB snapshots or auth volumes. Verify refresh_tokens is empty before opening
   public traffic. The rebuilt refresh service verifies signatures before DB lookup.
4. Verify the rebuilt production image is running the new keys, old signatures
   return 401 and new email login/refresh succeeds. Operator steps are in PUBLIC_DEMO.md;
   none was executed here.

Under these conditions neither key can sign a token accepted by the new environment:
fresh access/refresh signatures are independent and old refresh sessions do not
exist there. Historical exposure can still affect any old environment accepting
them. That owner-side risk is separate from the new demo and is not erased by an
exception or history rewrite. If this boundary cannot be met, **do not deploy**;
reopen the exception decision and investigate accepting systems.

### ENCRYPTION_KEY and SESSION_SECRET trace

Searched current backend/frontend/config/schema/scripts/deployments and every
reachable historical blob. ENCRYPTION_KEY/SESSION_SECRET references occur only in
historical setup scripts and security documentation (plus the audit report).
There is no process.env/config consumer, cipher/decipher call, crypto-js consumer,
or application encrypt/decrypt implementation in available history. Old setup
scripts wrote and printed the keys; documentation described desired protection,
not a working encryption feature. Neither appears in the active environment schema.
Password/OTP hashing and TLS do not read these keys. Prisma stores no key-dependent
ciphertext field and the app has no decryption step for PostgreSQL/files.

**ENCRYPTION_KEY protects no data in this application. Removing it cannot make
repository-managed existing data unreadable. SESSION_SECRET is also dead
configuration, not an Express session signing key.** No re-encryption is required
and no database/file data was changed. This does not prove that an unrelated
external program never reused the value. If such use is later discovered, back up
ciphertext, identify algorithms/key versions, decrypt with the old key and re-encrypt
with a fresh key in a verified migration before destroying it; rewriting Git alone
cannot restore confidentiality of an already copied ciphertext/key pair.

### Local cleanup and running-process boundary

Removed JWT_SECRET, JWT_REFRESH_SECRET, SESSION_SECRET and ENCRYPTION_KEY from
ignored backend/.env. Removed the separate unused persisted JWT_SECRET and
JWT_REFRESH_SECRET from ignored root .env. Both files remain ignored/untracked
with mode 0600. Other database/provider/config entries were preserved.
No historical value remains in inspected first-party files or tracked HEAD.
Only example env files are tracked; secret-bearing local env files are not.

Development now generates two distinct crypto.randomBytes(64) signing keys in
memory when unset/blank. They are never written to disk or printed. Existing
explicit keys remain supported. Test/production still require supplied keys and
retain strength checks; there is no production fallback. Development restarts sign
users out, including refresh sessions. The example env and setup instructions
reflect this behavior. SMTP/provider example values were left unchanged.

A local backend listener was traced to finance-ai-backend. A read-only Docker
inspection compared its configured keys in memory without displaying values:
it is development, neither JWT signing value matches any of the four historical
values, and neither unused key is configured. Its unrelated keys/container were
not changed. This does not deploy the code fix into that existing container; rebuild
any future image from this branch. No production process/account/DB was inspected.

### JWT verification and session invalidation

Access middleware verifies signatures with JWT_SECRET. Replacing that key makes
previous access JWTs invalid once every accepting process uses the replacement.
Refresh tokens are persisted as token strings in public.refresh_tokens with userId
and expiresAt. Previously AuthService.refreshToken checked only the stored string
and DB expiry: changing JWT_REFRESH_SECRET alone could still refresh an old stored
JWT. The shared service now verifies HS256 signature and JWT expiry with the current
refresh key **before** looking up the stored session, translating failures to 401.
Tests verify rejection of old signatures, missing/revoked records, development ephemeral
keys and required production/test keys.

With the fix, new keys invalidate old signatures. Also revoke the persisted refresh
records to remove stale credentials and prevent revival if an old key is accidentally
restored. Existing AuthService.logoutAll(userId), exposed through authenticated
POST /api/v1/auth/logout-all, deletes all refresh records for that user. It is not a
global administrator logout and cannot revoke every user's session in one call.
No new endpoint or destructive database operation was added/executed. Local test
cleanup operates only on the existing guarded disposable \_test database.

### Exact operator procedure for a future real deployment — NOT RUN

1. Inventory every environment/shared store using K1/K2. Record retirement evidence
   without secret values. Build the image containing this signature fix. Configure
   independent fresh production keys through the private Secret/secret-manager
   workflow; never reuse historical/dev keys or put them in VITE variables.
2. In each affected environment, stop all accepting backend replicas during the
   coordinated cutover. The commands below apply to the documented production
   namespace/name only after explicit deployment approval; use the actual names
   for staging. Save the original replica count before stopping.
3. Revoke all stored refresh sessions using the runtime DML identity through an
   approved private DB connection. Configure PGSERVICE/PGSERVICEFILE/PGPASSFILE
   privately with verified TLS and mode 0600; no URL/password goes in argv/output.
   Check the service points at the intended environment before this transaction.

```bash
: "${PGSERVICE:?Configure and review the target database service first}"
REPLICA_COUNT=$(kubectl --namespace finance-ai get deployment finance-ai-backend -o jsonpath='{.spec.replicas}')
kubectl --namespace finance-ai scale deployment finance-ai-backend --replicas=0
kubectl --namespace finance-ai wait --for=delete pod \
  --selector=app.kubernetes.io/instance=finance-ai,app.kubernetes.io/component=backend --timeout=5m
# PGSERVICE must select the intended DB using private connection/password files.
psql --no-psqlrc --set=ON_ERROR_STOP=1 --single-transaction --command='DELETE FROM public.refresh_tokens;'
# Update JWT_SECRET/JWT_REFRESH_SECRET in the private runtime Secret, and install
# the rebuilt backend digest using the reviewed Helm release procedure.
# Preserve all other runtime/migrator Secret keys. Never echo or commit values.
kubectl --namespace finance-ai scale deployment finance-ai-backend --replicas="$REPLICA_COUNT"
kubectl --namespace finance-ai rollout status deployment finance-ai-backend --timeout=5m
```

The Helm install/upgrade can restore its configured replica count; keep admission
closed until all pods use the new image/keys and verify old access and refresh JWTs
return 401, new email login/refresh succeeds and no old accepting process remains.
Do not roll back to compromised keys. This deletes sessions, not users, transactions,
goals or knowledge. For individual users before cutover, the existing logout-all
endpoint is available. No production DB connection or global revocation was run here.

## Complete original finding ledger

Current tree below refers to the underlying credential, not whether a harmless
curl command survives in a document. K1–K4 values have all been removed from the local env files; external use of
K1/K2 remains unknown. K3/K4 are retired unused configuration. Full commit
hashes are retained in the fingerprint column. Confidence concerns classification,
not provider/deployment validity.

| Finding / historical path:line / commit / rule                                        | Classification                                                      | Exposure risk                                                                                                   | Current tree?                             | Rotation required?                                         | History rewrite required?                                                | Recommended action / exact fingerprint                                                                                                                                                       |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F01 `backend/docker-compose.yml:50` / `043d243db825` / `generic-api-key`              | Potentially real K1; external use C; retired for new demo           | Signing/session forgery or data confidentiality if key remains accepted                                         | No local file match; external use unknown | Local replacement complete; external retirement unverified | No concrete removal benefit established; rotate any old accepting system | Exact boundary-retirement exception; enforce fresh demo and follow K1 old-environment action. `043d243db8253ea0318ff884f7d57ac7d949b6c7:backend/docker-compose.yml:generic-api-key:50`       |
| F02 `backend/docker-compose.yml:51` / `043d243db825` / `generic-api-key`              | Potentially real K1; external use C; retired for new demo           | Signing/session forgery or data confidentiality if key remains accepted                                         | No local file match; external use unknown | Local replacement complete; external retirement unverified | No concrete removal benefit established; rotate any old accepting system | Exact boundary-retirement exception; enforce fresh demo and follow K1 old-environment action. `043d243db8253ea0318ff884f7d57ac7d949b6c7:backend/docker-compose.yml:generic-api-key:51`       |
| F03 `.github/workflows/ci.yml:70` / `830f2113ce2f` / `generic-api-key`                | Test signing fixture T1 (high confidence)                           | Isolated NODE_ENV=test workflow; no deployment/provider use found                                               | No detected credential                    | No evidence requiring rotation                             | No                                                                       | Reviewed exact exception. `830f2113ce2fa1a3ca8f21f2088be9e046b6a8ea:.github/workflows/ci.yml:generic-api-key:70`                                                                             |
| F04 `.github/workflows/ci.yml:71` / `830f2113ce2f` / `generic-api-key`                | Test signing fixture T2 (high confidence)                           | Isolated NODE_ENV=test workflow; no deployment/provider use found                                               | No detected credential                    | No evidence requiring rotation                             | No                                                                       | Reviewed exact exception. `830f2113ce2fa1a3ca8f21f2088be9e046b6a8ea:.github/workflows/ci.yml:generic-api-key:71`                                                                             |
| F05 `.github/workflows/ci.yml:70` / `932935ae5b9e` / `generic-api-key`                | Test signing fixture T1 (high confidence)                           | Isolated NODE_ENV=test workflow; no deployment/provider use found                                               | No detected credential                    | No evidence requiring rotation                             | No                                                                       | Reviewed exact exception. `932935ae5b9e18d764bb00fc85fb3ac47e107121:.github/workflows/ci.yml:generic-api-key:70`                                                                             |
| F06 `.github/workflows/ci.yml:71` / `932935ae5b9e` / `generic-api-key`                | Test signing fixture T2 (high confidence)                           | Isolated NODE_ENV=test workflow; no deployment/provider use found                                               | No detected credential                    | No evidence requiring rotation                             | No                                                                       | Reviewed exact exception. `932935ae5b9e18d764bb00fc85fb3ac47e107121:.github/workflows/ci.yml:generic-api-key:71`                                                                             |
| F07 `docs/PRODUCTION_SECURITY_CHECKLIST.md:98` / `ee4c22768d97` / `curl-auth-header`  | False positive / example (high confidence)                          | No literal auth credential: matched curl command/continuation; nearby bearer text is YOUR\_\* or no auth header | No detected credential                    | No evidence requiring rotation                             | No                                                                       | Reviewed exact exception; retain example. `ee4c22768d976a9aafd2b0b4c0fde71f32ce9da2:docs/PRODUCTION_SECURITY_CHECKLIST.md:curl-auth-header:98`                                               |
| F08 `docs/PRODUCTION_SECURITY_CHECKLIST.md:98` / `365e47e1f1aa` / `curl-auth-header`  | False positive / example (high confidence)                          | No literal auth credential: matched curl command/continuation; nearby bearer text is YOUR\_\* or no auth header | No detected credential                    | No evidence requiring rotation                             | No                                                                       | Reviewed exact exception; retain example. `365e47e1f1aae6dc841a0aa8ef86aee3f85a9807:docs/PRODUCTION_SECURITY_CHECKLIST.md:curl-auth-header:98`                                               |
| F09 `CSRF_FIX_COMPLETE.md:162` / `63702fef0660` / `curl-auth-header`                  | False positive / example (high confidence)                          | No literal auth credential: matched curl command/continuation; nearby bearer text is YOUR\_\* or no auth header | No detected credential                    | No evidence requiring rotation                             | No                                                                       | Reviewed exact exception; retain example. `63702fef066086e20fedbb1ee2cccc027c5053e7:CSRF_FIX_COMPLETE.md:curl-auth-header:162`                                                               |
| F10 `ENVIRONMENT_SECURITY_COMPLETE.md:36` / `63702fef0660` / `generic-api-key`        | Potentially real K1; external use C; retired for new demo           | Signing/session forgery or data confidentiality if key remains accepted                                         | No local file match; external use unknown | Local replacement complete; external retirement unverified | No concrete removal benefit established; rotate any old accepting system | Exact boundary-retirement exception; enforce fresh demo and follow K1 old-environment action. `63702fef066086e20fedbb1ee2cccc027c5053e7:ENVIRONMENT_SECURITY_COMPLETE.md:generic-api-key:36` |
| F11 `ENVIRONMENT_SECURITY_COMPLETE.md:37` / `63702fef0660` / `generic-api-key`        | Potentially real K2; external use C; retired for new demo           | Signing/session forgery or data confidentiality if key remains accepted                                         | No local file match; external use unknown | Local replacement complete; external retirement unverified | No concrete removal benefit established; rotate any old accepting system | Exact boundary-retirement exception; enforce fresh demo and follow K2 old-environment action. `63702fef066086e20fedbb1ee2cccc027c5053e7:ENVIRONMENT_SECURITY_COMPLETE.md:generic-api-key:37` |
| F12 `ENVIRONMENT_SECURITY_COMPLETE.md:38` / `63702fef0660` / `generic-api-key`        | Historical unused SESSION_SECRET; retired (source/history evidence) | No application consumer or key-dependent stored data                                                            | No: removed from local env                | No replacement needed; permanently retired for this app    | No                                                                       | Reviewed exact retired-unused exception. `63702fef066086e20fedbb1ee2cccc027c5053e7:ENVIRONMENT_SECURITY_COMPLETE.md:generic-api-key:38`                                                      |
| F13 `ENVIRONMENT_SECURITY_COMPLETE.md:39` / `63702fef0660` / `generic-api-key`        | Historical unused ENCRYPTION_KEY; retired (source/history evidence) | No application consumer or key-dependent stored data                                                            | No: removed from local env                | No replacement needed; permanently retired for this app    | No                                                                       | Reviewed exact retired-unused exception. `63702fef066086e20fedbb1ee2cccc027c5053e7:ENVIRONMENT_SECURITY_COMPLETE.md:generic-api-key:39`                                                      |
| F14 `FULL_STACK_TESTING.md:179` / `63702fef0660` / `curl-auth-header`                 | False positive / example (high confidence)                          | No literal auth credential: matched curl command/continuation; nearby bearer text is YOUR\_\* or no auth header | No detected credential                    | No evidence requiring rotation                             | No                                                                       | Reviewed exact exception; retain example. `63702fef066086e20fedbb1ee2cccc027c5053e7:FULL_STACK_TESTING.md:curl-auth-header:179`                                                              |
| F15 `RAG_SYSTEM_COMPLETE.md:63` / `63702fef0660` / `curl-auth-header`                 | False positive / example (high confidence)                          | No literal auth credential: matched curl command/continuation; nearby bearer text is YOUR\_\* or no auth header | No detected credential                    | No evidence requiring rotation                             | No                                                                       | Reviewed exact exception; retain example. `63702fef066086e20fedbb1ee2cccc027c5053e7:RAG_SYSTEM_COMPLETE.md:curl-auth-header:63`                                                              |
| F16 `PRODUCTION_SECURITY_CHECKLIST.md:98` / `63702fef0660` / `curl-auth-header`       | False positive / example (high confidence)                          | No literal auth credential: matched curl command/continuation; nearby bearer text is YOUR\_\* or no auth header | No detected credential                    | No evidence requiring rotation                             | No                                                                       | Reviewed exact exception; retain example. `63702fef066086e20fedbb1ee2cccc027c5053e7:PRODUCTION_SECURITY_CHECKLIST.md:curl-auth-header:98`                                                    |
| F17 `secure-env-setup.sh:27` / `63702fef0660` / `generic-api-key`                     | Potentially real K1; external use C; retired for new demo           | Signing/session forgery or data confidentiality if key remains accepted                                         | No local file match; external use unknown | Local replacement complete; external retirement unverified | No concrete removal benefit established; rotate any old accepting system | Exact boundary-retirement exception; enforce fresh demo and follow K1 old-environment action. `63702fef066086e20fedbb1ee2cccc027c5053e7:secure-env-setup.sh:generic-api-key:27`              |
| F18 `secure-env-setup.sh:29` / `63702fef0660` / `generic-api-key`                     | Potentially real K2; external use C; retired for new demo           | Signing/session forgery or data confidentiality if key remains accepted                                         | No local file match; external use unknown | Local replacement complete; external retirement unverified | No concrete removal benefit established; rotate any old accepting system | Exact boundary-retirement exception; enforce fresh demo and follow K2 old-environment action. `63702fef066086e20fedbb1ee2cccc027c5053e7:secure-env-setup.sh:generic-api-key:29`              |
| F19 `secure-env-setup.sh:67` / `63702fef0660` / `generic-api-key`                     | Historical unused SESSION_SECRET; retired (source/history evidence) | No application consumer or key-dependent stored data                                                            | No: removed from local env                | No replacement needed; permanently retired for this app    | No                                                                       | Reviewed exact retired-unused exception. `63702fef066086e20fedbb1ee2cccc027c5053e7:secure-env-setup.sh:generic-api-key:67`                                                                   |
| F20 `secure-env-setup.sh:70` / `63702fef0660` / `generic-api-key`                     | Historical unused ENCRYPTION_KEY; retired (source/history evidence) | No application consumer or key-dependent stored data                                                            | No: removed from local env                | No replacement needed; permanently retired for this app    | No                                                                       | Reviewed exact retired-unused exception. `63702fef066086e20fedbb1ee2cccc027c5053e7:secure-env-setup.sh:generic-api-key:70`                                                                   |
| F21 `secure-env-setup.sh:76` / `63702fef0660` / `generic-api-key`                     | Potentially real K1; external use C; retired for new demo           | Signing/session forgery or data confidentiality if key remains accepted                                         | No local file match; external use unknown | Local replacement complete; external retirement unverified | No concrete removal benefit established; rotate any old accepting system | Exact boundary-retirement exception; enforce fresh demo and follow K1 old-environment action. `63702fef066086e20fedbb1ee2cccc027c5053e7:secure-env-setup.sh:generic-api-key:76`              |
| F22 `secure-env-setup.sh:77` / `63702fef0660` / `generic-api-key`                     | Potentially real K2; external use C; retired for new demo           | Signing/session forgery or data confidentiality if key remains accepted                                         | No local file match; external use unknown | Local replacement complete; external retirement unverified | No concrete removal benefit established; rotate any old accepting system | Exact boundary-retirement exception; enforce fresh demo and follow K2 old-environment action. `63702fef066086e20fedbb1ee2cccc027c5053e7:secure-env-setup.sh:generic-api-key:77`              |
| F23 `secure-env-setup.sh:78` / `63702fef0660` / `generic-api-key`                     | Historical unused SESSION_SECRET; retired (source/history evidence) | No application consumer or key-dependent stored data                                                            | No: removed from local env                | No replacement needed; permanently retired for this app    | No                                                                       | Reviewed exact retired-unused exception. `63702fef066086e20fedbb1ee2cccc027c5053e7:secure-env-setup.sh:generic-api-key:78`                                                                   |
| F24 `secure-env-setup.sh:79` / `63702fef0660` / `generic-api-key`                     | Historical unused ENCRYPTION_KEY; retired (source/history evidence) | No application consumer or key-dependent stored data                                                            | No: removed from local env                | No replacement needed; permanently retired for this app    | No                                                                       | Reviewed exact retired-unused exception. `63702fef066086e20fedbb1ee2cccc027c5053e7:secure-env-setup.sh:generic-api-key:79`                                                                   |
| F25 `server/RAG_IMPLEMENTATION_COMPLETE.md:182` / `63702fef0660` / `curl-auth-header` | False positive / example (high confidence)                          | No literal auth credential: matched curl command/continuation; nearby bearer text is YOUR\_\* or no auth header | No detected credential                    | No evidence requiring rotation                             | No                                                                       | Reviewed exact exception; retain example. `63702fef066086e20fedbb1ee2cccc027c5053e7:server/RAG_IMPLEMENTATION_COMPLETE.md:curl-auth-header:182`                                              |
| F26 `server/RAG_IMPLEMENTATION_COMPLETE.md:202` / `63702fef0660` / `curl-auth-header` | False positive / example (high confidence)                          | No literal auth credential: matched curl command/continuation; nearby bearer text is YOUR\_\* or no auth header | No detected credential                    | No evidence requiring rotation                             | No                                                                       | Reviewed exact exception; retain example. `63702fef066086e20fedbb1ee2cccc027c5053e7:server/RAG_IMPLEMENTATION_COMPLETE.md:curl-auth-header:202`                                              |
| F27 `server/README.md:285` / `63702fef0660` / `curl-auth-header`                      | False positive / example (high confidence)                          | No literal auth credential: matched curl command/continuation; nearby bearer text is YOUR\_\* or no auth header | No detected credential                    | No evidence requiring rotation                             | No                                                                       | Reviewed exact exception; retain example. `63702fef066086e20fedbb1ee2cccc027c5053e7:server/README.md:curl-auth-header:285`                                                                   |
| F28 `server/README.md:299` / `63702fef0660` / `curl-auth-header`                      | False positive / example (high confidence)                          | No literal auth credential: matched curl command/continuation; nearby bearer text is YOUR\_\* or no auth header | No detected credential                    | No evidence requiring rotation                             | No                                                                       | Reviewed exact exception; retain example. `63702fef066086e20fedbb1ee2cccc027c5053e7:server/README.md:curl-auth-header:299`                                                                   |
| F29 `CSRF_FIX_COMPLETE.md:162` / `c93de39ce5b4` / `curl-auth-header`                  | False positive / example (high confidence)                          | No literal auth credential: matched curl command/continuation; nearby bearer text is YOUR\_\* or no auth header | No detected credential                    | No evidence requiring rotation                             | No                                                                       | Reviewed exact exception; retain example. `c93de39ce5b40666f7146617bb4f78eaece189b3:CSRF_FIX_COMPLETE.md:curl-auth-header:162`                                                               |
| F30 `FULL_STACK_TESTING.md:179` / `c93de39ce5b4` / `curl-auth-header`                 | False positive / example (high confidence)                          | No literal auth credential: matched curl command/continuation; nearby bearer text is YOUR\_\* or no auth header | No detected credential                    | No evidence requiring rotation                             | No                                                                       | Reviewed exact exception; retain example. `c93de39ce5b40666f7146617bb4f78eaece189b3:FULL_STACK_TESTING.md:curl-auth-header:179`                                                              |
| F31 `ENVIRONMENT_SECURITY_COMPLETE.md:38` / `c93de39ce5b4` / `generic-api-key`        | Historical unused SESSION_SECRET; retired (source/history evidence) | No application consumer or key-dependent stored data                                                            | No: removed from local env                | No replacement needed; permanently retired for this app    | No                                                                       | Reviewed exact retired-unused exception. `c93de39ce5b40666f7146617bb4f78eaece189b3:ENVIRONMENT_SECURITY_COMPLETE.md:generic-api-key:38`                                                      |
| F32 `ENVIRONMENT_SECURITY_COMPLETE.md:39` / `c93de39ce5b4` / `generic-api-key`        | Historical unused ENCRYPTION_KEY; retired (source/history evidence) | No application consumer or key-dependent stored data                                                            | No: removed from local env                | No replacement needed; permanently retired for this app    | No                                                                       | Reviewed exact retired-unused exception. `c93de39ce5b40666f7146617bb4f78eaece189b3:ENVIRONMENT_SECURITY_COMPLETE.md:generic-api-key:39`                                                      |
| F33 `RAG_SYSTEM_COMPLETE.md:63` / `c93de39ce5b4` / `curl-auth-header`                 | False positive / example (high confidence)                          | No literal auth credential: matched curl command/continuation; nearby bearer text is YOUR\_\* or no auth header | No detected credential                    | No evidence requiring rotation                             | No                                                                       | Reviewed exact exception; retain example. `c93de39ce5b40666f7146617bb4f78eaece189b3:RAG_SYSTEM_COMPLETE.md:curl-auth-header:63`                                                              |
| F34 `PRODUCTION_SECURITY_CHECKLIST.md:98` / `c93de39ce5b4` / `curl-auth-header`       | False positive / example (high confidence)                          | No literal auth credential: matched curl command/continuation; nearby bearer text is YOUR\_\* or no auth header | No detected credential                    | No evidence requiring rotation                             | No                                                                       | Reviewed exact exception; retain example. `c93de39ce5b40666f7146617bb4f78eaece189b3:PRODUCTION_SECURITY_CHECKLIST.md:curl-auth-header:98`                                                    |
| F35 `secure-env-setup.sh:67` / `c93de39ce5b4` / `generic-api-key`                     | Historical unused SESSION_SECRET; retired (source/history evidence) | No application consumer or key-dependent stored data                                                            | No: removed from local env                | No replacement needed; permanently retired for this app    | No                                                                       | Reviewed exact retired-unused exception. `c93de39ce5b40666f7146617bb4f78eaece189b3:secure-env-setup.sh:generic-api-key:67`                                                                   |
| F36 `secure-env-setup.sh:70` / `c93de39ce5b4` / `generic-api-key`                     | Historical unused ENCRYPTION_KEY; retired (source/history evidence) | No application consumer or key-dependent stored data                                                            | No: removed from local env                | No replacement needed; permanently retired for this app    | No                                                                       | Reviewed exact retired-unused exception. `c93de39ce5b40666f7146617bb4f78eaece189b3:secure-env-setup.sh:generic-api-key:70`                                                                   |
| F37 `secure-env-setup.sh:78` / `c93de39ce5b4` / `generic-api-key`                     | Historical unused SESSION_SECRET; retired (source/history evidence) | No application consumer or key-dependent stored data                                                            | No: removed from local env                | No replacement needed; permanently retired for this app    | No                                                                       | Reviewed exact retired-unused exception. `c93de39ce5b40666f7146617bb4f78eaece189b3:secure-env-setup.sh:generic-api-key:78`                                                                   |
| F38 `secure-env-setup.sh:79` / `c93de39ce5b4` / `generic-api-key`                     | Historical unused ENCRYPTION_KEY; retired (source/history evidence) | No application consumer or key-dependent stored data                                                            | No: removed from local env                | No replacement needed; permanently retired for this app    | No                                                                       | Reviewed exact retired-unused exception. `c93de39ce5b40666f7146617bb4f78eaece189b3:secure-env-setup.sh:generic-api-key:79`                                                                   |
| F39 `server/RAG_IMPLEMENTATION_COMPLETE.md:182` / `c93de39ce5b4` / `curl-auth-header` | False positive / example (high confidence)                          | No literal auth credential: matched curl command/continuation; nearby bearer text is YOUR\_\* or no auth header | No detected credential                    | No evidence requiring rotation                             | No                                                                       | Reviewed exact exception; retain example. `c93de39ce5b40666f7146617bb4f78eaece189b3:server/RAG_IMPLEMENTATION_COMPLETE.md:curl-auth-header:182`                                              |
| F40 `server/RAG_IMPLEMENTATION_COMPLETE.md:202` / `c93de39ce5b4` / `curl-auth-header` | False positive / example (high confidence)                          | No literal auth credential: matched curl command/continuation; nearby bearer text is YOUR\_\* or no auth header | No detected credential                    | No evidence requiring rotation                             | No                                                                       | Reviewed exact exception; retain example. `c93de39ce5b40666f7146617bb4f78eaece189b3:server/RAG_IMPLEMENTATION_COMPLETE.md:curl-auth-header:202`                                              |
| F41 `server/README.md:285` / `c93de39ce5b4` / `curl-auth-header`                      | False positive / example (high confidence)                          | No literal auth credential: matched curl command/continuation; nearby bearer text is YOUR\_\* or no auth header | No detected credential                    | No evidence requiring rotation                             | No                                                                       | Reviewed exact exception; retain example. `c93de39ce5b40666f7146617bb4f78eaece189b3:server/README.md:curl-auth-header:285`                                                                   |
| F42 `server/README.md:299` / `c93de39ce5b4` / `curl-auth-header`                      | False positive / example (high confidence)                          | No literal auth credential: matched curl command/continuation; nearby bearer text is YOUR\_\* or no auth header | No detected credential                    | No evidence requiring rotation                             | No                                                                       | Reviewed exact exception; retain example. `c93de39ce5b40666f7146617bb4f78eaece189b3:server/README.md:curl-auth-header:299`                                                                   |

## Current history-rewrite recommendation

**No rewrite is recommended.** Retired unused keys and safe examples need none.
For K1/K2, fresh signing keys and the isolated demo boundary make history removal
unnecessary for the new environment. A rewrite would not invalidate a signing key
still accepted by old EC2 or a copied/shared system. Investigate and rotate/revoke
or decommission any such system; do not claim global retirement from this review.
No concrete additional security benefit from rewriting these JWT values was established.

A targeted rewrite is only a later option if active/non-rotatable sensitive material
or a specific exposure requirement makes removal necessary. No such need was proven
here. The previous four-key rewrite proposal is withdrawn as unnecessary for the two
proven-unused keys. Any future targeted removal needs new evidence, a new specific
plan and explicit approval. No rewrite or push was performed.

Retirement-first handling follows [GitHub sensitive-data guidance](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository).
Exact historical exceptions follow [Gitleaks documentation](https://github.com/gitleaks/gitleaks/blob/master/README.md#gitleaksignore).

## Verification after retirement changes

| Check                                               | Result                                                                                                              |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Gitleaks v8.30.1 all available refs                 | PASS: zero findings; 182 scanned commits across all available refs                                                  |
| Exact exceptions                                    | 42 total: 22 safe fixture/example + 12 retired unused-key + 8 scoped JWT retirement                                 |
| Ignored-inclusive first-party Gitleaks working scan | PASS: zero findings (468 files at scan time); private copy removed                                                  |
| Historical-value equality / env tracking checks     | No historical value in current files; root/backend env ignored/untracked, mode 0600; only example env files tracked |
| Backend typecheck/build                             | PASS                                                                                                                |
| Backend test:ci                                     | PASS: 203 passed, 13 integration-gated skips; includes production retirement guard                                  |
| Backend test:integration                            | PASS: 14 tests against guarded disposable PostgreSQL                                                                |
| Frontend runtime audit                              | PASS high threshold; 2 moderate remain                                                                              |
| Backend runtime audit                               | PASS high threshold; 4 moderate remain                                                                              |
| Existing Trivy filesystem/secrets gate              | PASS; zero gated findings                                                                                           |
| git diff --check                                    | PASS                                                                                                                |

The production guard was also checked against both actual historical values in
both JWT roles using private in-memory child environments: **four startup rejections**.
No value was printed or persisted. Initial guard tests lacked required Redis
configuration; the fixture was corrected and all 203 tests passed. Prior integration,
runtime-audit and Trivy results above remain the preceding retirement-pass evidence;
this focused follow-up reruns Gitleaks, typecheck/build, backend tests and diff hygiene.
No security threshold was weakened, production sessions modified or AWS deployed.

**Gate scope:** once the recorded scans pass, the repository's historical-secret
blocker is cleared for an isolated fresh demo. AWS launch still requires the
mandatory fresh boundary and the other LAUNCH_REPORT operator checks. Old EC2
retirement remains unverified, not falsely declared safe.

## Exact files changed in this retirement pass

Committable: `.gitleaksignore`, `README.md`, `backend/.env.example`,
`backend/src/config/env.ts`, `backend/src/services/authService.ts`,
`backend/tests/services/authService.test.ts`, `backend/tests/demoAuth.test.ts`,
`backend/tests/configRetirement.test.ts` (new), `docs/SECRET_SCAN_REVIEW.md`,
and `docs/LAUNCH_REPORT.md`.
Private ignored local changes: root `.env` and `backend/.env` (key removal only,
plus mode 0600). They are not staged or included in any commit.

## Exact files changed in this deployment-boundary follow-up

`.gitleaksignore`, `backend/src/config/env.ts`,
`backend/tests/configRetirement.test.ts`, `docs/SECRET_SCAN_REVIEW.md`,
`docs/PUBLIC_DEMO.md`, `docs/LAUNCH_REPORT.md`. Existing retirement/public-demo
changes were preserved. No private env file was changed in this follow-up.
