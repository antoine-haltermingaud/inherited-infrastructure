# AI notes

## How it was run

I ran this exercise as parallel Claude Code sessions, one per deliverable — the review,
the fixes, the ECS/K8s paragraph, these notes — coordinated through the repo itself. A
setup session first wrote per-task requirement and context files, so each later session
started from the same brief instead of a blank prompt.

One standing rule mattered most: every time I rejected or corrected an AI suggestion,
the session logged it to `PARA/Tasks/03-AiNotes/01-disagreement-log.md` at that moment.
These notes are assembled from that log, not reconstructed from memory — and the session
assembling them was told that an empty log means "ask, don't invent", so it waited for
real entries.

## Division of labor

The division of labor was consistent. AI did the wide, checkable work:

- the findings inventory, verified against the code
- first-draft prose for `REVIEW.md`
- the CDK edits themselves

The judgment calls stayed with me. Most deliberately, the inventory was left
**unranked**: ranking findings against this specific context (millions of users, several
deploys a day, no ops team, zero appetite for downtime) is the part that is actually
graded, and it is where AI needed the most correcting.

## The disagreement worth naming in full

To close the database's `0.0.0.0/0` ingress, AI first proposed the textbook fix — an
SG-to-SG rule granting the ECS service's security group access, added in `ServiceStack`.
Right answer in a greenfield repo; wrong here.

`cdk deploy --all` updates `DataStack` before `ServiceStack`, so the open rule would be
revoked in the first stack update while the service's allow does not exist until the
second — an app→DB outage window on a live production system.

The shipped fix is a VPC-CIDR ingress rule inside `DataStack` instead: one stack, one
atomic update, and consistent with how the existing Redis security group already works.

## The pattern across the log

The same shape repeated across the log: AI's first answer was generic best practice, and
the correction came from this environment.

- AI's first ranking put the daily deploy outage at #1; I moved the internet-exposed
  database with git-committed credentials above it, because outages are recoverable
  while poisoned prices or a destroyed, backup-less dataset are not.
- AI floated storing the leaked password in Secrets Manager *unchanged* to avoid
  rotation risk during rollout — pointless, since the value sits in pushed git history
  and is therefore already compromised.

The full log, entry by entry, is in `PARA/Tasks/03-AiNotes/01-disagreement-log.md`.

## The working model

A note on the working model, since it is how I work generally and not something invented
for this exercise: the only tool used was Claude (Claude Code), and the repo itself is
the coordination layer.

`CLAUDE.md` defines the protocol — every unit of work is a folder under `PARA/Tasks/`
with requirements, context, and rejected ideas, mirrored to a GitHub issue — and
sessions hand off to each other through written briefs, not shared chat history.

That structure is what made parallel sessions safe: when two sessions raced to create
the same issue, or one started before its input document existed, the repo state let
them detect and resolve it themselves, and the seams are visible in the issue log rather
than hidden.

## The adversarial self-review

The strongest evidence for that model came after the deliverables were done, still
inside the time box: a fresh session was told to assume the fix commit was wrong and
prove it, arguing only from the synthesized CloudFormation templates.

It found something my review and the fixing session had both missed — adding the
deployment circuit breaker made CloudFormation **replace the running ECS service**, the
exact outage the fix existed to prevent, invisible in the CDK source and visible only in
the template diff (fixed in `2af650b`).

The same session then reversed one of its own verdicts: it had passed the commit's
claims on first reading, and a second, adversarial pass caught the commit message
contradicting REVIEW.md's "never rotate and rewire in the same deploy" rule — recorded
as a downgrade with the original wrong verdict left visible
(`PARA/Tasks/05-FixCommitAdversarialReview/01-adversarial-review.md`, errata in
`REVIEW.md`).

## The honest summary

That is the honest summary of AI in this exercise: the first pass is a draft — including
the first pass at reviewing the first pass. The discipline lives in the system around
it: evidence over reading, logs written at the moment of decision, reversals recorded
instead of edited away.
