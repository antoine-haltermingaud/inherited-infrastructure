# Take-home assignment — Inherited Infrastructure

Welcome! This exercise is designed to look like your first week at Delta, not like a puzzle.

## The scenario

You've just joined as our infrastructure contractor. A previous engineer — who has since left — built and deployed **"pricefeed"**, an internal service that aggregates market prices and serves them to our apps. It works. It's in production. Nobody has looked at it closely in a year.

Your manager tells you:

> "Pricefeed serves **millions of users**. We deploy **multiple times per day** across our stack. The team is **a handful of engineers** — there is no dedicated ops team besides you. We have **zero appetite for downtime**, and as a startup we are **cost-conscious**. Before we put more features on this service, I want your honest assessment of its infrastructure."

This repo contains everything: the application (a small Node service), the AWS CDK code that defines its infrastructure, and the GitHub Actions workflow that deploys it.

## Your tasks

### Part 1 — Review (`REVIEW.md`) — the most important part

Read the infrastructure code and the deploy workflow. Write `REVIEW.md` containing:

1. **Your findings, ranked by priority for this specific context.** For each: a one-or-two-sentence rationale. We care about your *ordering and reasoning* far more than raw completeness.
2. **A week-one plan:** you start Monday — what do you fix in the first week, and what deliberately waits? Why?

Not everything that looks unusual is wrong. If you decide something is actually a reasonable choice for this context, saying so (and why) counts in your favor.

### Part 2 — Fix top findings

Push a git commit that fixes **your top 2–3 findings only**. Include a commit message written as if for a real team:

- What changed and why
- What is deliberately out of scope
- Any migration/rollout risk for applying this to a *running production system* — and how you'd mitigate it

The code must `cdk synth` cleanly. You do **not** need an AWS account and should not deploy anything.

### Part 3 — AI notes (`AI-NOTES.md`)

Using AI tools (Claude, Copilot, Cursor, ChatGPT, ...) is **allowed and expected** — we use them daily. Write a few short paragraphs:

- How you used AI during this exercise
- At least one concrete place where you disagreed with, corrected, or discarded an AI suggestion — and why

### Optional kicker (one paragraph, only if you have time)

We currently run workloads on both ECS and Kubernetes. Argue for or against consolidating onto one — and what you'd need to know about our environment before deciding.

## Time box

This should take **about one evening (3–4 hours)**. Please stop at around 4 hours. If you run out of time, write down what you'd do next — an honest "with more time I would..." is worth more to us than a polished but overtime submission. Respecting the time box is part of the exercise.

## Getting started

```bash
npm ci
npx cdk synth        # must work without AWS credentials
```

The application itself lives in `app/` — you can largely ignore it, except where it interacts with infrastructure concerns.

## What we evaluate

- Quality of prioritization and rationale (most weight)
- Written communication — could we hand your description to the team as-is?
- Correctness and quality of the fixes you chose to make
- Judgment: trade-offs, red flags vs. acceptable pragmatism, awareness of production migration risk

## Submitting

Push all your changes to the `main` branch. Send us a note when you're done with a link/dump to/of the repo. Questions during the exercise are welcome — asking good questions is not a weakness.
