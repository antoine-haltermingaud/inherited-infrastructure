# Infrastructure review — pricefeed

**Reviewer:** Antoine Halter-Mingaud (infrastructure contractor) · 2026-08-24
**Scope:** `lib/data-stack.ts`, `lib/service-stack.ts`, `bin/pricefeed.ts`, `.github/workflows/deploy.yml`, `app/Dockerfile` (app code only where it touches infra)

## TL;DR

Pricefeed works and is in production, but three properties of this setup directly
contradict the constraints you gave me (millions of users, several deploys a day, zero
appetite for downtime, no ops team):

1. The production database is reachable from the entire internet, and its admin password
   is committed to this git repository.
2. **Every deploy takes the service down** — by design of the ECS settings, several times
   a day.
3. The database has **no backups**, no deletion protection, and is configured to be
   destroyed on stack deletion. Combined with (1), anyone with this repo's history can
   permanently destroy production data.

All three are fixable with small, low-risk changes; the top three fixes are a ~20-line
diff. Below: every finding ranked for *your* context, the things that look odd but are
actually fine, and a Monday-to-Friday plan.

## How I ranked

Each finding is weighed by **severity × blast radius × likelihood in this specific
environment** — not by how loudly a generic checklist would flag it. Two consequences of
that: a guaranteed daily outage outranks several "classic" security items, and some
textbook findings (single NAT gateway, single Redis node) end up in the
"reasonable here" list instead of the fix list. Related issues are grouped into one
finding when they share a cause or a fix.

## Findings — ranked

### Critical — fix this week

**1. Production DB exposed to the internet, with credentials in git**
(`lib/data-stack.ts:9` hardcoded password · `:30-34` security group open to `0.0.0.0/0`
on 3306 · `:45-46` public subnet + `publiclyAccessible: true` · `lib/service-stack.ts:56`
same password as plaintext container env var, readable by anyone with ECS console/API
access)
*Category: security. Severity: critical · Blast radius: all production data + price
integrity · Likelihood: high.*

The database is publicly addressable, port 3306 is open to the whole internet, and the
only thing between an attacker and admin access is a password stored in this repo — a
repo the engineer who left still knows by heart. Internet scanners find open MySQL ports
within hours; this has likely been probed for the past year. For a service whose product
is *prices served to millions of users*, the worst case is not just a data leak — it is
someone silently **writing** prices. Treat the credential as already compromised: rotate
it, move it to Secrets Manager, and close the network path.

**2. Every deploy is a full outage — several times a day**
(`lib/service-stack.ts:64-66`: `desiredCount: 1`, `minHealthyPercent: 0`,
`maxHealthyPercent: 100`)
*Category: availability. Severity: high · Blast radius: every user, every deploy ·
Likelihood: certain — it is happening today, daily.*

With one task, a floor of 0% and a ceiling of 100%, ECS must **stop the only running
task before it may start the new one**. Every deploy is a multi-minute, user-visible
outage, multiplied by your deploy cadence. This is the single clearest contradiction of
"zero appetite for downtime", and it also means any task crash or AZ hiccup is a full
outage. The fix is two lines (`desiredCount: 2`, `minHealthyPercent: 100`,
`maxHealthyPercent: 200`) plus a deployment circuit breaker, and costs roughly one extra
Fargate task (~$20/month).

Why is this ranked *below* the exposed DB when it is the one certain to be happening?
Because outages are recoverable and already survived daily; a poisoned pricefeed or a
destroyed dataset is not. Both get fixed in week one regardless — see the plan.

**3. No backups, no deletion protection, delete-on-destroy**
(`lib/data-stack.ts:55-57`: `backupRetention: Duration.days(0)`,
`deletionProtection: false`, `removalPolicy: DESTROY`)
*Category: availability/security. Severity: critical (irreversible) · Blast radius: all
persistent data · Likelihood: low per incident, but compounding.*

Automated backups are explicitly disabled, and nothing stops a `cdk destroy`, a failed
stack rollback, or a fat-fingered console action from deleting the instance — at which
point the data is gone forever. Note the interlock with finding 1: today, an attacker
with the git-leaked password can also destroy the only copy of production data. Three
config lines and one scheduled window fix this permanently.

> **Migration risk:** on a single-AZ RDS instance, changing backup retention from 0 to a
> non-zero value causes a brief outage while backups initialize. Apply it in a low-traffic
> window — do not let CI roll it out mid-day. `deletionProtection` and `removalPolicy`
> changes are safe any time.

**4. The task role is an account-wide admin**
(`lib/service-stack.ts:41-46`: `actions: ['*'], resources: ['*']`)
*Category: security. Severity: critical if triggered · Blast radius: the entire AWS
account · Likelihood: moderate — requires an app compromise first.*

The container that terminates untrusted internet traffic holds permissions to do
*anything* in the account: read every secret, delete every database, run up any bill.
One SSRF or dependency compromise in the app turns into total account takeover. The app
"occasionally needs S3 exports and Parameter Store" per the code comment — scope the role
to exactly that.

