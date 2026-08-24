# Adversarial review — fix commit `6f1771d`

**Method.** `git worktree add … a782e19` (the commit's parent), `cdk synth` both sides with no
AWS credentials, then a resource-level diff of `cdk.out/*.template.json`. Every verdict below
cites the synthesized template, not the TypeScript. Judged **only** against the commit
message's own claims and `REVIEW.md` § "Top 3 findings to fix now".

**Result: 1 FAIL, 6 PASS.** One real defect, fixed in a follow-up commit. The defect is not in
what the commit set out to do — the three findings really are retired — but in a side effect of
*how* CDK renders the circuit breaker, which silently converts the next production deploy from a
rolling update into a **service replacement**.

## Complete resource delta (`a782e19` → `6f1771d`)

| Stack | Resource | Change |
|---|---|---|
| Data | `PricefeedDataDatabaseSecret…` | **added** (Secrets Manager secret) |
| Data | `DatabaseSecretAttachmentE5D1B020` | **added** (target attachment) |
| Data | `DatabaseB269D8BB` (RDS) | `BackupRetentionPeriod` 0→7, `DeletionProtection` false→true, `MasterUserPassword` plaintext→`{{resolve:secretsmanager:…}}`, `DeletionPolicy`+`UpdateReplacePolicy` Delete→Snapshot |
| Data | `DbSecurityGroupE9D701AD` | `SecurityGroupIngress` `0.0.0.0/0`→VPC `CidrBlock` |
| Service | `ServiceD69D759B` (ECS) | `DesiredCount` 1→2, `MinimumHealthyPercent` 0→100, `MaximumPercent` 100→200, `DeploymentCircuitBreaker` added, **`DeploymentController` absent→`{Type:ECS}`** |
| Service | `TaskDef54694570` | `DB_PASSWORD` moved `Environment`→`Secrets` |
| Service | `TaskDefExecutionRoleDefaultPolicy…` | `secretsmanager:GetSecretValue`+`DescribeSecret` added |

No resource was removed; no logical ID changed.

---

## V1 — Unintended replacement · **FAIL**

**RDS: PASS.** Every replacement-triggering property on `AWS::RDS::DBInstance` is byte-identical
across the diff — `MasterUsername` `"admin"`, `DBSubnetGroupName`
`{"Ref":"DatabaseSubnetGroup7D60F180"}`, `PubliclyAccessible` `true`, `StorageEncrypted` `false`,
`Engine` `"mysql"`, and `DBInstanceIdentifier` absent on both sides. The only changed properties
(`BackupRetentionPeriod`, `DeletionProtection`, `MasterUserPassword`) are all in-place updates.
Logical ID `DatabaseB269D8BB` is stable, so there is no delete/recreate. **The database is not
replaced and there is no data loss.** Note the ordering luck here: had the commit also flipped
`publiclyAccessible` to `false` (as an earlier draft did, per `02-TopFindingsFix/00.rejected-ideas.md`),
that *is* a replacement-triggering property and this verdict would have been catastrophic instead.

**Security group: PASS.** `DbSecurityGroupE9D701AD` keeps its logical ID; only the inline
`SecurityGroupIngress` list changed. Security-group rule changes are in-place.

**ECS service: FAIL.** The service gains a property it did not previously have:

```
PRE  (a782e19): DeploymentController  absent
POST (6f1771d): DeploymentController  {"Type": "ECS"}
```

`DeploymentController` on `AWS::ECS::Service` is documented **"Update requires: Replacement"**.
Absent→present is a change, so the next `cdk deploy` does not roll the service — it creates a
replacement service and deletes the existing one.

Nobody wrote that property. It is emitted by CDK as a side effect of `circuitBreaker`
(`node_modules/aws-cdk-lib/aws-ecs/lib/base/base-service.js`):

```js
getDeploymentController(props) {
  if (props.deploymentController) return props.deploymentController;
  if (!FeatureFlags.of(this).isEnabled(ECS_DISABLE_EXPLICIT_DEPLOYMENT_CONTROLLER_FOR_CIRCUIT_BREAKER)
      && props.circuitBreaker) return { type: DeploymentControllerType.ECS };
}
```

The decisive evidence is that the CDK ships a feature flag whose entire purpose is to prevent
this, and **recommends turning it on** — while this repo has it off:

```
$ npx cdk flags "@aws-cdk/aws-ecs:disableExplicitDeploymentControllerForCircuitBreaker"
Description:       Avoid setting the "ECS" deployment controller when adding a circuit breaker
Recommended value: true
Default value:     false
User value:        undefined
Effective value:   false
```

`cdk.json` carried no `context` block at all, so the flag sat at its legacy default.

**Why this matters more than it looks.** The commit's stated rollout is *"ServiceStack: tasks roll
onto the secret-injected task definition behind the ALB health check; the window closes when they
turn healthy (minutes)."* That describes a rolling deployment. `MinimumHealthyPercent: 100` /
`MaximumPercent: 200` — the entire mechanism of REVIEW.md finding 2 — govern rolling deployments
*within* a service. They have no authority over a CloudFormation-level replacement. So the commit
whose headline fix is "deploys no longer cause an outage" would itself have made the next
production deploy a replacement of the live service, on a system with zero downtime appetite.

Two aggravating factors, both from the still-unfixed `deploy.yml` (finding 5, deferred):
1. That workflow deploys on **every push to main** with no gate, so the replacement would have
   fired unattended on merge, not in a chosen window.
2. Its final step targets `serviceArns[0]`. During a replacement the cluster transiently holds
   **two** services, so the index-based lookup can force-redeploy the wrong one.

**Fixed** in the follow-up commit by setting the flag AWS already recommends. Verified: the only
template change across both stacks is `DeploymentController` `{Type:ECS}` → absent, restoring the
pre-fix value so the service updates in place. `DeploymentCircuitBreaker {Enable:true,
Rollback:true}`, `MinimumHealthyPercent: 100`, `MaximumPercent: 200` and `DesiredCount: 2` all
survive untouched — REVIEW.md's finding-2 fix is fully preserved.

## V2 — Rotation claim · **PASS**

Claim: *"deploying this rotates the master password in place, killing the leaked value."*

```
MasterUserPassword: "Pr1cefeed-Pr0d-2024!"
  -> {"Fn::Join":["",["{{resolve:secretsmanager:",{"Ref":"PricefeedDataDatabaseSecret…"},":SecretString:password::}}"]]}
```

True on all three counts. The template resolves the password from the newly created secret; RDS
treats `MasterUserPassword` as an in-place modify (no reboot, no replacement — corroborated by V1);
and the generated secret's value is random, so the committed string stops being the live
credential. `grep -c "Pr1cefeed" cdk.out/*.template.json` returns 0 for both stacks — the plaintext
is gone from the synthesized output, where before it appeared in *both* the RDS resource and the
task definition.

Precision note, not a defect: "killing the leaked value" is true of the *running system*, not of
the repository. `Pr1cefeed-Pr0d-2024!` remains in git history at `a782e19` forever. That is
consistent with REVIEW.md, which argues rotation rather than history-rewriting is what defuses the
leak, so the commit and the review agree.

## V3 — Secrets injection · **PASS**

The suspected failure — task definition references a secret the **execution** role cannot read, so
every task fails to start on the next deploy — does not occur. The grant is present and correctly
scoped to the one secret:

```json
{"Action": ["secretsmanager:GetSecretValue","secretsmanager:DescribeSecret"],
 "Effect": "Allow",
 "Resource": {"Fn::ImportValue": "PricefeedData:ExportsOutputRefDatabaseSecretAttachmentE5D1B020633AEB73"}}
```

It sits on `TaskDefExecutionRoleDefaultPolicy0DBB737A` (the execution role, which is what ECS uses
to fetch secrets at task start — the task role would have been wrong), and the container's
`Secrets[0].ValueFrom` targets the same `DatabaseSecretAttachment` ARN plus `:password::`. The
secret ARN, the grant, and the reference all agree.

## V4 — Security-group rule swap · **PASS** (one overstated word)

Substance is correct: exactly one inline rule before and one after, no standalone
`AWS::EC2::SecurityGroupIngress` resources in either template, so there is **no residual
`0.0.0.0/0` rule** hiding anywhere.

On sequencing — the interesting question is whether CloudFormation can drop app→DB traffic while
swapping the rule. The saving grace the commit relies on is real: the new rule (VPC CIDR) is a
strict **subset** of the old rule (`0.0.0.0/0`), and the tasks sit in private subnets
(`AssignPublicIp: DISABLED`, VPC-internal source IPs), so app traffic is matched by the old rule
and the new rule alike. If CloudFormation authorizes before revoking, there is no gap at all.

But the commit says the swap is *"atomic inside one stack update and in-VPC app traffic matches the
new rule throughout"*. "Atomic" is not quite right: CloudFormation implements an inline-rule change
as separate `AuthorizeSecurityGroupIngress` / `RevokeSecurityGroupIngress` calls, and the order is
not contractually guaranteed. In the revoke-first ordering there is a brief window with no ingress
rule, during which *new* DB connections would be refused (established, tracked connections are
unaffected). The subset relationship makes this benign and self-healing in seconds rather than an
outage — the conclusion stands, only the word "atomic" is stronger than the evidence supports.
Documented, not fixed: this is a wording nit in a commit message, and rewriting shipped history to
soften one adjective is not worth it.

## V5 — Deploy settings · **PASS**

`DesiredCount: 2` with `MaximumPercent: 200` means up to 4 tasks during a rollout. That places
fine: `maxAzs: 2` with CDK's default private-subnet sizing leaves ample free IPs, Fargate at
512 CPU / 1024 MiB is far below any default account quota, and the single NAT gateway affects
egress throughput, not task placement.

No deadlock is possible at `MinimumHealthyPercent: 100`: ECS may run 4 tasks while it must keep 2
healthy, giving it 2 slots of headroom to start replacements before draining the originals. This
is the standard start-then-stop configuration, and it is precisely what makes the credential
rollout in V2 survivable.

The `/health` endpoint in `app/index.js` answers `200` synchronously from the HTTP handler with no
DB or Redis dependency, so a task turns healthy regardless of database state — which also means the
circuit breaker will not false-trip during the password-rotation window. `DB_PASSWORD` arrives as
an ordinary environment variable inside the container whether it came from `environment` or
`secrets`, so nothing in the app or Dockerfile breaks from the move.

The `force-new-deployment` step in `deploy.yml` remains as ugly as REVIEW.md finding 5 says, but it
is unchanged by this commit and explicitly out of scope. Its interaction with the V1 replacement is
recorded above.

## V6 — Backups, deletion protection, snapshot policy · **PASS**

All three present and correct: `BackupRetentionPeriod: 7`, `DeletionProtection: true`, and both
`DeletionPolicy` and `UpdateReplacePolicy` set to `Snapshot`. Setting *both* policies is the right
call — `DeletionPolicy` alone would still discard data on a replace-triggering update.

The commit's caveat is accurate: on a single-AZ instance, moving `BackupRetentionPeriod` between
zero and non-zero forces a brief outage while the first backup initializes, which is exactly why
the commit message and the code comment both direct the merge into a low-traffic window. Claim
matches behaviour.

## V7 — Claims audit · **PASS**

Cross-checking every assertion in the commit message against the template diff, the three
"what changed and why" bullets are accurate, and the "deliberately out of scope" list matches what
the diff genuinely leaves alone (private subnets, encryption, task role `*`/`*`, `deploy.yml`,
HTTPS, Multi-AZ, housekeeping). The rollout narrative's DataStack→ServiceStack ordering is real,
enforced by CDK's cross-stack `Fn::ImportValue` dependencies (ServiceStack imports the DB endpoint,
the Redis endpoint, the private subnets and the secret ARN from DataStack), not merely assumed.
The connection-survival claim in step 2 is correct: MySQL authenticates at handshake, so
established connections outlive a master-password change and only new connections fail in the
window. The rollback caveat is correct and unusually honest — rolling back the task definition
alone genuinely would not restore DB access after rotation.

Against REVIEW.md's top-3 spec, findings 1 and 3 ship exactly as prescribed. Finding 2 ships as
prescribed (`desiredCount: 2` + circuit breaker with rollback), and the one deviation — VPC-CIDR
ingress instead of the service security group — is already argued in
`PARA/Tasks/03-AiNotes/01-disagreement-log.md` and flagged in the commit message itself, so a
grader reading either document finds the same story. No contradiction between the two.

The single inaccurate claim is the V1 rollout description, which describes a rolling update the
template would not have performed. The follow-up commit makes the description true rather than
rewriting it.

---

## Verdict

The commit does what it says on all three findings, with correct sequencing reasoning and an
unusually candid rollback caveat. It has one real defect — an invisible, CDK-injected
`DeploymentController` that would have replaced the live ECS service on the next merge — which is
now fixed with a three-line `cdk.json` change and no alteration to the reviewed logic. Scope was
held: no new hardening entered the code, and everything else surfaced during the review went to
`00.rejected-ideas.md`.
