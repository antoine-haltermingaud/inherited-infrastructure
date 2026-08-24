# Results — corrector's guide

One page on where everything is. Total time: within the 4-hour box.

## The three deliverables

| Part | Where | One-liner |
|---|---|---|
| 1 — Review | [`REVIEW.md`](REVIEW.md) | Findings ranked for *this* context (3 tiers), a "looks odd but is fine" list, and a Monday–Friday plan. Optional ECS-vs-K8s kicker is the last section. |
| 2 — Fixes | commits `655147d` + `2af650b` | Top 3 findings only: deploy-outage settings, credentials/DB exposure, data survivability. ~20-line diff to `lib/`; message covers scope, out-of-scope, and live-rollout risk. `2af650b` fixes a service-replacement bug an adversarial self-review caught post-push (see REVIEW.md errata). `cdk synth` passes without AWS credentials. |
| 3 — AI notes | [`AI-NOTES.md`](AI-NOTES.md) | How AI was used, plus concrete disagreements — sourced from a log kept during the work, not reconstructed after. |

## Suggested reading order

1. `REVIEW.md` — TL;DR first; the ranking rationale is the point. Errata section included.
2. `git show 655147d` — the fix commit and its message — then `2af650b`, the self-review fix.
3. `PARA/Tasks/05-FixCommitAdversarialReview/01-adversarial-review.md` — the adversarial
   review of the fix: per-vector verdicts, one real bug found, one of its own verdicts
   reversed and the reversal recorded.
4. `AI-NOTES.md`.

## Commit trail

```
e7ba0f8  bootstrap: task/doc structure (PARA/, CLAUDE.md) — process, not assignment content
3a0204b  REVIEW.md — ranked findings + week-one plan
2421410  REVIEW.md — optional kicker appended
655147d  fix commit — the Part 2 deliverable
a54a706  AI-NOTES.md
8a27983  RESULTS.md (this guide)
2af650b  fix-of-the-fix: circuit breaker would have replaced the live service — caught by self-review
42f1992  week-one plan ticketed as project 02 (issues #7–#14), planned-not-implemented
c70b6af  self-review closeout (4223610 corrects one of its verdicts — deliberately kept visible)
8cea2bf  errata in REVIEW.md + AI-notes working model + project board link
(HEAD)   final polish — this commit
```

## About `PARA/` and the GitHub issues

Working notes, not deliverables: each task has a folder under `PARA/Tasks/` (requirements,
todos, rejected ideas) mirrored to a closed GitHub issue (#1–#4; #5 is a documented
duplicate from two sessions racing). Kept in the repo as evidence of process — including
`PARA/Tasks/03-AiNotes/01-disagreement-log.md`, the raw material behind `AI-NOTES.md`.
Safe to ignore entirely when grading. The issues are also on a
[project board](https://github.com/users/antoine-haltermingaud/projects/3) — done work and
the ticketed week-one plan in one table.

One optional extra: `REVIEW.md`'s week-one plan is also *ticketed* — project
[`02-PricefeedHardening`](PARA/Projects/02-PricefeedHardening/00.tasks.md) sequences the
remaining findings as 8 planned tasks (issues #7–#14), **deliberately not implemented**
per Part 2's top-2–3 scope.