> **Migration risk:** if the app quietly uses permissions nobody documented, scoping the
> role breaks that feature. Mitigation: check CloudTrail / IAM Access Advisor for what the
> role has actually used before cutting, deploy the scoped role, watch logs for
> `AccessDenied` for a day.

### High — fix this month, starting with the pipeline

**5. Deploys are untraceable, unguarded, and aimed by luck**
(`.github/workflows/deploy.yml` — `:latest` tag only (`:27-28`) · no test/typecheck/synth
gate and `npm install` instead of `npm ci` (`:32`) · no concurrency guard · force-redeploy
targets `clusterArns[0]`, i.e. *whichever cluster lists first in the account* (`:35-39`) ·
long-lived IAM access keys in GitHub secrets (`:20-21`))
*Category: delivery. Severity: high · Blast radius: every deploy, and potentially
neighboring services · Likelihood: grows with every push and every new thing in the
account.*

Five compounding problems: you cannot roll back (there is no previous image tag to roll
back *to*); nothing verifies the code even compiles before it deploys to production; two
pushes race each other in `cdk deploy`; the "force new deployment" step guesses the
cluster and service by list order — the day a second cluster appears in this account
(you already run Kubernetes and ECS elsewhere), this workflow restarts the *wrong*
service; and stolen long-lived AWS keys work forever, versus OIDC's short-lived
per-run credentials. The fix is mechanical: tag images with the git SHA and point the
task definition at that SHA (which also makes the ARN-guessing step unnecessary — it only
exists because `:latest` never changes the task definition), add a `concurrency:` group,
gate on `npm ci && tsc && cdk synth` + the existing `app/test.js`, and switch to OIDC.
Ranked below the critical four only because it needs a bad event to bite, while 1–3 are
bad *standing states*.

**6. Price data crosses the internet in plaintext**
(`lib/service-stack.ts:74`: ALB listener on HTTP :80 only, no TLS, no redirect)
*Category: security. Severity: moderate · Blast radius: data in transit · Likelihood:
low for targeted interception, but table stakes for financial data.*

An internet-facing ALB serving price data to your apps over unencrypted HTTP means
anything on-path can read or alter prices in transit. An ACM certificate is free; the
work is the domain/DNS decision, which is why this is "this month" and not "Monday".

**7. Single-AZ database**
(`lib/data-stack.ts:52`: `multiAz: false`)
*Category: availability. Severity: high when it triggers · Likelihood: low (AZ or
instance failure) · Cost of fix: roughly doubles the DB bill.*

An instance or AZ failure today means an extended outage — and, until finding 3 is
fixed, possibly permanent data loss. I deliberately do **not** put Multi-AZ in week one:
it doubles database cost for a low-likelihood event, while backups (finding 3) buy most
of the disaster-recovery value for near-zero cost. Decide it deliberately once backups
exist — likely "yes" at your user count, but as a priced decision, not a reflex.

> **Migration risk:** enabling Multi-AZ is an online operation with a brief performance
> impact while the standby syncs. Schedule off-peak.

### Housekeeping — batch into a cleanup PR when convenient

*Real but small; none of these justify their own deploy.*

- **Log retention `INFINITE`** (`lib/service-stack.ts:31`) — unbounded cost growth for
  logs nobody will read past a few weeks. Set 30–90 days.
- **No ECR lifecycle policy** (`lib/service-stack.ts:24-26`) — with several pushes a day,
  untagged images accumulate forever. Keep the last N.
- **Hardcoded physical names** (`repositoryName: 'pricefeed'`, `logGroupName:
  '/pricefeed/app'`) — blocks CloudFormation from ever replacing these resources and
  invites collision. Let CDK name them (rename is a migration, so do it opportunistically).
- **Dockerfile never installs dependencies** (`app/Dockerfile:3` copies only
  `package.json` and `index.js`; there is no `npm ci`). It works *today* because the app
  has zero runtime dependencies — the day someone adds `mysql2` to `package.json`, the
  image builds green and crashes at boot. Also: runs as root and no lockfile. Fix
  alongside the pipeline work (finding 5).
- **Deploy region duplicated** (`eu-west-1` in both `bin/pricefeed.ts:10` and
  `deploy.yml:22`) — harmless until someone changes one of them.

## Reasonable for this context — leave these alone

Things a checklist would flag that I am explicitly *not* asking you to change:

- **Single NAT gateway, 2 AZs** (`data-stack.ts:20-23`) — saves ~$35/month per gateway.
  Worst case is briefly degraded outbound traffic from one AZ, which this service can
  tolerate. Right call for a cost-conscious startup.
- **Fargate rather than EC2 or Kubernetes for this service** — no instances to patch, no
  cluster to run, which is exactly right for a handful of engineers with no ops team.
- **`t4g.medium` MySQL, 100 GB** — right-sized and on cheaper Graviton. Scale when
  metrics say so, not before.
- **Single `cache.t4g.micro` Redis node** (`data-stack.ts:76-82`) — it holds *derived*
  data; losing it means a cache-rebuild blip, not data loss. Replication would be cost
  without matching risk. (Revisit only if a cold cache measurably hurts p99.)
