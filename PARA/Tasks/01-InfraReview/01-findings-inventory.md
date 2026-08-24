# Raw findings inventory (unranked)

Produced during project setup, 2026-08-24. Verified against the code, but **deliberately
unranked** — ranking against the Delta context is the actual work of this task.

## lib/data-stack.ts

- `DB_PASSWORD` hardcoded at line 9, exported as a TS const, committed to git.
- RDS in PUBLIC subnets, `publiclyAccessible: true` (lines 45–46).
- Security group allows 3306 from `0.0.0.0/0` (lines 30–34) — "team access from home".
- `multiAz: false`, `backupRetention: Duration.days(0)`, `storageEncrypted: false`,
  `deletionProtection: false`, `removalPolicy: DESTROY` (lines 52–57).
- Redis: single `cache.t4g.micro` node, no replication/failover (CfnCacheCluster).
- Single NAT gateway, 2 AZs (lines 20–23) — possibly *reasonable* for cost.

## lib/service-stack.ts

- Task role: `actions: ['*'], resources: ['*']` (lines 41–46).
- Plaintext `DB_PASSWORD` injected as container env var (line 56) — visible in console/API.
- Image tag `latest` from ECR (line 49) — no immutable deploys, no rollback target.
- `desiredCount: 1`, `minHealthyPercent: 0`, `maxHealthyPercent: 100` (lines 61–67):
  every deploy stops the only task before starting the new one → full outage per deploy,
  multiple times per day. Directly contradicts "zero appetite for downtime".
- ALB listener HTTP :80 only, no TLS/redirect (line 74).
- Log retention INFINITE (line 31) — cost leak, minor.
- ECR repo has hardcoded `repositoryName` (rename hazards) and no lifecycle policy.

## .github/workflows/deploy.yml

- Long-lived IAM access keys in secrets instead of OIDC (lines 17–22).
- No test/synth/typecheck gate before deploy; `npm install` not `npm ci` (line 32).
- Deploy on every push to main, no concurrency guard — two pushes race `cdk deploy`.
- "Force new deployment" grabs `clusterArns[0]` / `serviceArns[0]` — deploys into
  *whatever cluster/service lists first in the account*, not a named one (lines 35–39).
- Pushes `:latest` then force-redeploys — deploy is not tied to the image just built.

## app/Dockerfile

- Runs as root, no lockfile-based install (`COPY package.json index.js` only), no
  HEALTHCHECK, no pinned digest. Minor next to the above.

## Possibly-reasonable list (candidates, to argue in REVIEW.md)

- Single NAT gateway — cost-conscious, acceptable blast radius for this service. Defensible.
- `t4g.medium` MySQL, single Redis node for *derived* data — right-sized for a startup. Defensible.
- No dedicated ops tooling (service mesh, canary infra) — a handful of engineers. Defensible.
- Plain Node app, no framework — fine; app is out of scope per brief.
- Fargate over EC2 — right call for a team with no ops staff.
