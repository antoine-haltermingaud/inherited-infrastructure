# AI notes

I ran this exercise as parallel Claude Code sessions, one per deliverable (the review, the
fixes, the ECS/K8s paragraph, these notes), coordinated through the repo itself: a setup
session first wrote per-task requirement and context files, so each later session started
from the same brief instead of a blank prompt. One standing rule mattered most: every time
I rejected or corrected an AI suggestion, the session logged it to
`PARA/Tasks/03-AiNotes/01-disagreement-log.md` at that moment. These notes are assembled
from that log, not reconstructed from memory — and the session assembling them was told
that an empty log means "ask, don't invent", so it waited for real entries.

The division of labor was consistent. AI did the wide, checkable work: a findings
inventory verified against the code, first-draft prose for `REVIEW.md`, the CDK edits
themselves. The judgment calls stayed with me — most deliberately, the inventory was left
**unranked**, because ranking findings against this specific context (millions of users,
several deploys a day, no ops team, zero appetite for downtime) is the part that is
actually graded, and it is where AI needed the most correcting.

The disagreement worth naming in full: to close the database's `0.0.0.0/0` ingress, AI
first proposed the textbook fix — an SG-to-SG rule granting the ECS service's security
group access, added in `ServiceStack`. Right answer in a greenfield repo; wrong here.
`cdk deploy --all` updates `DataStack` before `ServiceStack`, so the open rule would be
revoked in the first stack update while the service's allow does not exist until the
second — an app→DB outage window on a live production system. The shipped fix is a
VPC-CIDR ingress rule inside `DataStack` instead: one stack, one atomic update, and
consistent with how the existing Redis security group already works.

The same shape repeated across the log: AI's first answer was generic best practice, and
the correction came from this environment. AI's first ranking put the daily deploy outage
at #1; I moved the internet-exposed database with git-committed credentials above it,
because outages are recoverable while poisoned prices or a destroyed, backup-less dataset
are not. AI also floated storing the leaked password in Secrets Manager *unchanged* to
avoid rotation risk during rollout — pointless, since the value sits in pushed git history
and is therefore already compromised. The full log, entry by entry, is in
`PARA/Tasks/03-AiNotes/01-disagreement-log.md`.