- **`--require-approval never` in CI** — looks alarming, but unattended deploys *require*
  it; the correct guard is the test/synth gate before deploy (finding 5), not a human
  clicking a button several times a day.
- **No canaries, service mesh, or progressive-delivery tooling** — ECS rolling deploys
  with a health check and circuit breaker are the right amount of machinery for this team
  size.
- Credit where due: the app already exposes `/health` and the ALB uses it; the whole
  stack is in CDK rather than console-clicks; logs are centralized. The foundation is
  saner than the findings above make it sound.

## Week-one plan

Ordering principle: **make deploys safe first** (Monday's fix means every later change
rolls out with zero downtime), close the irreversible risks next, then harden the
pipeline. Rank order is not fix order — cheap-and-instant beats severe-but-slow when you
can only do one thing at a time.

**Monday — stop the daily bleeding.**
`desiredCount: 2`, `minHealthyPercent: 100`, `maxHealthyPercent: 200`, add the ECS
deployment circuit breaker with rollback (finding 2). One deploy, one final planned
blip, and every subsequent deploy this week is zero-downtime. Same day, the zero-risk
lines of finding 3: `deletionProtection: true`, `removalPolicy` to snapshot-on-delete.
That evening (low-traffic window, because of the brief single-AZ backup-init outage):
`backupRetention: 7 days`.

**Tuesday — take the password out of git.**
Create the secret in Secrets Manager, switch the container from `environment` to ECS
`secrets` injection, deploy (no behavior change — same password, now sourced properly).
Then rotate: new password on the RDS instance and in the secret, roll the service —
which is now a safe rolling restart thanks to Monday. From this point the value in git
history is dead. (Rotation, not history-rewriting, is what makes the leak harmless.)

**Wednesday — close the network path, shrink the blast radius.**
Replace the `0.0.0.0/0` ingress with the service security group, and give the team a
proper access path for their MySQL Workbench habit (SSM port forwarding or an EC2
Instance Connect Endpoint — no bastion instance to run). This is instant and
zero-downtime, and it removes ~99% of the exposure. Also Wednesday: scope the task role
(finding 4) after a CloudTrail check of what it actually uses.

**Thursday — make deploys trustworthy.**
Finding 5: git-SHA image tags wired into the task definition, delete the
cluster-guessing force-redeploy step, `concurrency:` group, `npm ci` + `tsc` +
`cdk synth` + `app/test.js` as a gate before deploy.

**Friday — kill the long-lived keys, then buffer.**
GitHub OIDC role, delete the static AWS keys from repo secrets. Rest of the day is
deliberate slack: watch the week's changes in production, write up what moved, and
absorb whatever slipped — a first week on inherited infra that finishes exactly on plan
would be a first.

**Deliberately waiting, and why:**

- **Moving RDS into private subnets + `publiclyAccessible: false`** — the *right* end
  state, but re-homing a live database is the one genuinely risky migration here
  (subnet-group change on a single-AZ instance = downtime window). Wednesday's security
  group change removes the actual exposure; the subnet move gets its own scheduled
  maintenance window in week 2–3, not a week-one rush.
- **Storage encryption** (`storageEncrypted: false`) — cannot be enabled in place at
  all: it requires snapshot → encrypted copy → restore → cutover, i.e. a planned
  migration with downtime and a new endpoint. Schedule it, ideally combined with the
  subnet move so production takes one window instead of two.
- **Multi-AZ** — priced decision after backups exist (finding 7).
- **TLS** — needs the domain/DNS decision with the team (finding 6); next.
- **Autoscaling** — static `desiredCount: 2` first; add a scaling policy once we have
  real utilization metrics to base it on.
- **Housekeeping list** — one batched PR whenever convenient.

## Top 3 findings to fix now

For the accompanying fix commit — smallest diff, largest risk retired:

1. **Deploy availability** (finding 2): `desiredCount: 2`, `minHealthyPercent: 100`,
   `maxHealthyPercent: 200`, deployment circuit breaker with rollback.
   *Rollout: safe live; the deploy that applies it is itself the last disruptive one.*
2. **Credentials + DB exposure** (finding 1): password out of source and into Secrets
   Manager, container env → ECS `secrets`, DB security group ingress restricted to the
   service security group instead of `0.0.0.0/0`.
   *Rollout: two-step as in the Tuesday/Wednesday plan — wire the secret first, rotate
   second; never rotate and rewire in the same deploy. Team DB access moves to SSM port
   forwarding.*
3. **Data survivability** (finding 3): `backupRetention: 7`, `deletionProtection: true`,
   `removalPolicy: SNAPSHOT`.
   *Rollout: retention change in a low-traffic window (brief single-AZ backup-init
   outage); the rest any time.*

Finding 4 (admin task role) is next in line and deliberately *not* in this commit: the
scoped policy should be written against CloudTrail evidence of real usage, not guessed in
a take-home — shipping a guessed policy is how you break production S3 exports on day
three.

*With more time I would:* validate the week-one plan against real CloudWatch/CloudTrail
data (deploy frequency, task role usage, actual traffic curves), price the Multi-AZ and
TLS decisions concretely, and pair with the team on the deploy-pipeline rework rather
than prescribing it.
