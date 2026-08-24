# Results — corrector's guide

One page on where everything is. Total time: within the 4-hour box.

## The three deliverables

| Part | Where | One-liner |
|---|---|---|
| 1 — Review | [`REVIEW.md`](REVIEW.md) | Findings ranked for *this* context (3 tiers), a "looks odd but is fine" list, and a Monday–Friday plan. Optional ECS-vs-K8s kicker is the last section. |
| 2 — Fixes | commit `6f1771d` | Top 3 findings only: deploy-outage settings, credentials/DB exposure, data survivability. ~20-line diff to `lib/`; message covers scope, out-of-scope, and live-rollout risk. `cdk synth` passes without AWS credentials. |
| 3 — AI notes | [`AI-NOTES.md`](AI-NOTES.md) | How AI was used, plus concrete disagreements — sourced from a log kept during the work, not reconstructed after. |

## Suggested reading order

1. `REVIEW.md` — TL;DR first; the ranking rationale is the point.
2. `git show 6f1771d` — the fix commit and its message.
3. `AI-NOTES.md`.

## Commit trail

```
1a65f9f  bootstrap: task/doc structure (PARA/, CLAUDE.md) — process, not assignment content
a378aad  REVIEW.md — ranked findings + week-one plan
a782e19  REVIEW.md — optional kicker appended
6f1771d  fix commit — the Part 2 deliverable
f5b2c5b  AI-NOTES.md
```

## About `PARA/` and the GitHub issues

Working notes, not deliverables: each task has a folder under `PARA/Tasks/` (requirements,
todos, rejected ideas) mirrored to a closed GitHub issue (#1–#4; #5 is a documented
duplicate from two sessions racing). Kept in the repo as evidence of process — including
`PARA/Tasks/03-AiNotes/01-disagreement-log.md`, the raw material behind `AI-NOTES.md`.
Safe to ignore entirely when grading.

One optional extra: `REVIEW.md`'s week-one plan is also *ticketed* — project
[`02-PricefeedHardening`](PARA/Projects/02-PricefeedHardening/00.tasks.md) sequences the
remaining findings as 8 planned tasks (issues #7–#14), **deliberately not implemented**
per Part 2's top-2–3 scope.
