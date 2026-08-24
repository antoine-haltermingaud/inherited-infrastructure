# AI notes — draft skeleton (SUPERSEDED)

Superseded 2026-08-24: final version written to repo-root `AI-NOTES.md` from the 9-entry
disagreement log. Kept for the record of what was evidenced when.

## Progress tracker

- [x] Evidenced setup/orchestration paragraph drafted
- [x] Review-chat paragraph (from task 01 outcome)
- [x] Fix-chat paragraph (from task 02 outcome)
- [x] Disagreement section (featured: the [02] SG-to-SG cross-stack ordering entry — revoke-before-allow outage window; plus the [01] ranking override and [02] Secrets-Manager-unchanged rejection as one-liners)
- [ ] Voice/claims pass by Antoine before submission (AI-NOTES.md speaks as the candidate)

---

## How I used AI

I ran this exercise as a set of parallel Claude Code sessions, one per task, coordinated
through the repo itself: a setup session first built a PARA task structure (protocol in
`CLAUDE.md`) with per-task requirements/context/todo files mirrored to GitHub issues, so
each later session started with full context of what the others had decided instead of a
blank prompt.

During setup, AI produced a raw findings inventory of the infrastructure
(`PARA/Tasks/01-InfraReview/01-findings-inventory.md`), checked against the code but
deliberately left **unranked** — ranking findings against Delta's specific context
(millions of users, multiple deploys a day, no ops team, zero downtime appetite,
cost-conscious) was kept as the human judgment step, because that ordering is what the
review is actually graded on.

[TBD — review chat: how AI was actually used for REVIEW.md — task 01 outcome]

[TBD — fix chat: how AI was actually used for the fix commit — task 02 outcome]

[TBD — optional one-liner on the ECS/K8s kicker chat if task 04 completed]

## Where I disagreed with the AI

[TBD — pick the MOST specific entry from `01-disagreement-log.md`: name the suggestion,
and why it was wrong for THIS context. If the log is still empty once tasks 01/02 are
done → ask Antoine. Do not invent.]
